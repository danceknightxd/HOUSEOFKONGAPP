/* ============================================================
   THE THRONE — LIQUID BACKGROUND
   Drifting gold blobs behind the Auth Gate and Vault passphrase
   gate, rendered via a blur+contrast canvas trick. Scoped to those
   two screens only (not the main app) — starts/stops automatically
   by watching for either gate's .show class, so it's never running
   (and never costing CPU/battery) once you're actually inside.
   ============================================================ */

(function () {
  const stage = document.getElementById("liquid-stage");
  const canvas = document.getElementById("liquid-canvas");
  if (!stage || !canvas) return;

  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // ---- pointer tracking, defaults to center until moved ----
  let pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
  function setPointer(x, y) { pointer.x = x; pointer.y = y; }
  window.addEventListener("mousemove", e => setPointer(e.clientX, e.clientY));
  window.addEventListener("touchmove", e => {
    if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("touchstart", e => {
    if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // ---- blobs: a few drifting freely, one dedicated "pointer" blob ----
  // fewer blobs on small/low-power screens — the blur filter is the
  // expensive part, and mobile GPUs feel it fastest
  const COUNT = window.innerWidth < 640 ? 4 : 6;
  const blobs = Array.from({ length: COUNT }, (_, i) => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 90 + Math.random() * 70,
    driftAngle: Math.random() * Math.PI * 2,
    driftSpeed: 0.0006 + Math.random() * 0.0006,
    vx: 0, vy: 0,
    isPointerBlob: i === 0
  }));

  let running = false;   // is the rAF loop currently active
  let visible = false;   // is a gate currently showing (.active on #liquid-stage)
  let tabHidden = document.hidden;

  function step() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    blobs.forEach((b, i) => {
      if (b.isPointerBlob) {
        const dx = pointer.x - b.x, dy = pointer.y - b.y;
        b.vx += dx * 0.0018;
        b.vy += dy * 0.0018;
        b.vx *= 0.9; b.vy *= 0.9;
        b.x += b.vx; b.y += b.vy;
      } else {
        b.driftAngle += b.driftSpeed;
        b.x += Math.cos(b.driftAngle + i) * 0.4;
        b.y += Math.sin(b.driftAngle * 1.3 + i) * 0.4;
        const dx = pointer.x - b.x, dy = pointer.y - b.y;
        b.x += dx * 0.0004;
        b.y += dy * 0.0004;
      }

      if (b.x < -150) b.x = W + 150; if (b.x > W + 150) b.x = -150;
      if (b.y < -150) b.y = H + 150; if (b.y > H + 150) b.y = -150;

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
    if (running || reduceMotion || tabHidden || !visible) return;
    running = true;
    requestAnimationFrame(step);
  }
  function stopLoop() {
    running = false;
  }

  document.addEventListener("visibilitychange", () => {
    tabHidden = document.hidden;
    if (tabHidden) stopLoop(); else startLoop();
  });

  // ---- start/stop by watching the two gates for their .show class ----
  // (reduceMotion: CSS already hides the canvas via prefers-reduced-motion,
  // and startLoop() bails out too, so the loop simply never runs for them)
  function refreshVisibility() {
    const authShown = document.getElementById("auth-gate")?.classList.contains("show");
    const pgShown = document.getElementById("passphrase-gate")?.classList.contains("show");
    const shouldShow = !!(authShown || pgShown);
    if (shouldShow === visible) return;
    visible = shouldShow;
    stage.classList.toggle("active", visible);
    if (visible) startLoop(); else stopLoop();
  }

  ["auth-gate", "passphrase-gate"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(refreshVisibility).observe(el, { attributes: true, attributeFilter: ["class"] });
  });
  refreshVisibility();
})();
