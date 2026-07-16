/* ============================================================
   THE THRONE — TASKS+ ENGINE
   Three additions to the Tasks view:
   1. A 3D bar chart of exercise personal bests (three.js) — floats
      the same visual language as the Kingdom seals: auto-rotates,
      drag to spin manually.
   2. A standalone time-blocking hour grid.
   3. A monthly calendar of task due dates.
   Pure rendering here — app.js owns state and wires up clicks/adds,
   same split feeds.js uses for news rendering.
   ============================================================ */

const ThroneTasksPlus = (() => {

  // ============================================================
  // 1. PERSONAL BESTS — 3D CHART
  // ============================================================
  let pr = { renderer: null, scene: null, camera: null, group: null, animId: null, el: null };

  function epley1RM(weight, reps) {
    return weight * (1 + reps / 30);
  }

  function makeTextSprite(text, color) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fontSize = 42;
    ctx.font = `600 ${fontSize}px 'Space Mono', monospace`;
    const width = Math.max(128, ctx.measureText(text).width + 24);
    canvas.width = width;
    canvas.height = fontSize + 20;
    ctx.font = `600 ${fontSize}px 'Space Mono', monospace`;
    ctx.fillStyle = color || "#e8c766";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 8, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    const scale = 0.014;
    sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
    return sprite;
  }

  function destroyPRChart() {
    if (pr.animId) cancelAnimationFrame(pr.animId);
    if (pr.renderer) {
      pr.renderer.dispose();
      if (pr.renderer.domElement && pr.renderer.domElement.parentNode) {
        pr.renderer.domElement.parentNode.removeChild(pr.renderer.domElement);
      }
    }
    pr = { renderer: null, scene: null, camera: null, group: null, animId: null, el: null };
  }

  // prEntries: array of { exercise_name, weight, reps } (best log per exercise)
  function renderPRChart(containerEl, prEntries) {
    destroyPRChart();
    pr.el = containerEl;
    containerEl.innerHTML = "";

    if (!prEntries.length) {
      containerEl.innerHTML = `<div class="feed-empty">Log a set in Fitness to start tracking personal bests here.</div>`;
      return;
    }
    if (typeof THREE === "undefined") {
      containerEl.innerHTML = `<div class="feed-empty">3D view couldn't load (three.js didn't load — check your connection).</div>`;
      return;
    }

    const width = containerEl.clientWidth || 600;
    const height = 340;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5, 11);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.cursor = "grab";
    containerEl.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff4dd, 0.65));
    const dirLight = new THREE.DirectionalLight(0xffdca0, 1.1);
    dirLight.position.set(4, 8, 6);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(12, 12, 0x8a7136, 0x2a251c);
    grid.position.y = 0;
    scene.add(grid);

    const entries = prEntries.slice(0, 8).map(p => ({
      name: p.exercise_name, oneRm: epley1RM(p.weight, p.reps), weight: p.weight, reps: p.reps
    }));
    const maxRm = Math.max(...entries.map(e => e.oneRm), 1);

    const group = new THREE.Group();
    const barWidth = 0.8;
    const gap = 1.35;
    const totalWidth = (entries.length - 1) * gap;

    entries.forEach((e, i) => {
      const barHeight = Math.max(0.3, (e.oneRm / maxRm) * 5.5);
      const geo = new THREE.BoxGeometry(barWidth, barHeight, barWidth);
      const hue = 0.11 - (i / entries.length) * 0.03; // gold, slight shift per bar
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.55, 0.5),
        emissive: new THREE.Color().setHSL(hue, 0.6, 0.14),
        metalness: 0.35, roughness: 0.45
      });
      const bar = new THREE.Mesh(geo, mat);
      const x = i * gap - totalWidth / 2;
      bar.position.set(x, barHeight / 2, 0);
      group.add(bar);

      const label = makeTextSprite(e.name, "#e8c766");
      label.position.set(x, barHeight + 0.55, 0);
      group.add(label);

      const valueLabel = makeTextSprite(`${e.weight}kg×${e.reps}`, "#a89a7a");
      valueLabel.position.set(x, -0.55, 0);
      valueLabel.scale.multiplyScalar(0.72);
      group.add(valueLabel);
    });

    scene.add(group);

    // ---- drag-to-rotate (manual — same idle+draggable feel as the
    // Kingdom seals' <model-viewer>, without needing the OrbitControls
    // addon) + slow auto-rotate when idle ----
    let dragging = false, lastX = 0, autoRotate = true;
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", (e) => {
      dragging = true; autoRotate = false; lastX = e.clientX;
      dom.style.cursor = "grabbing";
    });
    window.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      dom.style.cursor = "grab";
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      group.rotation.y += dx * 0.008;
    });

    function resize() {
      const w = containerEl.clientWidth || width;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    window.addEventListener("resize", resize);

    function animate() {
      pr.animId = requestAnimationFrame(animate);
      if (autoRotate) group.rotation.y += 0.0035;
      renderer.render(scene, camera);
    }
    animate();

    pr.renderer = renderer; pr.scene = scene; pr.camera = camera; pr.group = group;
  }

  // ============================================================
  // 2. TIME-BLOCKING HOUR GRID
  // ============================================================
  const GRID_START_HOUR = 6;   // 6am
  const GRID_END_HOUR = 23;    // 11pm
  const PX_PER_HOUR = 52;

  function hourGridHtml(blocks) {
    const hours = [];
    for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) hours.push(h);

    const hourRows = hours.map(h => {
      const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
      return `<div class="hour-row" style="height:${PX_PER_HOUR}px;"><div class="hour-label">${label}</div></div>`;
    }).join("");

    const totalHeight = hours.length * PX_PER_HOUR;
    const gridStartMin = GRID_START_HOUR * 60;

    const blockEls = blocks.map(b => {
      const top = ((b.start_minutes - gridStartMin) / 60) * PX_PER_HOUR;
      const heightPx = Math.max(20, (b.duration_minutes / 60) * PX_PER_HOUR - 2);
      const endMinutes = b.start_minutes + b.duration_minutes;
      const fmt = (m) => {
        const hh = Math.floor(m / 60), mm = m % 60;
        const period = hh < 12 ? "AM" : "PM";
        const h12 = hh % 12 === 0 ? 12 : hh % 12;
        return `${h12}:${String(mm).padStart(2, "0")}${period}`;
      };
      return `
        <div class="time-block" data-id="${b.id}" style="top:${top}px; height:${heightPx}px; background:${b.color || "rgba(201,168,76,0.16)"}; border-color:${b.color ? b.color.replace("0.16", "0.6") : "rgba(201,168,76,0.55)"};">
          <div class="tb-label">${b.label}</div>
          <div class="tb-time">${fmt(b.start_minutes)}–${fmt(endMinutes)}</div>
          <span class="tb-remove" data-id="${b.id}" title="Remove">✕</span>
        </div>`;
    }).join("");

    return `
      <div class="hour-grid-wrap" style="height:${totalHeight}px;">
        <div class="hour-grid-rows">${hourRows}</div>
        <div class="hour-grid-blocks">${blockEls}</div>
      </div>`;
  }

  // ============================================================
  // 3. MONTHLY CALENDAR
  // ============================================================
  function monthCalendarHtml(year, month, tasksByDate) {
    // month: 0-11
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const dowRow = ["S", "M", "T", "W", "T", "F", "S"]
      .map(d => `<div class="cal-dow">${d}</div>`).join("");

    let cells = "";
    for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTasks = tasksByDate[dateStr] || [];
      const isToday = dateStr === todayStr;
      const dots = dayTasks.slice(0, 4).map(t =>
        `<span class="cal-dot" style="background:${t.done ? "#5a5240" : "var(--gold-bright)"};"></span>`
      ).join("");
      cells += `
        <div class="cal-cell ${isToday ? "today" : ""}" data-date="${dateStr}">
          <div class="cal-daynum">${d}</div>
          <div class="cal-dots">${dots}</div>
          ${dayTasks.length > 4 ? `<div class="cal-more">+${dayTasks.length - 4}</div>` : ""}
        </div>`;
    }

    return `
      <div class="cal-header">
        <button class="cal-nav" data-dir="-1">‹</button>
        <div class="cal-month-label">${monthLabel}</div>
        <button class="cal-nav" data-dir="1">›</button>
      </div>
      <div class="cal-grid">${dowRow}${cells}</div>`;
  }

  return {
    renderPRChart, destroyPRChart,
    hourGridHtml, GRID_START_HOUR, GRID_END_HOUR, PX_PER_HOUR,
    monthCalendarHtml
  };
})();
