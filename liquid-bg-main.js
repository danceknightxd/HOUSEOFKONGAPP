/* ============================================================
   THE THRONE — LIQUID BACKGROUND (MAIN APP, AMBIENT)
   Same blur+contrast blob trick as the gate version, tuned way
   down for sitting behind dense, readable content instead of an
   empty login screen: lower opacity, softer blur, and an "energy"
   value that settles to near-still ~2.5s after the last touch/move
   so it never competes with something you're actually reading —
   touch or move the cursor and it visibly wakes back up.

   Runs only while the main app is actually what's on screen: paused
   whenever the loading screen, either gate, the holding-detail
   modal, or the call overlay is showing — no point animating a
   30px-blurred full-viewport canvas underneath something that's
   already covering it.
   ============================================================ */

(function () {
  const canvas = document.getElementById("liquid-canvas-main");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return; // CSS also hides the canvas outright; no need to run anything

  let W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // ---- pointer tracking + idle timer ----
  let pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
  let lastInteraction = 0;
  function setPointer(x, y) { pointer.x = x; pointer.y = y; lastInteraction = performance.now(); }
  window.addEventListener("mousemove", e => setPointer(e.clientX, e.clientY));
  window.addEventListener("touchmove", e => {
    if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("touchstart", e => {
    if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // Settles to a near-still idle floor ~2.5s after the last touch/move.
  function currentEnergy() {
    const idle = performance.now() - lastInteraction;
    const settleTime = 2500;
    if (idle >= settleTime) return 0.06;
    return 1 - (idle / settleTime) * 0.94;
  }

  // Fewer blobs on small/low-power screens — same reasoning as the gate
  // version, blur() on a full-viewport canvas is the expensive part.
  const COUNT = window.innerWidth < 640 ? 3 : 5;
  const blobs = Array.from({ length: COUNT }, (_, i) => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 110 + Math.random() * 80,
    driftAngle: Math.random() * Math.PI * 2,
    vx: 0, vy: 0,
    isPointerBlob: i === 0
  }));

  let running = false;
  let appVisible = false;
  let tabHidden = document.hidden;

  function step() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    const energy = currentEnergy();

    blobs.forEach((b, i) => {
      if (b.isPointerBlob) {
        const dx = pointer.x - b.x, dy = pointer.y - b.y;
        b.vx += dx * 0.0016 * energy;
        b.vy += dy * 0.0016 * energy;
        b.vx *= 0.92; b.vy *= 0.92;
        b.x += b.vx; b.y += b.vy;
      } else {
        b.driftAngle += 0.0004 * (0.3 + energy);
        b.x += Math.cos(b.driftAngle + i) * 0.25 * (0.4 + energy);
        b.y += Math.sin(b.driftAngle * 1.3 + i) * 0.25 * (0.4 + energy);
      }
      if (b.x < -180) b.x = W + 180; if (b.x > W + 180) b.x = -180;
      if (b.y < -180) b.y = H + 180; if (b.y > H + 180) b.y = -180;

      const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      grd.addColorStop(0, "rgba(201,168,76,1)");
      grd.addColorStop(1, "rgba(201,168,76,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(step);
  }

  function startLoop() {
    if (running || tabHidden || !appVisible) return;
    running = true;
    requestAnimationFrame(step);
  }
  function stopLoop() { running = false; }

  document.addEventListener("visibilitychange", () => {
    tabHidden = document.hidden;
    if (tabHidden) stopLoop(); else startLoop();
  });

  // ---- pause under any overlay (loading screen, both gates, holding
  // detail modal, call screen) — all use a .show class except the
  // loading screen, which is visible by default and hidden via .hide.
  function anyOverlayBlocking() {
    const loadingEl = document.getElementById("loading-screen");
    if (loadingEl && !loadingEl.classList.contains("hide")) return true;
    return ["auth-gate", "passphrase-gate", "holding-detail-overlay", "call-overlay"]
      .some(id => document.getElementById(id)?.classList.contains("show"));
  }

  function refreshVisibility() {
    const shouldRun = !anyOverlayBlocking();
    if (shouldRun === appVisible) return;
    appVisible = shouldRun;
    if (appVisible) startLoop(); else stopLoop();
  }

  ["loading-screen", "auth-gate", "passphrase-gate", "holding-detail-overlay", "call-overlay"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(refreshVisibility).observe(el, { attributes: true, attributeFilter: ["class"] });
  });
  refreshVisibility();
})();
