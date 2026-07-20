/* ============================================================
   THE THRONE — CALLING (real WebRTC, "FaceTime for The Throne")
   Video/audio travels peer-to-peer once connected — Supabase is
   only used to pass the initial handshake messages (who's calling,
   session descriptions, ICE candidates), via its Realtime broadcast
   feature. No call content ever touches Supabase or any server.

   Honest limitation: this uses only a free public STUN server, no
   TURN server. That means calls work great on most home/office wifi
   and most mobile networks, but can fail to connect on some strict
   corporate/carrier networks that block direct peer connections. A
   TURN server (e.g. via a paid relay service) would fix that — it's
   a real infrastructure cost, so it's left out rather than silently
   degrading call quality without telling you.
   ============================================================ */

const ThroneCall = (() => {

  // STUN alone can't traverse every network (symmetric NAT, client-isolated
  // wifi, some carrier/corporate networks) — that's the #1 cause of a call
  // getting stuck on "Connecting…" with only your own video ever showing.
  // If WEBRTC_CONFIG.turnServers is filled in (see webrtc-config.js), those
  // get added here too so calls can relay through them when a direct
  // connection isn't possible.
  function buildRtcConfig() {
    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    if (typeof WEBRTC_CONFIG !== "undefined" && Array.isArray(WEBRTC_CONFIG.turnServers)) {
      WEBRTC_CONFIG.turnServers.forEach(s => { if (s && s.urls) iceServers.push(s); });
    }
    return { iceServers };
  }

  // How long to wait for the peer connection to actually reach "connected"
  // before giving up and telling the person it failed, instead of leaving
  // them staring at "Connecting…" forever with no way to know what happened.
  const CONNECT_TIMEOUT_MS = 20000;

  let peerConnection = null;
  let localStream = null;
  let inboxChannel = null;
  let roomChannel = null;
  let currentRoomId = null;
  let onIncomingCallCb = null;
  let onCallStateCb = null;
  let connectTimeout = null;

  function emitState(state, detail) {
    if (onCallStateCb) onCallStateCb(state, detail);
  }

  // ---------- inbox: listen for incoming calls ----------
  function listenForCalls(onIncomingCall) {
    onIncomingCallCb = onIncomingCall;
    const user = ThroneAuth.getUser();
    inboxChannel = supabaseClient.channel(`call-inbox-${user.id}`);
    inboxChannel
      .on("broadcast", { event: "ring" }, (msg) => {
        if (onIncomingCallCb) onIncomingCallCb(msg.payload); // { roomId, fromId, fromName, fromPublicKey... }
      })
      .subscribe();
  }

  // ---------- caller side ----------
  async function startCall(otherUserId, otherName) {
    const user = ThroneAuth.getUser();
    currentRoomId = crypto.randomUUID();

    // Ring the other person's inbox
    const ringChannel = supabaseClient.channel(`call-inbox-${otherUserId}`);
    await ringChannel.subscribe();
    ringChannel.send({
      type: "broadcast", event: "ring",
      payload: { roomId: currentRoomId, fromId: user.id, fromName: user.email }
    });

    await setupPeerConnection(currentRoomId, true);
    emitState("calling", { roomId: currentRoomId, otherName });
  }

  // ---------- callee side ----------
  async function answerCall(roomId) {
    currentRoomId = roomId;
    await setupPeerConnection(roomId, false);
    emitState("connecting", { roomId });
  }

  function declineCall(roomId) {
    const ch = supabaseClient.channel(`call-room-${roomId}`);
    ch.subscribe(() => {
      ch.send({ type: "broadcast", event: "declined", payload: {} });
    });
  }

  // ---------- shared WebRTC setup ----------
  async function setupPeerConnection(roomId, isCaller) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    emitState("local-stream", { stream: localStream });

    peerConnection = new RTCPeerConnection(buildRtcConfig());
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      emitState("remote-stream", { stream: event.streams[0] });
    };

    connectTimeout = setTimeout(() => {
      if (peerConnection && peerConnection.connectionState !== "connected") {
        emitState("ended", { reason: "timeout" });
        cleanupOnly();
      }
    }, CONNECT_TIMEOUT_MS);

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === "connected") {
        if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null; }
        emitState("connected", {});
      }
      if (["disconnected", "failed", "closed"].includes(peerConnection.connectionState)) {
        if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null; }
        emitState("ended", { reason: peerConnection.connectionState });
      }
    };

    roomChannel = supabaseClient.channel(`call-room-${roomId}`);
    let offerSent = false;

    roomChannel
      .on("broadcast", { event: "offer" }, async (msg) => {
        if (isCaller) return;
        await peerConnection.setRemoteDescription(msg.payload.sdp);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        roomChannel.send({ type: "broadcast", event: "answer", payload: { sdp: answer } });
      })
      .on("broadcast", { event: "answer" }, async (msg) => {
        if (!isCaller) return;
        await peerConnection.setRemoteDescription(msg.payload.sdp);
      })
      .on("broadcast", { event: "ice" }, async (msg) => {
        try { await peerConnection.addIceCandidate(msg.payload.candidate); } catch (e) { /* ignore late candidates */ }
      })
      .on("broadcast", { event: "declined" }, () => {
        emitState("declined", {});
        hangUp();
      })
      .on("broadcast", { event: "hangup" }, () => {
        emitState("ended", { reason: "remote-hangup" });
        cleanupOnly();
      })
      // The callee announces "I'm actually listening now" once THEIR
      // subscription is confirmed — the caller waits for this instead
      // of guessing timing, so the offer is never sent into empty air.
      .on("broadcast", { event: "callee-ready" }, async () => {
        if (!isCaller || offerSent) return;
        offerSent = true;
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        roomChannel.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
      });

    await roomChannel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      if (!isCaller) {
        // Tell the caller we're ready — this may arrive before the
        // caller's listener is attached on a very first connection,
        // so also send once more shortly after as a safety net.
        roomChannel.send({ type: "broadcast", event: "callee-ready", payload: {} });
        setTimeout(() => {
          if (roomChannel) roomChannel.send({ type: "broadcast", event: "callee-ready", payload: {} });
        }, 400);
      }
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && roomChannel) {
        roomChannel.send({ type: "broadcast", event: "ice", payload: { candidate: event.candidate } });
      }
    };
  }

  function cleanupOnly() {
    if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (roomChannel) { supabaseClient.removeChannel(roomChannel); roomChannel = null; }
    currentRoomId = null;
  }

  async function hangUp() {
    if (roomChannel) {
      // This used to fire-and-forget: cleanupOnly() (which removes the
      // channel) ran immediately after, often before the broadcast had
      // actually reached the network — so the other person's call never
      // got the message and stayed "connected" on their end forever.
      // Awaiting it first guarantees the hangup is sent before the
      // channel it travels over gets torn down.
      try { await roomChannel.send({ type: "broadcast", event: "hangup", payload: {} }); }
      catch (e) { /* still clean up locally even if the send failed */ }
    }
    cleanupOnly();
    emitState("ended", { reason: "local-hangup" });
  }

  function toggleMic(enabled) {
    if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = enabled);
  }
  function toggleCamera(enabled) {
    if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = enabled);
  }

  function onCallState(cb) { onCallStateCb = cb; }

  return {
    listenForCalls, startCall, answerCall, declineCall, hangUp,
    toggleMic, toggleCamera, onCallState
  };
})();
