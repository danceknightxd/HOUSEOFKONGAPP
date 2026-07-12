/* ============================================================
   THE THRONE — APP
   Boots feeds, renders them into the dashboard/news/circle views,
   and wires the topic chip filters.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

  // Ask the browser not to silently evict local storage (which holds
  // the Supabase session + Vault key) under storage pressure. Mainly
  // helps Android; iOS Safari has limited support but it's harmless
  // to request either way.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  // Handle the redirect back from Spotify's auth page, if that's why we're here.
  await ThroneSpotify.handleRedirect();

  const activeTopics = new Set(THRONE_CONFIG.topics.filter(t => t.enabled).map(t => t.name));

  // ---------- build topic chips from config ----------
  const chipRow = document.getElementById("topic-chip-row");
  THRONE_CONFIG.topics.forEach(t => {
    const chip = document.createElement("div");
    chip.className = "chip" + (t.enabled ? " on" : "");
    chip.textContent = t.name;
    chip.addEventListener("click", () => {
      chip.classList.toggle("on");
      if (chip.classList.contains("on")) activeTopics.add(t.name);
      else activeTopics.delete(t.name);
      newsPage = 1;
      renderNewsFull();
    });
    chipRow.appendChild(chip);
  });
  const addChip = document.createElement("div");
  addChip.className = "chip";
  addChip.style.borderStyle = "dashed";
  addChip.textContent = "+ Add topic (edit config.js)";
  chipRow.appendChild(addChip);

  // ---------- skeleton on load ----------
  const dashBriefing = document.getElementById("dashboard-briefing");
  const newsFullList = document.getElementById("news-full-list");
  ThroneFeeds.renderSkeleton(dashBriefing, 3);
  ThroneFeeds.renderSkeleton(newsFullList, 5);

  function setStatus(elId, textId, state, msg) {
    const el = document.getElementById(elId);
    const txt = document.getElementById(textId);
    if (!el || !txt) return;
    el.classList.remove("live", "error");
    if (state) el.classList.add(state);
    txt.textContent = msg;
  }

  function renderDashboard() {
    const items = ThroneFeeds.getStore().slice(0, THRONE_CONFIG.dashboardBriefingCount);
    ThroneFeeds.renderNewsList(dashBriefing, items, "No items yet — check config.js feed URLs.");
    document.getElementById("briefing-count").textContent =
      THRONE_CONFIG.topics.filter(t => t.enabled).length + " topics";
  }

  let newsPage = 1;
  function renderNewsFull() {
    const filtered = ThroneFeeds.getStore().filter(i => activeTopics.has(i.topic));
    const pageSize = THRONE_CONFIG.newsPageSize;
    const visible = filtered.slice(0, newsPage * pageSize);
    ThroneFeeds.renderNewsList(newsFullList, visible, "No stories match your selected topics right now.");

    const loadMoreBtn = document.getElementById("news-load-more-btn");
    if (filtered.length > visible.length) {
      loadMoreBtn.style.display = "inline-block";
      loadMoreBtn.textContent = `Load More (${filtered.length - visible.length} remaining)`;
    } else {
      loadMoreBtn.style.display = "none";
    }
  }

  // ---------- Blogger feed status list (Circle view) ----------
  const bloggerStatusEl = document.getElementById("blogger-feed-status");
  const bloggerRows = {};
  THRONE_CONFIG.bloggerFeeds.forEach(fc => {
    const row = document.createElement("div");
    row.className = "feed-status";
    row.innerHTML = `<span class="fdot"></span><span>${fc.name} — connecting…</span>`;
    bloggerStatusEl.appendChild(row);
    bloggerRows[fc.name] = row;
  });

  // ---------- boot news feeds (no auth required) ----------
  ThroneFeeds.loadAll({
    onTopicsUpdated: (results, store) => {
      const okCount = results.filter(r => r.ok).length;
      if (okCount === 0) {
        setStatus("news-feed-status", "news-feed-status-text", "error", "Couldn't reach any news feeds — check your connection or the RSS URLs in config.js.");
        setStatus("dashboard-feed-status", "dashboard-feed-status-text", "error", "Feeds unavailable right now.");
      } else {
        setStatus("news-feed-status", "news-feed-status-text", "live", `Live · ${okCount}/${results.length} topics connected`);
        setStatus("dashboard-feed-status", "dashboard-feed-status-text", "live", `Live · updated just now`);
      }
      renderDashboard();
      renderNewsFull();
    },
    onBloggerUpdated: (result, store) => {
      const row = bloggerRows[result.feed.name];
      if (row) {
        row.classList.add(result.ok ? "live" : "error");
        row.querySelector("span:last-child").textContent =
          result.ok
            ? `${result.feed.name} — ${result.entries.length} posts synced`
            : `${result.feed.name} — feed unreachable (${result.error})`;
      }
      renderDashboard();
    }
  });

  // register service worker for offline / installable use
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  bootRealm();

  // ================================================================
  // AUTH-GATED FEATURES: tasks, goals, Vault — everything that needs
  // to know WHO you are and sync across your devices.
  // ================================================================
  ThroneAuth.init((user) => {
    bootTasks();
    bootGoals();
    bootFitness();
    bootSplits();
    bootExerciseLogger();
    bootPlateCalculator();
    bootVault();
    bootSocial();
    bootCustomTopics();
    bootMarkets();
    bootSettings();
    bootAlliances();
    bootCalling();
    bootKings();
    bootFocusTimer();
    bootDashboardMomentum();
    bootNetWorth();
    bootFI();
    bootPlans();
    bootTreasuryTabs();
    bootEnvelopes();
    bootBills();
    bootSavingsGoals();
  });

  // ---------- TASKS ----------
  function priorityLabel(p) { return p ? p.toUpperCase() : "MED"; }

  function formatDueBadge(dueDate) {
    if (!dueDate) return "";
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(dueDate + "T00:00:00");
    const diffDays = Math.round((due - today) / 86400000);
    let label, color;
    if (diffDays < 0) { label = "OVERDUE"; color = "#c98c7f"; }
    else if (diffDays === 0) { label = "TODAY"; color = "var(--gold-bright)"; }
    else if (diffDays === 1) { label = "TOMORROW"; color = "var(--ivory-dim)"; }
    else { label = due.toLocaleDateString(undefined, { month: "short", day: "numeric" }); color = "var(--ivory-dim)"; }
    return `<span style="font-family:'Space Mono',monospace; font-size:9px; color:${color}; margin-left:8px;">${label}</span>`;
  }

  function renderTasks(tasks) {
    const list = document.getElementById("task-list");
    document.getElementById("task-count").textContent = tasks.length + " total";
    const doneCount = tasks.filter(t => t.done).length;
    document.getElementById("productivity-subhead").textContent =
      tasks.length ? `${doneCount} of ${tasks.length} cleared. The forge waits for no one.` : "Nothing queued yet — add your first task below.";

    if (!tasks.length) {
      list.innerHTML = `<div class="feed-empty">No tasks yet — add your first one below.</div>`;
      return;
    }

    const sorted = [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

    list.innerHTML = sorted.map(t => `
      <div class="task-row ${t.done ? "line-done" : ""}" data-id="${t.id}">
        <div class="check ${t.done ? "done" : ""}"></div>
        <div class="txt">${t.title}${formatDueBadge(t.due_date)}${t.recurrence && t.recurrence !== "none" ? ` <span style="color:var(--gold-dim); font-size:12px;">↻</span>` : ""}</div>
        <div class="prio ${t.priority} focus-select-task" data-title="${t.title.replace(/"/g, "&quot;")}" style="cursor:pointer;" title="Click to focus on this task">${priorityLabel(t.priority)}</div>
      </div>`).join("");

    list.querySelectorAll(".check").forEach(chk => {
      chk.addEventListener("click", async () => {
        const row = chk.closest(".task-row");
        const willBeDone = !chk.classList.contains("done");
        chk.classList.toggle("done");
        row.classList.toggle("line-done");
        await ThroneSync.toggleTask(row.dataset.id, willBeDone);
      });
    });

    list.querySelectorAll(".focus-select-task").forEach(el => {
      el.addEventListener("click", () => setFocusTask(el.dataset.title));
    });
  }

  async function bootTasks() {
    const statusEl = document.getElementById("task-sync-status");
    try {
      const tasks = await ThroneSync.loadTasks();
      renderTasks(tasks);
      statusEl.textContent = "Synced across your devices.";
    } catch (e) {
      statusEl.textContent = "Couldn't load tasks — check Supabase config.";
    }

    document.getElementById("new-task-btn").addEventListener("click", submitNewTask);
    document.getElementById("new-task-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitNewTask();
    });
    async function submitNewTask() {
      const input = document.getElementById("new-task-input");
      const title = input.value.trim();
      if (!title) return;
      const due = document.getElementById("new-task-due").value || null;
      const recurrence = document.getElementById("new-task-recurrence").value;
      const priority = document.getElementById("new-task-priority").value;
      input.value = "";
      document.getElementById("new-task-due").value = "";
      await ThroneSync.addTask(title, priority, due, recurrence);
    }

    document.getElementById("ritual-template-btn").addEventListener("click", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const ritual = [
        { title: "Morning review — check Dashboard & Vault", priority: "med" },
        { title: "Deep work block #1", priority: "high" },
        { title: "Training session", priority: "med" },
        { title: "Deep work block #2", priority: "high" },
        { title: "Evening review — clear inbox, log tomorrow", priority: "low" }
      ];
      for (const item of ritual) {
        await ThroneSync.addTask(item.title, item.priority, today, "daily");
      }
    });

    ThroneSync.subscribeTasks(async () => {
      const tasks = await ThroneSync.loadTasks();
      renderTasks(tasks);
    });
  }

  // ---------- FOCUS TIMER ----------
  let focusTask = null;
  let focusTotalSeconds = 25 * 60;
  let focusRemaining = focusTotalSeconds;
  let focusInterval = null;
  let focusRunning = false;
  const FOCUS_RING_CIRC = 440;

  function setFocusTask(title) {
    focusTask = title;
    document.getElementById("focus-task-label").textContent = title;
  }

  function updateFocusDisplay() {
    const m = Math.floor(focusRemaining / 60).toString().padStart(2, "0");
    const s = (focusRemaining % 60).toString().padStart(2, "0");
    document.getElementById("focus-seal").textContent = `${m}:${s}`;
    const progress = 1 - (focusRemaining / focusTotalSeconds);
    document.getElementById("focus-ring").style.strokeDashoffset = FOCUS_RING_CIRC * (1 - progress);
  }

  async function refreshSessionsToday() {
    try {
      const sessions = await ThroneSync.loadFocusSessions(1);
      const todayStr = new Date().toDateString();
      const todayCount = sessions.filter(s => new Date(s.completed_at).toDateString() === todayStr).length;
      document.getElementById("focus-sessions-today").textContent = `${todayCount} session${todayCount === 1 ? "" : "s"} logged today`;
    } catch (e) { /* silent */ }
  }

  function bootFocusTimer() {
    document.getElementById("focus-duration-select").addEventListener("change", (e) => {
      if (focusRunning) return;
      focusTotalSeconds = parseInt(e.target.value) * 60;
      focusRemaining = focusTotalSeconds;
      updateFocusDisplay();
    });

    document.getElementById("focus-start-btn").addEventListener("click", (e) => {
      if (focusRunning) {
        clearInterval(focusInterval);
        focusRunning = false;
        e.target.textContent = "Resume";
        return;
      }
      focusRunning = true;
      e.target.textContent = "Pause";
      focusInterval = setInterval(async () => {
        focusRemaining--;
        updateFocusDisplay();
        if (focusRemaining <= 0) {
          clearInterval(focusInterval);
          focusRunning = false;
          document.getElementById("focus-start-btn").textContent = "Start";
          await ThroneSync.logFocusSession(focusTask || "Untitled session", Math.round(focusTotalSeconds / 60));
          document.getElementById("focus-seal").textContent = "DONE";
          await refreshSessionsToday();
          setTimeout(() => {
            focusRemaining = focusTotalSeconds;
            updateFocusDisplay();
          }, 2000);
        }
      }, 1000);
    });

    document.getElementById("focus-reset-btn").addEventListener("click", () => {
      clearInterval(focusInterval);
      focusRunning = false;
      document.getElementById("focus-start-btn").textContent = "Start";
      focusRemaining = focusTotalSeconds;
      updateFocusDisplay();
    });

    updateFocusDisplay();
    refreshSessionsToday();
  }

  // ---------- WORKOUT LOGGER + PERSONAL RECORDS ----------
  function computePRs(logs) {
    const prs = {}; // exercise_name -> best log (by weight, tie-broken by reps)
    logs.forEach(l => {
      const current = prs[l.exercise_name];
      if (!current || l.weight > current.weight || (l.weight === current.weight && l.reps > current.reps)) {
        prs[l.exercise_name] = l;
      }
    });
    return prs;
  }

  async function renderExerciseData() {
    try {
      const logs = await ThroneSync.loadExerciseLogs(200);
      const prs = computePRs(logs);

      const listEl = document.getElementById("ex-log-list");
      if (!logs.length) {
        listEl.innerHTML = `<div class="feed-empty">No sets logged yet.</div>`;
      } else {
        listEl.innerHTML = logs.slice(0, 8).map(l => {
          const isPr = prs[l.exercise_name] && prs[l.exercise_name].id === l.id;
          return `
            <div class="task-row">
              <div class="txt">${l.exercise_name} — ${l.weight}kg × ${l.reps} × ${l.sets}${l.rpe ? ` @RPE${l.rpe}` : ""} ${isPr ? '<span style="color:var(--gold-bright);">★ PR</span>' : ""}</div>
              <div class="prio low">${ThroneFeeds.timeAgo(l.logged_at)}</div>
            </div>`;
        }).join("");
      }

      const prList = document.getElementById("pr-list");
      const prEntries = Object.values(prs).sort((a, b) => b.weight - a.weight);
      prList.innerHTML = prEntries.length
        ? prEntries.slice(0, 6).map(p => `
            <div class="holding-row"><div class="h-name">${p.exercise_name}</div><div class="h-val">${p.weight}kg × ${p.reps}</div></div>`).join("")
        : `<div class="feed-empty">Log a set to start tracking PRs.</div>`;
    } catch (e) {
      document.getElementById("ex-log-list").innerHTML = `<div class="feed-empty">Couldn't load workout logs.</div>`;
    }
  }

  async function bootExerciseLogger() {
    document.getElementById("ex-rpe-input").addEventListener("input", (e) => {
      document.getElementById("ex-rpe-label").textContent = "RPE " + e.target.value;
    });

    await renderExerciseData();
    ThroneSync.subscribeExerciseLogs(renderExerciseData);

    document.getElementById("ex-log-btn").addEventListener("click", async () => {
      const name = document.getElementById("ex-name-input").value.trim();
      const weight = parseFloat(document.getElementById("ex-weight-input").value);
      const reps = parseInt(document.getElementById("ex-reps-input").value);
      const sets = parseInt(document.getElementById("ex-sets-input").value) || 1;
      const rpe = parseFloat(document.getElementById("ex-rpe-input").value);
      if (!name || isNaN(weight) || isNaN(reps)) return;
      await ThroneSync.logExercise(name, weight, reps, sets, rpe);
      document.getElementById("ex-weight-input").value = "";
      document.getElementById("ex-reps-input").value = "";
    });
  }

  // ---------- PLATE CALCULATOR ----------
  function bootPlateCalculator() {
    const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]; // kg, standard Olympic set

    function calculate() {
      const target = parseFloat(document.getElementById("plate-target-input").value);
      const bar = parseFloat(document.getElementById("plate-bar-input").value) || 20;
      const resultEl = document.getElementById("plate-result");
      if (isNaN(target) || target < bar) {
        resultEl.textContent = "";
        return;
      }
      let perSide = (target - bar) / 2;
      if (perSide < 0) { resultEl.textContent = "Target must be more than the bar weight."; return; }

      const breakdown = [];
      for (const plate of PLATES) {
        let count = 0;
        while (perSide >= plate - 0.001) { perSide -= plate; count++; }
        if (count > 0) breakdown.push(`${count}×${plate}kg`);
      }
      resultEl.textContent = breakdown.length
        ? `Per side: ${breakdown.join(", ")}` + (perSide > 0.01 ? ` (+${perSide.toFixed(2)}kg unachievable with this set)` : "")
        : "Just the bar.";
    }

    document.getElementById("plate-target-input").addEventListener("input", calculate);
    document.getElementById("plate-bar-input").addEventListener("input", calculate);
  }

  // ---------- GOALS ----------
  function renderGoals(goals) {
    const list = document.getElementById("goal-list");
    if (!goals.length) {
      list.innerHTML = `<div class="feed-empty">No goals yet — add your first one below.</div>`;
      return;
    }
    list.innerHTML = goals.map(g => `
      <div class="goal-card">
        <div class="goal-top"><h4>${g.title}</h4><span class="pct">${g.progress_pct}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${g.progress_pct}%"></div></div>
        <div class="goal-meta">${g.meta || ""}</div>
      </div>`).join("");
  }

  async function bootGoals() {
    try {
      const goals = await ThroneSync.loadGoals();
      renderGoals(goals);
    } catch (e) {
      document.getElementById("goal-list").innerHTML =
        `<div class="feed-empty">Couldn't load goals — check Supabase config.</div>`;
    }

    document.getElementById("new-goal-btn").addEventListener("click", submitNewGoal);
    document.getElementById("new-goal-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitNewGoal();
    });
    async function submitNewGoal() {
      const input = document.getElementById("new-goal-input");
      const title = input.value.trim();
      if (!title) return;
      input.value = "";
      await ThroneSync.addGoal(title, 0, "Just started");
    }

    ThroneSync.subscribeGoals(async () => {
      const goals = await ThroneSync.loadGoals();
      renderGoals(goals);
    });
  }

  // ---------- FITNESS ----------
  const FITNESS_TARGETS = {
    squat_kg: 150, bench_kg: 110, deadlift_kg: 190,
    sleep_hours: 8, resting_hr: 50, hydration_l: 3, steps: 10000
  };
  const FITNESS_LABELS = {
    squat_kg: "SQUAT", bench_kg: "BENCH", deadlift_kg: "DEADLIFT",
    sleep_hours: "SLEEP", resting_hr: "RESTING HR", hydration_l: "HYDRATION", steps: "STEPS"
  };
  const FITNESS_UNITS = {
    squat_kg: "KG", bench_kg: "KG", deadlift_kg: "KG",
    sleep_hours: "H", resting_hr: "BPM", hydration_l: "L", steps: ""
  };

  function latestByMetric(logs) {
    const latest = {};
    // logs come back newest-first, so first hit per metric wins
    logs.forEach(l => { if (!(l.metric in latest)) latest[l.metric] = l; });
    return latest;
  }

  function fitnessBarRow(metric, entry) {
    const target = FITNESS_TARGETS[metric] || 100;
    const value = entry ? entry.value : 0;
    const pct = Math.max(2, Math.min(100, Math.round((value / target) * 100)));
    const unit = FITNESS_UNITS[metric];
    const displayVal = entry ? `${value}${unit}` : "—";
    return `
      <div class="bar-row">
        <div class="lbl">${FITNESS_LABELS[metric]}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="val">${displayVal}</div>
      </div>`;
  }

  function renderFitness(logs) {
    const latest = latestByMetric(logs);

    document.getElementById("lift-bars").innerHTML =
      ["squat_kg", "bench_kg", "deadlift_kg"].map(m => fitnessBarRow(m, latest[m])).join("");

    document.getElementById("vitals-bars").innerHTML =
      ["sleep_hours", "resting_hr", "hydration_l"].map(m => fitnessBarRow(m, latest[m])).join("");

    // ring: daily_load_pct is logged directly as a 0-100 value
    const loadEntry = latest["daily_load_pct"];
    const loadPct = loadEntry ? Math.max(0, Math.min(100, loadEntry.value)) : 0;
    document.getElementById("ring-pct").textContent = loadEntry ? `${Math.round(loadPct)}%` : "—%";
    const outerCirc = 377, innerCirc = 276;
    document.getElementById("ring-outer").style.strokeDashoffset = outerCirc - (outerCirc * loadPct / 100);
    document.getElementById("ring-inner").style.strokeDashoffset = innerCirc - (innerCirc * Math.min(100, loadPct * 0.9) / 100);

    const recentEl = document.getElementById("fitness-log-list");
    if (!logs.length) {
      recentEl.innerHTML = `<div class="feed-empty">No entries yet — log your first metric.</div>`;
    } else {
      recentEl.innerHTML = logs.slice(0, 8).map(l => `
        <div class="task-row"><div class="txt">${FITNESS_LABELS[l.metric] || l.metric.toUpperCase()}</div>
        <div class="prio med">${l.value}${FITNESS_UNITS[l.metric] || ""}</div></div>`).join("");
    }
  }

  async function bootFitness() {
    const statusEl = document.getElementById("fitness-sync-status");
    async function refresh() {
      try {
        const logs = await ThroneSync.loadFitnessLogs();
        renderFitness(logs);
        statusEl.textContent = "Synced across your devices.";
      } catch (e) {
        statusEl.textContent = "Couldn't load fitness logs — check Supabase config.";
      }
    }
    await refresh();

    document.getElementById("log-value-btn").addEventListener("click", async () => {
      const metric = document.getElementById("log-metric-select").value;
      const valInput = document.getElementById("log-value-input");
      const value = parseFloat(valInput.value);
      if (isNaN(value)) return;
      valInput.value = "";
      await ThroneSync.logMetric(metric, value);
    });

    document.getElementById("log-load-btn").addEventListener("click", async () => {
      const input = document.getElementById("log-load-input");
      const value = parseFloat(input.value);
      if (isNaN(value)) return;
      input.value = "";
      await ThroneSync.logMetric("daily_load_pct", value);
    });

    ThroneSync.subscribeFitness(refresh);
  }

  // ---------- WORKOUT SPLITS ----------
  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const STATUS_LABELS = { done: "DONE", today: "TODAY", rest: "REST", upcoming: "—" };
  const STATUS_PCT = { done: 100, today: 55, rest: 0, upcoming: 0 };

  function renderSplits(splits) {
    const byDay = {};
    splits.forEach(s => { byDay[s.day_of_week] = s; });

    document.getElementById("splits-week-label").textContent =
      "WEEK OF " + new Date(splits[0]?.week_start || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase();

    document.getElementById("splits-list").innerHTML = [0, 1, 2, 3, 4, 5, 6].map(day => {
      const s = byDay[day];
      const label = s ? s.label : "— NOT SET —";
      const status = s ? s.status : "upcoming";
      return `
        <div class="bar-row" data-day="${day}">
          <div class="lbl">${DAY_NAMES[day]} — ${label}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${STATUS_PCT[status]}%"></div></div>
          <div class="val split-status" data-day="${day}" data-status="${status}" style="cursor:pointer;">${STATUS_LABELS[status]}</div>
        </div>`;
    }).join("");

    // click the status to cycle it — quick way to mark a day done/today/rest
    document.querySelectorAll(".split-status").forEach(el => {
      el.addEventListener("click", async () => {
        const day = parseInt(el.dataset.day);
        const cycle = ["upcoming", "today", "done", "rest"];
        const next = cycle[(cycle.indexOf(el.dataset.status) + 1) % cycle.length];
        const existing = byDay[day];
        const label = existing ? existing.label : prompt("Label this day (e.g. PUSH, LEGS, REST):", "TRAINING");
        if (!label) return;
        await ThroneSync.upsertSplit(day, label, next);
      });
    });
  }

  async function bootSplits() {
    async function refresh() {
      try {
        const splits = await ThroneSync.loadSplits();
        renderSplits(splits);
      } catch (e) {
        document.getElementById("splits-list").innerHTML =
          `<div class="feed-empty">Couldn't load splits — check Supabase config.</div>`;
      }
    }
    await refresh();
    ThroneSync.subscribeSplits(refresh);
  }

  // ---------- SOCIAL (Spotify live + manual posts) ----------
  function msAgo(ts) {
    const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
    if (diffMin < 60) return diffMin + " MIN AGO";
    const diffHr = Math.round(diffMin / 60);
    return diffHr + " HR" + (diffHr > 1 ? "S" : "") + " AGO";
  }

  async function renderSpotify() {
    const statusEl = document.getElementById("spotify-status");
    const nowEl = document.getElementById("spotify-now-playing");
    const btn = document.getElementById("spotify-connect-btn");

    if (!ThroneSpotify.isConnected()) {
      statusEl.textContent = "not connected";
      btn.textContent = "Connect Spotify";
      return;
    }

    statusEl.textContent = "connected";
    btn.textContent = "Disconnect Spotify";

    try {
      const nowPlaying = await ThroneSpotify.getNowPlaying();
      if (nowPlaying && nowPlaying.item) {
        const track = nowPlaying.item;
        const artists = track.artists.map(a => a.name).join(", ");
        const img = track.album?.images?.[0]?.url;
        nowEl.innerHTML = `
          <div class="post-card" style="margin-bottom:0;">
            <div class="post-head">
              <div class="pav">${img ? `<img src="${img}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : "♪"}</div>
              <div><div class="pname">${track.name}</div><div class="ptime">${artists} · ${nowPlaying.is_playing ? "PLAYING NOW" : "PAUSED"}</div></div>
            </div>
          </div>`;
      } else {
        const recent = await ThroneSpotify.getRecentlyPlayed(1);
        const item = recent?.items?.[0];
        if (item) {
          nowEl.innerHTML = `<div class="feed-empty">Nothing playing right now. Last played: <b style="color:var(--gold-bright)">${item.track.name}</b> — ${msAgo(new Date(item.played_at).getTime())}</div>`;
        } else {
          nowEl.innerHTML = `<div class="feed-empty">Connected — nothing playing right now.</div>`;
        }
      }
    } catch (e) {
      nowEl.innerHTML = `<div class="feed-empty">Spotify session expired — reconnect above.</div>`;
    }
  }

  function renderSocialPosts(posts) {
    const listEl = document.getElementById("social-post-list");
    if (!posts.length) {
      listEl.innerHTML = `<div class="feed-empty">No posts logged yet — add one on the right.</div>`;
      return;
    }
    listEl.innerHTML = posts.map(p => `
      <div class="post-card">
        <div class="post-head">
          <div class="pav">${p.platform === "instagram" ? "IG" : "HK"}</div>
          <div><div class="pname">${p.caption || "(no caption)"}</div><div class="ptime">${msAgo(new Date(p.posted_at).getTime())} · ${p.platform.toUpperCase()}</div></div>
        </div>
        ${p.image_url ? `<div class="post-img" style="background-image:url('${p.image_url}'); background-size:cover; background-position:center;"></div>` : ""}
        ${p.link ? `<div class="post-actions"><a href="${p.link}" target="_blank" rel="noopener" style="color:var(--gold-bright); text-decoration:none;">↗ View post</a></div>` : ""}
      </div>`).join("");
  }

  async function bootSocial() {
    document.getElementById("spotify-connect-btn").addEventListener("click", () => {
      if (ThroneSpotify.isConnected()) {
        ThroneSpotify.disconnect();
        renderSpotify();
      } else {
        ThroneSpotify.connect();
      }
    });
    await renderSpotify();

    const statusEl = document.getElementById("social-sync-status");
    async function refreshPosts() {
      try {
        const posts = await ThroneSync.loadSocialPosts();
        renderSocialPosts(posts.filter(p => p.platform !== "instagram"));
      } catch (e) {
        statusEl.textContent = "Couldn't load posts — check Supabase config.";
      }
    }
    await refreshPosts();
    ThroneSync.subscribeSocialPosts(refreshPosts);

    document.getElementById("social-post-btn").addEventListener("click", async () => {
      const platform = document.getElementById("social-platform-select").value;
      const caption = document.getElementById("social-caption-input").value.trim();
      const link = document.getElementById("social-link-input").value.trim();
      const image = document.getElementById("social-image-input").value.trim();
      if (!caption && !link) return;
      document.getElementById("social-caption-input").value = "";
      document.getElementById("social-link-input").value = "";
      document.getElementById("social-image-input").value = "";
      await ThroneSync.addSocialPost(platform, caption, link || null, image || null);
      statusEl.textContent = "Posted.";
    });
  }

  // ---------- CUSTOM NEWS TOPICS (user-typed, per-account) ----------
  async function bootCustomTopics() {
    document.getElementById("news-load-more-btn").addEventListener("click", () => {
      newsPage++;
      renderNewsFull();
    });

    async function addChipForTopic(topicRow) {
      const chip = document.createElement("div");
      chip.className = "chip on";
      chip.textContent = topicRow.name + " ✕";
      chip.title = "Click to remove this topic";
      chip.addEventListener("click", async () => {
        activeTopics.delete(topicRow.name);
        await ThroneSync.removeCustomTopic(topicRow.id);
        chip.remove();
        newsPage = 1;
        renderNewsFull();
      });
      chipRow.insertBefore(chip, addChip);
      activeTopics.add(topicRow.name);

      try {
        const result = await ThroneFeeds.fetchRssTopic({ name: topicRow.name, rss: topicRow.rss_url });
        if (result.ok) {
          ThroneFeeds.addToStore(result.entries);
          renderDashboard();
          renderNewsFull();
        }
      } catch (e) { /* silent — chip stays, just no results yet */ }
    }

    try {
      const existing = await ThroneSync.loadCustomTopics();
      existing.forEach(addChipForTopic);
    } catch (e) { /* Supabase not configured yet — custom topics just won't load */ }

    document.getElementById("custom-topic-btn").addEventListener("click", submitCustomTopic);
    document.getElementById("custom-topic-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitCustomTopic();
    });
    async function submitCustomTopic() {
      const input = document.getElementById("custom-topic-input");
      const name = input.value.trim();
      if (!name) return;
      input.value = "";
      const { data, error } = await ThroneSync.addCustomTopic(name);
      if (!error) {
        const { data: fresh } = await supabaseClient
          .from("news_topics").select("*").eq("user_id", ThroneAuth.getUser().id)
          .order("created_at", { ascending: false }).limit(1);
        if (fresh && fresh[0]) addChipForTopic(fresh[0]);
      }
    }
  }

  // ---------- MARKETS ----------
  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "$—";
    return "$" + n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 4 : 2 });
  }

  async function renderWatchlist() {
    const container = document.getElementById("watchlist-cards");
    container.innerHTML = "";

    try {
      const cryptoPrices = await ThroneMarkets.getCryptoPrices(MARKET_CONFIG.watchlist.crypto);
      MARKET_CONFIG.watchlist.crypto.forEach(id => {
        const p = cryptoPrices[id];
        const card = document.createElement("div");
        card.className = "market-card";
        const change = p ? p.usd_24h_change : null;
        card.innerHTML = `
          <div class="m-name">${id}</div>
          <div class="m-price">${p ? fmtUsd(p.usd) : "—"}</div>
          <div class="m-change ${change >= 0 ? "up" : "down"}">${change != null ? (change >= 0 ? "▲" : "▼") + Math.abs(change).toFixed(2) + "%" : ""}</div>`;
        card.addEventListener("click", () => renderChart("crypto", id, id));
        container.appendChild(card);
      });
    } catch (e) {
      container.innerHTML += `<div class="feed-empty">Couldn't reach CoinGecko right now.</div>`;
    }

    if (ThroneMarkets.hasStockKey()) {
      try {
        const stockPrices = await ThroneMarkets.getStockPrices(MARKET_CONFIG.watchlist.stocks);
        MARKET_CONFIG.watchlist.stocks.forEach(sym => {
          const q = stockPrices[sym];
          const card = document.createElement("div");
          card.className = "market-card";
          const change = q ? parseFloat(q.percent_change) : null;
          card.innerHTML = `
            <div class="m-name">${sym}</div>
            <div class="m-price">${q ? fmtUsd(parseFloat(q.close)) : "—"}</div>
            <div class="m-change ${change >= 0 ? "up" : "down"}">${change != null ? (change >= 0 ? "▲" : "▼") + Math.abs(change).toFixed(2) + "%" : ""}</div>`;
          card.addEventListener("click", () => renderChart("stock", sym, sym));
          container.appendChild(card);
        });
      } catch (e) { /* stock card fetch failed silently, crypto still shows */ }
    } else {
      const card = document.createElement("div");
      card.className = "market-card";
      card.innerHTML = `<div class="m-name">STOCKS</div><div class="feed-empty" style="padding:8px 0;">Add a free Twelve Data key in <code>market-config.js</code> to see live stock prices.</div>`;
      container.appendChild(card);
    }
  }

  let portfolioChart = null;
  async function renderChart(assetType, symbol, label) {
    document.getElementById("chart-symbol-label").textContent = label.toUpperCase();
    const canvas = document.getElementById("portfolio-chart");
    let points = [];
    try {
      points = assetType === "crypto"
        ? await ThroneMarkets.getCryptoChart(symbol, 30)
        : await ThroneMarkets.getStockChart(symbol);
    } catch (e) { points = []; }

    if (portfolioChart) portfolioChart.destroy();
    portfolioChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: points.map(p => new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
        datasets: [{
          data: points.map(p => p.y),
          borderColor: "#c9a84c",
          backgroundColor: "rgba(201,168,76,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#a9a290", maxTicksLimit: 6 }, grid: { color: "#2a251c" } },
          y: { ticks: { color: "#a9a290" }, grid: { color: "#2a251c" } }
        }
      }
    });
  }

  async function renderPortfolio(holdings) {
    const listEl = document.getElementById("portfolio-list");
    if (!holdings.length) {
      listEl.innerHTML = `<div class="feed-empty">No holdings yet — add one below.</div>`;
      document.getElementById("portfolio-total").textContent = "$—";
      return;
    }

    const cryptoIds = holdings.filter(h => h.asset_type === "crypto").map(h => h.symbol);
    const stockSyms = holdings.filter(h => h.asset_type === "stock").map(h => h.symbol);

    let cryptoPrices = {}, stockPrices = {};
    try { cryptoPrices = await ThroneMarkets.getCryptoPrices(cryptoIds); } catch (e) {}
    if (ThroneMarkets.hasStockKey()) {
      try { stockPrices = await ThroneMarkets.getStockPrices(stockSyms); } catch (e) {}
    }

    let total = 0;
    listEl.innerHTML = holdings.map(h => {
      let price = null;
      if (h.asset_type === "crypto" && cryptoPrices[h.symbol]) price = cryptoPrices[h.symbol].usd;
      if (h.asset_type === "stock" && stockPrices[h.symbol]) price = parseFloat(stockPrices[h.symbol].close);
      const value = price != null ? price * h.quantity : null;
      if (value != null) total += value;
      return `
        <div class="holding-row" data-type="${h.asset_type}" data-symbol="${h.symbol}" data-label="${h.label || h.symbol}">
          <div class="h-name">${h.label || h.symbol} <span style="color:var(--ivory-dim); font-size:12px;">× ${h.quantity}</span></div>
          <div class="h-val">${value != null ? fmtUsd(value) : (h.asset_type === "stock" ? "needs API key" : "—")}</div>
        </div>`;
    }).join("");

    document.getElementById("portfolio-total").textContent = fmtUsd(total);
    lastPortfolioTotal = total;
    refreshNetWorth();

    listEl.querySelectorAll(".holding-row").forEach(row => {
      row.addEventListener("click", () => renderChart(row.dataset.type, row.dataset.symbol, row.dataset.label));
    });
  }

  async function bootMarkets() {
    await renderWatchlist();

    const statusEl = document.getElementById("portfolio-sync-status");
    async function refreshPortfolio() {
      try {
        const holdings = await ThroneSync.loadPortfolio();
        await renderPortfolio(holdings);
      } catch (e) {
        statusEl.textContent = "Couldn't load portfolio — check Supabase config.";
      }
    }
    await refreshPortfolio();
    ThroneSync.subscribePortfolio(refreshPortfolio);

    document.getElementById("holding-add-btn").addEventListener("click", async () => {
      const type = document.getElementById("holding-type-select").value;
      const symbol = document.getElementById("holding-symbol-input").value.trim().toLowerCase();
      const label = document.getElementById("holding-label-input").value.trim();
      const qty = parseFloat(document.getElementById("holding-qty-input").value);
      if (!symbol || isNaN(qty)) return;
      document.getElementById("holding-symbol-input").value = "";
      document.getElementById("holding-label-input").value = "";
      document.getElementById("holding-qty-input").value = "";
      await ThroneSync.addHolding(type, type === "stock" ? symbol.toUpperCase() : symbol, label, qty);
      statusEl.textContent = "Added.";
    });
  }

  // ---------- DASHBOARD MOMENTUM (real data, not placeholders) ----------
  async function bootDashboardMomentum() {
    const bars = document.getElementById("momentum-bars");
    const deadlineEl = document.getElementById("nearest-deadline");

    try {
      const [sessions, splits, tasks, fitness, goals] = await Promise.all([
        ThroneSync.loadFocusSessions(7),
        ThroneSync.loadSplits(),
        ThroneSync.loadTasks(),
        ThroneSync.loadFitnessLogs(30),
        ThroneSync.loadGoals()
      ]);

      // Steps: today's logged steps value (from Fitness Quick Log → steps)
      const stepsToday = fitness
        .filter(f => f.metric === "steps" && new Date(f.logged_at).toDateString() === new Date().toDateString())
        .reduce((max, f) => Math.max(max, f.value), 0);
      const stepsEl = document.getElementById("dash-steps-value");
      const stepsDeltaEl = document.getElementById("dash-steps-delta");
      if (stepsToday > 0) {
        stepsEl.innerHTML = `${Math.round(stepsToday).toLocaleString()} <small>/ 10k</small>`;
        stepsDeltaEl.textContent = stepsToday >= 10000 ? "Goal reached" : `${Math.round((stepsToday / 10000) * 100)}% of goal`;
      } else {
        stepsEl.innerHTML = `— <small>/ 10k</small>`;
        stepsDeltaEl.textContent = "No steps logged today";
      }

      // Deep Work: total focus minutes this week vs a 600min (10hr) target
      const deepWorkMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
      const deepWorkPct = Math.min(100, Math.round((deepWorkMinutes / 600) * 100));

      // Training: fraction of this week's splits marked done
      const doneCount = splits.filter(s => s.status === "done").length;
      const trainingPct = splits.length ? Math.round((doneCount / splits.length) * 100) : 0;

      // Tasks: completion ratio of everything currently in the queue
      const tasksDonePct = tasks.length ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0;

      // Sleep: average logged sleep_hours vs an 8hr target
      const sleepLogs = fitness.filter(f => f.metric === "sleep_hours");
      const avgSleep = sleepLogs.length ? sleepLogs.reduce((s, f) => s + f.value, 0) / sleepLogs.length : 0;
      const sleepPct = Math.min(100, Math.round((avgSleep / 8) * 100));

      const rows = [
        ["TRAINING", trainingPct, trainingPct + "%"],
        ["DEEP WORK", deepWorkPct, Math.round(deepWorkMinutes / 60 * 10) / 10 + "H"],
        ["TASKS", tasksDonePct, tasksDonePct + "%"],
        ["SLEEP", sleepPct, sleepLogs.length ? avgSleep.toFixed(1) + "H" : "—"]
      ];
      bars.innerHTML = rows.map(([lbl, pct, val]) => `
        <div class="bar-row"><div class="lbl">${lbl}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="val">${val}</div></div>`).join("");

      // Nearest deadline: the incomplete goal closest to done
      const incompleteGoals = goals.filter(g => g.progress_pct < 100).sort((a, b) => b.progress_pct - a.progress_pct);
      if (incompleteGoals.length) {
        const g = incompleteGoals[0];
        deadlineEl.innerHTML = `
          <div class="goal-meta" style="margin-bottom:6px;">${g.title.toUpperCase()}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${g.progress_pct}%"></div></div>
          <div class="goal-meta">${g.progress_pct}% · ${g.meta || "IN PROGRESS"}</div>`;
      } else {
        deadlineEl.innerHTML = `<div class="feed-empty" style="padding:8px 0;">No goals in progress — add one in Goals.</div>`;
      }
    } catch (e) {
      bars.innerHTML = `<div class="feed-empty">Couldn't load momentum data — check Supabase config.</div>`;
    }
  }

  // ---------- NET WORTH ----------
  let lastPortfolioTotal = 0;

  async function refreshNetWorth() {
    try {
      const assets = await ThroneSync.loadOtherAssets();
      const byCategory = {};
      assets.forEach(a => { byCategory[a.category] = (byCategory[a.category] || 0) + parseFloat(a.value); });
      const otherTotal = Object.values(byCategory).reduce((a, b) => a + b, 0);
      const grandTotal = otherTotal + lastPortfolioTotal;

      document.getElementById("networth-total").textContent = fmtUsd(grandTotal);

      const listEl = document.getElementById("networth-breakdown");
      const rows = [
        ["Portfolio (live)", lastPortfolioTotal],
        ...Object.entries(byCategory).map(([cat, val]) => [cat.charAt(0).toUpperCase() + cat.slice(1), val])
      ];
      listEl.innerHTML = rows.map(([label, val]) => `
        <div class="holding-row"><div class="h-name">${label}</div><div class="h-val">${fmtUsd(val)}</div></div>`).join("");

      window.__throneNetWorth = grandTotal; // used by FI panel
      renderFI();
    } catch (e) { /* silent — FI/networth just won't update this pass */ }
  }

  async function bootNetWorth() {
    await refreshNetWorth();
    ThroneSync.subscribeOtherAssets(refreshNetWorth);

    document.getElementById("asset-add-btn").addEventListener("click", async () => {
      const category = document.getElementById("asset-category-select").value;
      const label = document.getElementById("asset-label-input").value.trim();
      const value = parseFloat(document.getElementById("asset-value-input").value);
      if (!label || isNaN(value)) return;
      document.getElementById("asset-label-input").value = "";
      document.getElementById("asset-value-input").value = "";
      await ThroneSync.addOtherAsset(category, label, value);
    });
  }

  // ---------- FINANCIAL INDEPENDENCE ----------
  let fiAnnualExpenses = null;

  function renderFI() {
    const pctEl = document.getElementById("fi-pct");
    const detailEl = document.getElementById("fi-detail");
    const ringEl = document.getElementById("fi-ring");
    const circ = 345;

    if (!fiAnnualExpenses) {
      pctEl.textContent = "—%";
      detailEl.textContent = "Set your annual expenses to calculate your FI Number (25× rule).";
      ringEl.style.strokeDashoffset = circ;
      return;
    }
    const fiNumber = fiAnnualExpenses * 25;
    const netWorth = window.__throneNetWorth || 0;
    const pct = Math.min(100, Math.round((netWorth / fiNumber) * 100));
    pctEl.textContent = pct + "%";
    ringEl.style.strokeDashoffset = circ - (circ * pct / 100);
    detailEl.textContent = `FI Number: ${fmtUsd(fiNumber)} · Net worth: ${fmtUsd(netWorth)}`;
  }

  async function bootFI() {
    try {
      fiAnnualExpenses = await ThroneSync.loadFiExpenses();
      if (fiAnnualExpenses) document.getElementById("fi-expenses-input").value = fiAnnualExpenses;
    } catch (e) { /* silent */ }
    renderFI();

    document.getElementById("fi-save-btn").addEventListener("click", async () => {
      const val = parseFloat(document.getElementById("fi-expenses-input").value);
      if (isNaN(val)) return;
      fiAnnualExpenses = val;
      await ThroneSync.updateFiExpenses(val);
      renderFI();
    });
  }

  // ---------- AUTOINVEST PLANS ----------
  function daysUntil(dateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(dateStr + "T00:00:00");
    return Math.round((due - today) / 86400000);
  }

  async function renderPlans() {
    const listEl = document.getElementById("plans-list");
    try {
      const plans = await ThroneSync.loadInvestmentPlans();
      if (!plans.length) {
        listEl.innerHTML = `<div class="feed-empty">No plans yet.</div>`;
        return;
      }
      listEl.innerHTML = plans.map(p => {
        const days = daysUntil(p.next_due);
        const dueLabel = days < 0 ? "OVERDUE" : days === 0 ? "DUE TODAY" : `in ${days}d`;
        return `
        <div class="holding-row" data-id="${p.id}" style="flex-direction:column; align-items:stretch; gap:6px;">
          <div style="display:flex; justify-content:space-between;">
            <div class="h-name">${p.label}</div>
            <div class="h-val" style="color:${days <= 0 ? "var(--gold-bright)" : "var(--ivory-dim)"};">${dueLabel}</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="h-val">$${p.amount} / ${p.frequency}${p.holding ? " → " + (p.holding.label || p.holding.symbol) : ""}</div>
            <button class="ally-btn log-contribution-btn" data-id="${p.id}" style="margin-left:0;">Log</button>
          </div>
        </div>`;
      }).join("");

      listEl.querySelectorAll(".log-contribution-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const plan = plans.find(p => p.id === btn.dataset.id);
          let qty = null;
          if (plan.holding_id) {
            const input = prompt(`Quantity of ${plan.holding.label || plan.holding.symbol} purchased this contribution:`, "0");
            qty = parseFloat(input);
            if (isNaN(qty)) qty = null;
          }
          await ThroneSync.logPlanContribution(plan, qty);
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="feed-empty">Couldn't load plans.</div>`;
    }
  }

  async function bootPlans() {
    await renderPlans();
    ThroneSync.subscribeInvestmentPlans(renderPlans);

    document.getElementById("plan-add-btn").addEventListener("click", async () => {
      const label = document.getElementById("plan-label-input").value.trim();
      const amount = parseFloat(document.getElementById("plan-amount-input").value);
      const frequency = document.getElementById("plan-frequency-select").value;
      if (!label || isNaN(amount)) return;
      document.getElementById("plan-label-input").value = "";
      document.getElementById("plan-amount-input").value = "";
      const nextDue = new Date().toISOString().slice(0, 10);
      await ThroneSync.addInvestmentPlan(label, null, amount, frequency, nextDue);
    });
  }

  // ---------- TREASURY TABS (Invest / Budget) ----------
  function bootTreasuryTabs() {
    document.querySelectorAll(".treasury-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".treasury-tab").forEach(t => t.classList.toggle("on", t === tab));
        document.getElementById("treasury-invest").style.display = tab.dataset.tab === "invest" ? "block" : "none";
        document.getElementById("treasury-budget").style.display = tab.dataset.tab === "budget" ? "block" : "none";
      });
    });
  }

  // ---------- BUDGET ENVELOPES ----------
  async function renderEnvelopes() {
    const listEl = document.getElementById("envelope-list");
    try {
      const envelopes = await ThroneSync.loadEnvelopes();
      if (!envelopes.length) {
        listEl.innerHTML = `<div class="feed-empty">No envelopes yet — add a category below.</div>`;
        return;
      }
      const spending = await ThroneSync.loadEnvelopeSpending(envelopes.map(e => e.id));
      listEl.innerHTML = envelopes.map(e => {
        const spent = spending[e.id] || 0;
        const pct = Math.min(100, Math.round((spent / e.monthly_budget) * 100));
        const over = spent > e.monthly_budget;
        return `
          <div class="envelope-row" data-id="${e.id}">
            <div class="e-top"><span class="e-name">${e.label}</span><span class="e-amt ${over ? "over" : ""}">${fmtUsd(spent)} / ${fmtUsd(e.monthly_budget)}</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%; ${over ? "background:linear-gradient(90deg,#8c3b34,#c98c7f);" : ""}"></div></div>
            <div class="e-actions">
              <button class="ally-btn log-expense-btn" data-id="${e.id}" data-label="${e.label}">Log Expense</button>
              <button class="ally-btn decline remove-envelope-btn" data-id="${e.id}">Remove</button>
            </div>
          </div>`;
      }).join("");

      listEl.querySelectorAll(".log-expense-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const amt = parseFloat(prompt(`Log an expense for ${btn.dataset.label}:`, ""));
          if (isNaN(amt)) return;
          await ThroneSync.logEnvelopeExpense(btn.dataset.id, amt, null);
        });
      });
      listEl.querySelectorAll(".remove-envelope-btn").forEach(btn => {
        btn.addEventListener("click", async () => { await ThroneSync.removeEnvelope(btn.dataset.id); });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="feed-empty">Couldn't load envelopes.</div>`;
    }
  }

  async function bootEnvelopes() {
    await renderEnvelopes();
    ThroneSync.subscribeEnvelopes(renderEnvelopes);

    document.getElementById("envelope-add-btn").addEventListener("click", async () => {
      const label = document.getElementById("envelope-label-input").value.trim();
      const budget = parseFloat(document.getElementById("envelope-budget-input").value);
      if (!label || isNaN(budget)) return;
      document.getElementById("envelope-label-input").value = "";
      document.getElementById("envelope-budget-input").value = "";
      await ThroneSync.addEnvelope(label, budget);
    });
  }

  // ---------- BILLS ----------
  function nextBillDate(dueDay) {
    const today = new Date();
    let due = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    return due;
  }

  async function renderBills() {
    const listEl = document.getElementById("bills-list");
    try {
      const bills = await ThroneSync.loadBills();
      const annualTotal = bills.reduce((sum, b) => sum + parseFloat(b.amount) * 12, 0);
      document.getElementById("bills-annual-total").textContent = fmtUsd(annualTotal) + " / yr";

      if (!bills.length) {
        listEl.innerHTML = `<div class="feed-empty">No bills tracked yet.</div>`;
        return;
      }
      const withDates = bills.map(b => ({ ...b, nextDate: nextBillDate(b.due_day) })).sort((a, b) => a.nextDate - b.nextDate);
      listEl.innerHTML = withDates.map(b => {
        const daysAway = Math.round((b.nextDate - new Date()) / 86400000);
        const soon = daysAway <= 5;
        return `
          <div class="bill-row" data-id="${b.id}">
            <div><div class="b-name">${b.label}</div><div class="b-due ${soon ? "soon" : ""}">${fmtUsd(b.amount)} · due ${b.nextDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div></div>
            <div><button class="ally-btn mark-paid-btn" data-id="${b.id}">Paid</button><button class="ally-btn decline remove-bill-btn" data-id="${b.id}">×</button></div>
          </div>`;
      }).join("");

      listEl.querySelectorAll(".mark-paid-btn").forEach(btn => btn.addEventListener("click", async () => {
        await ThroneSync.markBillPaid(btn.dataset.id);
      }));
      listEl.querySelectorAll(".remove-bill-btn").forEach(btn => btn.addEventListener("click", async () => {
        await ThroneSync.removeBill(btn.dataset.id);
      }));
    } catch (e) {
      listEl.innerHTML = `<div class="feed-empty">Couldn't load bills.</div>`;
    }
  }

  async function bootBills() {
    await renderBills();
    ThroneSync.subscribeBills(renderBills);

    document.getElementById("bill-add-btn").addEventListener("click", async () => {
      const label = document.getElementById("bill-label-input").value.trim();
      const amount = parseFloat(document.getElementById("bill-amount-input").value);
      const day = parseInt(document.getElementById("bill-day-input").value);
      if (!label || isNaN(amount) || isNaN(day) || day < 1 || day > 31) return;
      document.getElementById("bill-label-input").value = "";
      document.getElementById("bill-amount-input").value = "";
      document.getElementById("bill-day-input").value = "";
      await ThroneSync.addBill(label, amount, day, "other");
    });
  }

  // ---------- SAVINGS GOALS ----------
  async function renderSavingsGoals() {
    const listEl = document.getElementById("savings-goals-list");
    try {
      const goals = await ThroneSync.loadSavingsGoals();
      if (!goals.length) {
        listEl.innerHTML = `<div class="feed-empty">No savings goals yet — add one below.</div>`;
        return;
      }
      listEl.innerHTML = goals.map(g => {
        const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
        return `
          <div class="savings-card" data-id="${g.id}" data-current="${g.current_amount}">
            <h4>${g.label}</h4>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
            <div class="goal-meta" style="margin:8px 0;">${fmtUsd(g.current_amount)} of ${fmtUsd(g.target_amount)} · ${pct}%</div>
            ${g.target_date ? `<div class="goal-meta">TARGET: ${new Date(g.target_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>` : ""}
            <button class="ally-btn contribute-savings-btn" data-id="${g.id}" style="margin-left:0; margin-top:10px;">Add Contribution</button>
          </div>`;
      }).join("");

      listEl.querySelectorAll(".contribute-savings-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const card = btn.closest(".savings-card");
          const addAmt = parseFloat(prompt("Add how much to this goal?", ""));
          if (isNaN(addAmt)) return;
          await ThroneSync.contributeSavingsGoal(card.dataset.id, parseFloat(card.dataset.current), addAmt);
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="feed-empty">Couldn't load savings goals.</div>`;
    }
  }

  async function bootSavingsGoals() {
    await renderSavingsGoals();
    ThroneSync.subscribeSavingsGoals(renderSavingsGoals);

    document.getElementById("savings-add-btn").addEventListener("click", async () => {
      const label = document.getElementById("savings-label-input").value.trim();
      const target = parseFloat(document.getElementById("savings-target-input").value);
      const date = document.getElementById("savings-date-input").value || null;
      if (!label || isNaN(target)) return;
      document.getElementById("savings-label-input").value = "";
      document.getElementById("savings-target-input").value = "";
      document.getElementById("savings-date-input").value = "";
      await ThroneSync.addSavingsGoal(label, target, date);
    });
  }

  // ---------- SETTINGS ----------
  async function bootSettings() {
    const user = ThroneAuth.getUser();
    document.getElementById("settings-email").textContent = user.email;
    document.getElementById("settings-origin").textContent = window.location.origin + window.location.pathname;

    const { data: profile } = await supabaseClient
      .from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    document.getElementById("settings-display-name").value = (profile && profile.display_name) || "";

    // ---- profile name ----
    document.getElementById("settings-save-name-btn").addEventListener("click", async () => {
      const name = document.getElementById("settings-display-name").value.trim();
      const statusEl = document.getElementById("settings-name-status");
      if (!name) return;
      statusEl.textContent = "Saving…";
      const { error } = await ThroneSync.updateDisplayName(name);
      statusEl.textContent = error ? "Couldn't save — try again." : "Saved.";
    });

    // ---- spotify status ----
    function refreshSpotifySettingsStatus() {
      const connected = ThroneSpotify.isConnected();
      document.getElementById("settings-spotify-status").textContent = connected ? "connected" : "not connected";
      document.getElementById("settings-spotify-btn").textContent = connected ? "Disconnect" : "Connect";
    }
    refreshSpotifySettingsStatus();
    document.getElementById("settings-spotify-btn").addEventListener("click", () => {
      if (ThroneSpotify.isConnected()) {
        ThroneSpotify.disconnect();
        refreshSpotifySettingsStatus();
      } else {
        ThroneSpotify.connect();
      }
    });

    // ---- change passphrase ----
    document.getElementById("settings-change-pass-btn").addEventListener("click", async () => {
      const statusEl = document.getElementById("settings-pass-status");
      const pass = document.getElementById("settings-new-pass").value;
      const confirm = document.getElementById("settings-new-pass-confirm").value;
      if (!pass || pass.length < 8) { statusEl.textContent = "Use at least 8 characters."; return; }
      if (pass !== confirm) { statusEl.textContent = "Passphrases don't match."; return; }

      statusEl.textContent = "Updating…";
      try {
        const backup = await VaultCrypto.createBackup(pass);
        await supabaseClient.from("profiles").update({
          wrapped_private_key: backup.wrappedPrivateKey,
          key_salt: backup.salt,
          key_iv: backup.iv
        }).eq("id", user.id);
        document.getElementById("settings-new-pass").value = "";
        document.getElementById("settings-new-pass-confirm").value = "";
        statusEl.textContent = "Passphrase updated. Use the new one on any device you unlock from now on.";
      } catch (e) {
        statusEl.textContent = "Couldn't update — " + e.message;
      }
    });

    // ---- export all data ----
    document.getElementById("settings-export-btn").addEventListener("click", async () => {
      const statusEl = document.getElementById("settings-export-status");
      statusEl.textContent = "Gathering your data…";
      try {
        const [tasks, goals, fitness, splits, social, topics, portfolio] = await Promise.all([
          ThroneSync.loadTasks(), ThroneSync.loadGoals(), ThroneSync.loadFitnessLogs(500),
          ThroneSync.loadSplits(), ThroneSync.loadSocialPosts(), ThroneSync.loadCustomTopics(),
          ThroneSync.loadPortfolio()
        ]);
        const exportData = {
          exported_at: new Date().toISOString(),
          email: user.email,
          tasks, goals, fitness_logs: fitness, workout_splits: splits,
          social_posts: social, news_topics: topics, portfolio_holdings: portfolio,
          note: "Vault messages are not included — they're encrypted and only readable via the Vault itself."
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `the-throne-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        statusEl.textContent = "Downloaded.";
      } catch (e) {
        statusEl.textContent = "Export failed — check Supabase config.";
      }
    });

    // ---- sign out ----
    document.getElementById("settings-signout-btn").addEventListener("click", async () => {
      if (confirm("Sign out of The Throne on this device?")) {
        await ThroneAuth.signOut();
        window.location.reload();
      }
    });
  }

  // ---------- THE REALM (KINGDOMS) ----------
  const realmStore = {}; // kingdomId -> entries[]
  let activeKingdom = null; // null = merged "Decrees" view

  function kingdomEntryHtml(entry, kingdom) {
    const thumbInner = entry.thumbnail
      ? `<img src="${entry.thumbnail}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<svg viewBox=&quot;0 0 24 24&quot; style=&quot;stroke:${kingdom.accentBright}&quot;><path d=&quot;M12 2l2.5 5 5.5.7-4 4 1 5.5L12 14.5 7 17.2l1-5.5-4-4L9.5 7z&quot;/></svg>';">`
      : `<svg viewBox="0 0 24 24" style="stroke:${kingdom.accentBright};"><path d="M12 2l2.5 5 5.5.7-4 4 1 5.5L12 14.5 7 17.2l1-5.5-4-4L9.5 7z"/></svg>`;
    return `
      <a class="news-item" href="${entry.link}" target="_blank" rel="noopener" style="border-left:2px solid ${kingdom.accent}; padding-left:12px;">
        <div class="news-thumb" style="border-color:${kingdom.accent};">${thumbInner}</div>
        <div class="news-body">
          <div class="topic" style="color:${kingdom.accentBright};">${kingdom.kingdomTitle.toUpperCase()}</div>
          <h4>${entry.title}</h4>
          <div class="meta">${ThroneFeeds.timeAgo(entry.date)}</div>
        </div>
      </a>`;
  }

  function renderRealmFeed() {
    const listEl = document.getElementById("realm-feed-list");
    let entries = [];

    if (activeKingdom) {
      const k = THRONE_CONFIG.kingdoms.find(k => k.id === activeKingdom);
      entries = (realmStore[activeKingdom] || []).map(e => ({ entry: e, kingdom: k }));
    } else {
      THRONE_CONFIG.kingdoms.forEach(k => {
        (realmStore[k.id] || []).forEach(e => entries.push({ entry: e, kingdom: k }));
      });
    }

    entries.sort((a, b) => new Date(b.entry.date) - new Date(a.entry.date));

    if (realmSearchQuery) {
      entries = entries.filter(x => x.entry.title.toLowerCase().includes(realmSearchQuery));
    }

    if (!entries.length) {
      listEl.innerHTML = `<div class="feed-empty">${realmSearchQuery ? "No decrees match that search." : "No decrees yet from this Kingdom — check config.js feed URLs."}</div>`;
      return;
    }
    listEl.innerHTML = entries.slice(0, 30).map(x => kingdomEntryHtml(x.entry, x.kingdom)).join("");
  }

  function renderKingdomCards() {
    const container = document.getElementById("kingdom-cards");
    container.innerHTML = THRONE_CONFIG.kingdoms.map(k => `
      <div class="kingdom-card c3" data-id="${k.id}" style="--k-accent:${k.accent}; --k-accent-bright:${k.accentBright};">
        <div class="kingdom-seal">${k.kingdomTitle.charAt(4)}</div>
        <h4>${k.kingdomTitle}</h4>
        <div class="k-tagline">${k.tagline}</div>
        <div class="k-count" id="kcount-${k.id}">— posts</div>
      </div>`).join("");

    container.querySelectorAll(".kingdom-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        activeKingdom = activeKingdom === id ? null : id;
        container.querySelectorAll(".kingdom-card").forEach(c => c.classList.remove("active"));
        if (activeKingdom) card.classList.add("active");
        document.querySelectorAll("#kingdom-filter-row .chip").forEach(c => {
          c.classList.toggle("on", c.dataset.id === activeKingdom);
        });
        renderRealmFeed();
      });
    });
  }

  function renderKingdomFilterRow() {
    const row = document.getElementById("kingdom-filter-row");
    const decreesChip = document.createElement("div");
    decreesChip.className = "chip on";
    decreesChip.textContent = "All Decrees";
    decreesChip.addEventListener("click", () => {
      activeKingdom = null;
      document.querySelectorAll(".kingdom-card").forEach(c => c.classList.remove("active"));
      document.querySelectorAll("#kingdom-filter-row .chip").forEach(c => c.classList.remove("on"));
      decreesChip.classList.add("on");
      renderRealmFeed();
    });
    row.appendChild(decreesChip);

    THRONE_CONFIG.kingdoms.forEach(k => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.dataset.id = k.id;
      chip.textContent = k.kingdomTitle;
      chip.style.setProperty("--k-accent", k.accent);
      chip.addEventListener("click", () => {
        activeKingdom = k.id;
        document.querySelectorAll(".kingdom-card").forEach(c => c.classList.toggle("active", c.dataset.id === k.id));
        document.querySelectorAll("#kingdom-filter-row .chip").forEach(c => c.classList.toggle("on", c === chip));
        renderRealmFeed();
      });
      row.appendChild(chip);
    });
  }

  async function bootRealm() {
    renderKingdomCards();
    renderKingdomFilterRow();
    bootRealmSearch();

    let okCount = 0;
    const results = await Promise.all(THRONE_CONFIG.kingdoms.map(k => new Promise(resolve => {
      ThroneFeeds.fetchBloggerFeed({ name: k.blogName, label: k.kingdomTitle, url: k.url }, (result) => {
        if (result.ok) {
          realmStore[k.id] = result.entries;
          okCount++;
          const countEl = document.getElementById(`kcount-${k.id}`);
          if (countEl) countEl.textContent = `${result.entries.length} posts`;
        } else {
          const countEl = document.getElementById(`kcount-${k.id}`);
          if (countEl) countEl.textContent = "unreachable";
        }
        renderRealmFeed();
        renderRealmStats();
        resolve(result);
      });
    })));

    const statusEl = document.getElementById("realm-feed-status");
    const statusText = document.getElementById("realm-feed-status-text");
    if (okCount === 0) {
      statusEl.classList.add("error");
      statusText.textContent = "Couldn't reach any Kingdom — check feed URLs in config.js.";
    } else {
      statusEl.classList.add("live");
      statusText.textContent = `Live · ${okCount}/${THRONE_CONFIG.kingdoms.length} Kingdoms connected`;
    }
  }

  function renderRealmStats() {
    const row = document.getElementById("realm-stats-row");
    const allEntries = Object.values(realmStore).flat();
    if (!allEntries.length) { row.innerHTML = ""; return; }

    const totalPosts = allEntries.length;
    const sorted = [...allEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
    const mostRecent = sorted[0];

    const countsByKingdom = THRONE_CONFIG.kingdoms.map(k => ({ k, count: (realmStore[k.id] || []).length }));
    const busiest = countsByKingdom.sort((a, b) => b.count - a.count)[0];

    const now = Date.now();
    const last30 = allEntries.filter(e => (now - new Date(e.date).getTime()) < 30 * 24 * 3600 * 1000).length;

    row.innerHTML = `
      <div class="panel realm-stat"><div class="rk">Total Posts</div><div class="rv">${totalPosts}</div></div>
      <div class="panel realm-stat"><div class="rk">Last 30 Days</div><div class="rv">${last30}</div></div>
      <div class="panel realm-stat"><div class="rk">Busiest Kingdom</div><div class="rv" style="font-size:18px; color:${busiest.k.accentBright};">${busiest.k.kingdomTitle.replace("The ", "").replace(" Kingdom", "")}</div></div>
      <div class="panel realm-stat"><div class="rk">Latest Decree</div><div class="rv" style="font-size:13px; line-height:1.3; font-family:'Cormorant Garamond',serif;">${mostRecent.title.slice(0, 40)}${mostRecent.title.length > 40 ? "…" : ""}</div></div>`;
  }

  let realmSearchQuery = "";
  function bootRealmSearch() {
    function runSearch() {
      realmSearchQuery = document.getElementById("realm-search-input").value.trim().toLowerCase();
      renderRealmFeed();
    }
    document.getElementById("realm-search-btn").addEventListener("click", runSearch);
    document.getElementById("realm-search-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch();
      if (e.key === "Escape") { document.getElementById("realm-search-input").value = ""; realmSearchQuery = ""; renderRealmFeed(); }
    });
  }

  // ---------- ALLIANCES ----------
  function renderAlliances(rows) {
    const me = ThroneAuth.getUser();
    const incoming = rows.filter(r => r.status === "pending" && r.recipient_id === me.id);
    const outgoing = rows.filter(r => r.status === "pending" && r.requester_id === me.id);
    const accepted = rows.filter(r => r.status === "accepted");

    const incomingEl = document.getElementById("alliance-incoming-list");
    incomingEl.innerHTML = incoming.length ? incoming.map(r => `
      <div class="ally-row" data-id="${r.id}">
        <div><div class="a-name">${r.requester.display_name || r.requester.email}</div><div class="a-email">${r.requester.email}</div></div>
        <div><button class="ally-btn accept-ally">Accept</button><button class="ally-btn decline decline-ally">Decline</button></div>
      </div>`).join("") : `<div class="feed-empty">No pending requests.</div>`;

    const outgoingEl = document.getElementById("alliance-outgoing-list");
    outgoingEl.innerHTML = outgoing.length ? outgoing.map(r => `
      <div class="ally-row" data-id="${r.id}">
        <div><div class="a-name">${r.recipient.display_name || r.recipient.email}</div><div class="a-email">Awaiting response</div></div>
        <div><button class="ally-btn decline cancel-ally">Cancel</button></div>
      </div>`).join("") : `<div class="feed-empty">Nothing sent right now.</div>`;

    const acceptedEl = document.getElementById("alliance-accepted-list");
    acceptedEl.innerHTML = accepted.length ? accepted.map(r => {
      const other = r.requester_id === me.id ? r.recipient : r.requester;
      const otherId = r.requester_id === me.id ? r.recipient_id : r.requester_id;
      return `
        <div class="ally-row" data-id="${r.id}" data-other-id="${otherId}" data-other-email="${other.email}" data-other-name="${other.display_name || other.email}">
          <div><div class="a-name">${other.display_name || other.email}</div><div class="a-email">${other.email}</div></div>
          <div>
            <button class="ally-btn message-ally">Message</button>
            <button class="ally-btn call-ally">Call</button>
          </div>
        </div>`;
    }).join("") : `<div class="feed-empty">No allies yet — send a request above.</div>`;

    incomingEl.querySelectorAll(".accept-ally").forEach(btn => btn.addEventListener("click", async (e) => {
      await ThroneSync.respondToAlliance(e.target.closest(".ally-row").dataset.id, "accepted");
    }));
    incomingEl.querySelectorAll(".decline-ally").forEach(btn => btn.addEventListener("click", async (e) => {
      await ThroneSync.respondToAlliance(e.target.closest(".ally-row").dataset.id, "declined");
    }));
    outgoingEl.querySelectorAll(".cancel-ally").forEach(btn => btn.addEventListener("click", async (e) => {
      await ThroneSync.removeAlliance(e.target.closest(".ally-row").dataset.id);
    }));
    acceptedEl.querySelectorAll(".message-ally").forEach(btn => btn.addEventListener("click", async (e) => {
      const row = e.target.closest(".ally-row");
      document.querySelectorAll('.rail-btn[data-view]').forEach(b => b.classList.remove("active"));
      document.querySelectorAll('.rail-btn[data-view="vault"]').forEach(b => b.classList.add("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById("view-vault").classList.add("active");
      try {
        const { threadId, otherProfile } = await ThroneSync.getOrCreateThreadWith(row.dataset.otherEmail);
        vaultThreads[threadId] = { otherProfile };
        renderThreadList();
        openThread(threadId);
      } catch (err) { alert(err.message); }
    }));
    acceptedEl.querySelectorAll(".call-ally").forEach(btn => btn.addEventListener("click", (e) => {
      const row = e.target.closest(".ally-row");
      ThroneCall.startCall(row.dataset.otherId, row.dataset.otherName);
    }));
  }

  async function bootAlliances() {
    async function refresh() {
      try {
        const rows = await ThroneSync.loadAlliances();
        renderAlliances(rows);
      } catch (e) {
        document.getElementById("alliance-accepted-list").innerHTML = `<div class="feed-empty">Couldn't load alliances — check Supabase config.</div>`;
      }
    }
    await refresh();
    ThroneSync.subscribeAlliances(refresh);

    document.getElementById("alliance-send-btn").addEventListener("click", async () => {
      const input = document.getElementById("alliance-email-input");
      const statusEl = document.getElementById("alliance-send-status");
      const email = input.value.trim();
      if (!email) return;
      try {
        await ThroneSync.sendAllianceRequest(email);
        input.value = "";
        statusEl.textContent = "Request sent.";
      } catch (e) {
        statusEl.textContent = e.message;
      }
    });
  }

  // ---------- CALLING ----------
  let pendingIncoming = null;

  function showCallOverlay() { document.getElementById("call-overlay").classList.add("show"); }
  function hideCallOverlay() {
    document.getElementById("call-overlay").classList.remove("show");
    document.getElementById("call-info").style.display = "flex";
    document.getElementById("call-incoming-actions").style.display = "none";
    document.getElementById("call-active-controls").style.display = "none";
    document.getElementById("call-local-video").srcObject = null;
    document.getElementById("call-remote-video").srcObject = null;
  }

  async function bootCalling() {
    ThroneCall.listenForCalls((payload) => {
      pendingIncoming = payload;
      document.getElementById("call-seal").textContent = (payload.fromName || "?").charAt(0).toUpperCase();
      document.getElementById("call-name").textContent = payload.fromName || "Unknown";
      document.getElementById("call-status").textContent = "Incoming call…";
      document.getElementById("call-incoming-actions").style.display = "flex";
      document.getElementById("call-active-controls").style.display = "none";
      showCallOverlay();
    });

    ThroneCall.onCallState((state, detail) => {
      const statusEl = document.getElementById("call-status");
      const nameEl = document.getElementById("call-name");
      const sealEl = document.getElementById("call-seal");
      if (state === "calling") {
        nameEl.textContent = detail.otherName || "Calling…";
        sealEl.textContent = (detail.otherName || "?").charAt(0).toUpperCase();
        statusEl.textContent = "Ringing…";
        document.getElementById("call-incoming-actions").style.display = "none";
        document.getElementById("call-active-controls").style.display = "flex";
        showCallOverlay();
      } else if (state === "connecting") {
        statusEl.textContent = "Connecting…";
        document.getElementById("call-incoming-actions").style.display = "none";
        document.getElementById("call-active-controls").style.display = "flex";
      } else if (state === "local-stream") {
        document.getElementById("call-local-video").srcObject = detail.stream;
      } else if (state === "remote-stream") {
        document.getElementById("call-remote-video").srcObject = detail.stream;
        document.getElementById("call-info").style.display = "none";
      } else if (state === "connected") {
        statusEl.textContent = "Connected";
      } else if (state === "declined") {
        statusEl.textContent = "Call declined";
        setTimeout(hideCallOverlay, 1500);
      } else if (state === "ended") {
        statusEl.textContent = "Call ended";
        setTimeout(hideCallOverlay, 1000);
      }
    });

    document.getElementById("call-accept-btn").addEventListener("click", async () => {
      if (!pendingIncoming) return;
      document.getElementById("call-incoming-actions").style.display = "none";
      document.getElementById("call-active-controls").style.display = "flex";
      document.getElementById("call-status").textContent = "Connecting…";
      await ThroneCall.answerCall(pendingIncoming.roomId);
      pendingIncoming = null;
    });

    document.getElementById("call-decline-btn").addEventListener("click", () => {
      if (pendingIncoming) ThroneCall.declineCall(pendingIncoming.roomId);
      pendingIncoming = null;
      hideCallOverlay();
    });

    document.getElementById("call-hangup-btn").addEventListener("click", () => {
      ThroneCall.hangUp();
    });

    let micOn = true, camOn = true;
    document.getElementById("call-mic-btn").addEventListener("click", (e) => {
      micOn = !micOn;
      ThroneCall.toggleMic(micOn);
      e.currentTarget.classList.toggle("active-off", !micOn);
    });
    document.getElementById("call-cam-btn").addEventListener("click", (e) => {
      camOn = !camOn;
      ThroneCall.toggleCamera(camOn);
      e.currentTarget.classList.toggle("active-off", !camOn);
    });

    // call button inside an open Vault thread
    document.getElementById("vault-call-btn").addEventListener("click", () => {
      if (!activeThreadId || !vaultThreads[activeThreadId]) return;
      const t = vaultThreads[activeThreadId];
      ThroneCall.startCall(t.otherProfile.id, t.otherProfile.display_name || t.otherProfile.email);
    });
  }

  // ---------- KING'S WING ----------
  function switchKwingTab(tab) {
    document.querySelectorAll(".kwing-tab").forEach(t => t.classList.toggle("on", t.dataset.tab === tab));
    document.querySelectorAll(".kwing-panel").forEach(p => p.style.display = "none");
    document.getElementById(`kwing-${tab}`).style.display = "block";
  }

  async function refreshGallery() {
    try {
      const posts = await ThroneSync.loadSocialPosts();
      const igPosts = posts.filter(p => p.platform === "instagram" && p.link);
      await ThroneKings.renderInstagramPosts(document.getElementById("gallery-post-list"), igPosts.map(p => p.link));
    } catch (e) {
      document.getElementById("gallery-post-list").innerHTML = `<div class="feed-empty">Couldn't load the Gallery — check Supabase config.</div>`;
    }
  }

  async function renderExhibitions() {
    const container = document.getElementById("exhibition-cards");
    container.innerHTML = KINGS_CONFIG.exhibitions.collections.map(c => `
      <div class="exhibition-card c6" id="ex-${c.slug}">
        <h4>${c.label}</h4>
        <div class="ex-stats" id="ex-stats-${c.slug}">
          <div class="ex-stat"><div class="k">Floor</div><div class="v">—</div></div>
          <div class="ex-stat"><div class="k">Items</div><div class="v">—</div></div>
          <div class="ex-stat"><div class="k">Owners</div><div class="v">—</div></div>
        </div>
        <a href="https://opensea.io/collection/${c.slug}" target="_blank" rel="noopener">View on OpenSea</a>
      </div>`).join("");

    for (const c of KINGS_CONFIG.exhibitions.collections) {
      try {
        const stats = await ThroneKings.getCollectionStats(c.slug);
        const total = stats.total || stats;
        const statsEl = document.getElementById(`ex-stats-${c.slug}`);
        if (statsEl) {
          statsEl.innerHTML = `
            <div class="ex-stat"><div class="k">Floor</div><div class="v">${total.floor_price != null ? total.floor_price + " ETH" : "—"}</div></div>
            <div class="ex-stat"><div class="k">Items</div><div class="v">${total.count ?? "—"}</div></div>
            <div class="ex-stat"><div class="k">Owners</div><div class="v">${total.num_owners ?? "—"}</div></div>`;
        }
      } catch (e) {
        const statsEl = document.getElementById(`ex-stats-${c.slug}`);
        if (statsEl) statsEl.innerHTML = `<div class="feed-empty" style="padding:6px 0;">Live stats unavailable right now — view on OpenSea directly.</div>`;
      }
    }
  }

  async function bootKings() {
    document.querySelectorAll(".kwing-tab").forEach(tab => {
      tab.addEventListener("click", () => switchKwingTab(tab.dataset.tab));
    });

    document.getElementById("kings-message-iframe").src = ThroneKings.spotifyShowEmbedUrl();

    await refreshGallery();
    ThroneSync.subscribeSocialPosts(refreshGallery);

    document.getElementById("gallery-post-btn").addEventListener("click", async () => {
      const input = document.getElementById("gallery-post-input");
      const statusEl = document.getElementById("gallery-post-status");
      const link = input.value.trim();
      if (!link) return;
      input.value = "";
      await ThroneSync.addSocialPost("instagram", "", link, null);
      statusEl.textContent = "Added to the Gallery.";
    });

    renderExhibitions();
    // ---- push notifications ----
    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
    }

    async function refreshPushButtonState() {
      const btn = document.getElementById("settings-push-btn");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        btn.textContent = "Not supported on this browser";
        btn.disabled = true;
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      btn.textContent = existing ? "Disable Notifications" : "Enable Notifications";
    }
    await refreshPushButtonState();

    document.getElementById("settings-push-btn").addEventListener("click", async () => {
      const statusEl = document.getElementById("settings-push-status");
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      if (existing) {
        await ThroneSync.removePushSubscription(existing.endpoint);
        await existing.unsubscribe();
        statusEl.textContent = "Notifications disabled on this device.";
        await refreshPushButtonState();
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          statusEl.textContent = "Permission denied — enable notifications for this site in your browser settings.";
          return;
        }
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUSH_CONFIG.vapidPublicKey)
        });
        await ThroneSync.savePushSubscription(subscription);
        statusEl.textContent = "Notifications enabled on this device.";
        await refreshPushButtonState();
      } catch (e) {
        statusEl.textContent = "Couldn't enable notifications — " + e.message;
      }
    });
  }

  // ---------- VAULT ----------
  const vaultThreads = {}; // threadId -> { otherProfile }
  let activeThreadId = null;
  let activeThreadSub = null;

  function renderThreadList() {
    const listEl = document.getElementById("vault-thread-list");
    const ids = Object.keys(vaultThreads);
    if (!ids.length) {
      listEl.innerHTML = `<div class="feed-empty">No chambers yet — add someone above.</div>`;
      return;
    }
    listEl.innerHTML = ids.map(id => {
      const t = vaultThreads[id];
      return `
        <div class="vlist-item ${id === activeThreadId ? "on" : ""}" data-id="${id}">
          <div class="vav"></div>
          <div><div class="vname">${t.otherProfile.display_name || t.otherProfile.email}</div>
          <div class="vlast">${t.otherProfile.email}</div></div>
        </div>`;
    }).join("");

    listEl.querySelectorAll(".vlist-item").forEach(item => {
      item.addEventListener("click", () => openThread(item.dataset.id));
    });
  }

  function renderMessages(messages) {
    const msgsEl = document.getElementById("vault-msgs");
    const me = ThroneAuth.getUser();
    if (!messages.length) {
      msgsEl.innerHTML = `<div class="feed-empty">No messages yet — say something.</div>`;
      return;
    }
    msgsEl.innerHTML = messages.map(m => {
      const mine = m.sender_id === me.id;
      const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `<div class="msg ${mine ? "out" : "in"}">${m.plaintext}<span class="mt">${time}</span></div>`;
    }).join("");
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  async function openThread(threadId) {
    activeThreadId = threadId;
    renderThreadList();
    const t = vaultThreads[threadId];
    document.getElementById("vault-active-name").textContent = t.otherProfile.display_name || t.otherProfile.email;
    document.getElementById("vault-msg-input").disabled = false;

    const messages = await ThroneSync.loadThreadMessages(threadId, t.otherProfile.public_key);
    renderMessages(messages);

    if (activeThreadSub) supabaseClient.removeChannel(activeThreadSub);
    activeThreadSub = ThroneSync.subscribeThreadMessages(threadId, async () => {
      const fresh = await ThroneSync.loadThreadMessages(threadId, t.otherProfile.public_key);
      renderMessages(fresh);
    });
  }

  async function bootVault() {
    document.getElementById("vault-new-contact-btn").addEventListener("click", connectToContact);
    document.getElementById("vault-new-contact").addEventListener("keydown", (e) => {
      if (e.key === "Enter") connectToContact();
    });

    async function connectToContact() {
      const input = document.getElementById("vault-new-contact");
      const email = input.value.trim();
      if (!email) return;
      const btn = document.getElementById("vault-new-contact-btn");
      btn.textContent = "Connecting…";
      try {
        const { threadId, otherProfile } = await ThroneSync.getOrCreateThreadWith(email);
        vaultThreads[threadId] = { otherProfile };
        input.value = "";
        renderThreadList();
        openThread(threadId);
      } catch (e) {
        alert(e.message);
      }
      btn.textContent = "Connect";
    }

    document.getElementById("vault-send-btn").addEventListener("click", sendVaultMessage);
    document.getElementById("vault-msg-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendVaultMessage();
    });
    async function sendVaultMessage() {
      const input = document.getElementById("vault-msg-input");
      const text = input.value.trim();
      if (!text || !activeThreadId) return;
      input.value = "";
      const t = vaultThreads[activeThreadId];
      await ThroneSync.sendMessage(activeThreadId, text, t.otherProfile.public_key);
    }
  }
});
