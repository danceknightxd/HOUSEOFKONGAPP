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

  // ---------- offline indicator (Phase 1 offline support) ----------
  // Sticky on purpose — set true by either a real 'offline' event or
  // any single cachedLoad() falling back to cached data, and only
  // cleared by a genuine 'online' event, not by one section happening
  // to reconnect while others are still stale. See offline-cache.js.
  function setOfflineIndicator(isOffline) {
    document.getElementById("offline-banner").classList.toggle("show", isOffline);
  }
  window.addEventListener("online", () => setOfflineIndicator(false));
  window.addEventListener("offline", () => setOfflineIndicator(true));
  if (!navigator.onLine) setOfflineIndicator(true);

  // Handle the redirect back from Spotify's auth page, if that's why we're here.
  await ThroneSpotify.handleRedirect();

  // ---------- brand seal (side rail, every view) ----------
  const throneSealModel = document.getElementById("throne-seal-model");
  if (throneSealModel && THRONE_CONFIG.throneSealModelUrl) {
    throneSealModel.src = THRONE_CONFIG.throneSealModelUrl;
  }

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
      // Network Feed Status panel was removed from the Circle view — this
      // callback still fires per-feed as Blogger posts sync in, so keep
      // it around to refresh the dashboard, just without a status row to update.
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
    bootTaskTabs();
    bootPersonalBests();
    bootTimeBlocks();
    bootTaskCalendar();
    bootGoals();
    bootFitness();
    bootSplits();
    bootExerciseLogger();
    bootPlateCalculator();
    bootVault();
    bootSocial();
    bootYouTubeFeed();
    bootCustomTopics();
    bootMarkets();
    bootSettings();
    bootNotifications();
    bootSearch();
    bootOnboarding();
    bootAlliances();
    bootCalling();
    bootKings();
    bootHoldingDetailModal();
    bootCurrencySetting();
    bootFocusTimer();
    bootDashboardMomentum();
    refreshDashboardCoreStats();
    bootNetWorth();
    bootFI();
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
        <span class="task-reminder-btn ${t.reminder_at && !t.reminder_sent ? "armed" : ""}" data-id="${t.id}" data-reminder="${t.reminder_at || ""}"
          title="${t.reminder_at && !t.reminder_sent ? "Reminder set for " + new Date(t.reminder_at).toLocaleString() : "Set a reminder"}">🔔</span>
        <span class="task-remove" data-id="${t.id}" style="color:var(--ivory-dim); cursor:pointer; font-size:14px; margin-left:10px;" title="Remove">✕</span>
      </div>`).join("");

    list.querySelectorAll(".task-reminder-btn").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const current = el.dataset.reminder;
        const defaultVal = current ? new Date(current).toISOString().slice(0, 16) : "";
        const input = prompt(
          "Remind me at (YYYY-MM-DD HH:MM, 24h, your local time) — leave blank to clear:",
          defaultVal ? defaultVal.replace("T", " ") : ""
        );
        if (input === null) return; // cancelled
        if (input.trim() === "") {
          await ThroneSync.setTaskReminder(el.dataset.id, null);
          return;
        }
        const parsed = new Date(input.trim().replace(" ", "T"));
        if (isNaN(parsed.getTime())) {
          alert("Couldn't read that as a date/time — try YYYY-MM-DD HH:MM.");
          return;
        }
        await ThroneSync.setTaskReminder(el.dataset.id, parsed.toISOString());
      });
    });

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

    list.querySelectorAll(".task-remove").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        await ThroneSync.removeTask(el.dataset.id);
      });
    });
  }

  async function bootTasks() {
    const statusEl = document.getElementById("task-sync-status");
    try {
      await ThroneSync.purgeOldCompletedTasks().catch(() => {}); // skip silently if offline — nothing to purge without a connection anyway
      const { data: tasks, isOffline } = await ThroneOfflineCache.cachedLoad("tasks", () => ThroneSync.loadTasks());
      renderTasks(tasks);
      if (isOffline) { setOfflineIndicator(true); statusEl.textContent = "Offline — showing your last saved tasks."; }
      else statusEl.textContent = "Synced across your devices.";
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
      refreshDashboardCoreStats();
      if (document.getElementById("task-panel-calendar").style.display !== "none") {
        renderTaskCalendarView();
      }
    });
  }

  // ---------- TASKS+ : sub-tabs ----------
  function bootTaskTabs() {
    const panels = { queue: "task-panel-queue", pr: "task-panel-pr", blocks: "task-panel-blocks", calendar: "task-panel-calendar" };
    document.querySelectorAll(".task-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".task-tab").forEach(t => t.classList.toggle("on", t === tab));
        const target = tab.dataset.tab;
        Object.entries(panels).forEach(([key, id]) => {
          document.getElementById(id).style.display = key === target ? "block" : "none";
        });
        // The 3D chart needs a visible (non-zero-width) container to size
        // itself, so it only (re)builds once its panel is actually shown —
        // and stops rendering the moment it's hidden, so it's not spinning
        // in the background burning battery on a tab nobody's looking at.
        if (target === "pr") refreshPersonalBests(true);
        else ThroneTasksPlus.destroyPRChart();
        if (target === "blocks") renderHourGridView();
        if (target === "calendar") renderTaskCalendarView();
      });
    });
  }

  // ---------- TASKS+ : personal bests (3D chart) ----------
  let cachedPRs = [];
  async function refreshPersonalBests(forceRender) {
    try {
      const { data: logs, isOffline } = await ThroneOfflineCache.cachedLoad("exercise-logs", () => ThroneSync.loadExerciseLogs(200));
      const prs = computePRs(logs);
      cachedPRs = Object.values(prs).sort((a, b) =>
        (b.weight * (1 + b.reps / 30)) - (a.weight * (1 + a.reps / 30))
      );
      if (isOffline) setOfflineIndicator(true);
    } catch (e) {
      cachedPRs = [];
    }
    const visible = document.getElementById("task-panel-pr").style.display !== "none";
    if (visible || forceRender) {
      ThroneTasksPlus.renderPRChart(document.getElementById("pr-chart-3d"), cachedPRs);
    }
  }

  async function bootPersonalBests() {
    await refreshPersonalBests(false);
    ThroneSync.subscribeExerciseLogs(() => refreshPersonalBests(false));
  }

  // ---------- TASKS+ : time-blocking hour grid ----------
  let blocksCurrentDate = new Date().toISOString().slice(0, 10);

  function fmtBlocksDayLabel(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === todayStr) return "today";
    if (dateStr === tomorrow.toISOString().slice(0, 10)) return "tomorrow";
    if (dateStr === yesterday.toISOString().slice(0, 10)) return "yesterday";
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  async function renderHourGridView() {
    document.getElementById("blocks-date-input").value = blocksCurrentDate;
    document.getElementById("blocks-day-label").textContent = fmtBlocksDayLabel(blocksCurrentDate);
    const container = document.getElementById("hour-grid-container");
    try {
      const blocks = await ThroneSync.loadTimeBlocks(blocksCurrentDate);
      container.innerHTML = ThroneTasksPlus.hourGridHtml(blocks);
      container.querySelectorAll(".tb-remove").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await ThroneSync.removeTimeBlock(btn.dataset.id);
        });
      });
    } catch (e) {
      container.innerHTML = `<div class="feed-empty">Couldn't load time blocks — check Supabase config (see migration-tasks-plus.sql).</div>`;
    }
  }

  async function bootTimeBlocks() {
    await renderHourGridView();

    document.getElementById("blocks-prev-day").addEventListener("click", () => {
      const d = new Date(blocksCurrentDate + "T00:00:00");
      d.setDate(d.getDate() - 1);
      blocksCurrentDate = d.toISOString().slice(0, 10);
      renderHourGridView();
    });
    document.getElementById("blocks-next-day").addEventListener("click", () => {
      const d = new Date(blocksCurrentDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      blocksCurrentDate = d.toISOString().slice(0, 10);
      renderHourGridView();
    });
    document.getElementById("blocks-date-input").addEventListener("change", (e) => {
      if (!e.target.value) return;
      blocksCurrentDate = e.target.value;
      renderHourGridView();
    });

    document.getElementById("block-add-btn").addEventListener("click", async () => {
      const label = document.getElementById("block-label-input").value.trim();
      const timeVal = document.getElementById("block-start-input").value; // "HH:MM"
      const duration = parseInt(document.getElementById("block-duration-select").value, 10);
      if (!label || !timeVal) return;
      const [hh, mm] = timeVal.split(":").map(Number);
      const startMinutes = hh * 60 + mm;
      document.getElementById("block-label-input").value = "";
      document.getElementById("block-start-input").value = "";
      await ThroneSync.addTimeBlock(label, blocksCurrentDate, startMinutes, duration);
    });

    ThroneSync.subscribeTimeBlocks(() => {
      if (document.getElementById("task-panel-blocks").style.display !== "none") {
        renderHourGridView();
      }
    });
  }

  // ---------- TASKS+ : monthly calendar ----------
  const calToday = new Date();
  let calYear = calToday.getFullYear();
  let calMonth = calToday.getMonth(); // 0-11

  function renderCalDayTasks(dateStr, tasksByDate) {
    const dayTasks = (tasksByDate[dateStr] || []);
    const panel = document.getElementById("cal-day-tasks");
    const countEl = document.getElementById("cal-day-tasks-count");
    if (!dateStr) { panel.innerHTML = ""; countEl.textContent = ""; return; }
    countEl.textContent = `${dayTasks.length} on ${new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    panel.innerHTML = dayTasks.length
      ? dayTasks.map(t => `
        <div class="task-row ${t.done ? "line-done" : ""}">
          <div class="check ${t.done ? "done" : ""}" style="pointer-events:none;"></div>
          <div class="txt">${t.title}</div>
          <div class="prio ${t.priority}">${priorityLabel(t.priority)}</div>
        </div>`).join("")
      : `<div class="feed-empty">Nothing due this day.</div>`;
  }

  async function renderTaskCalendarView() {
    const container = document.getElementById("task-calendar");
    let tasksByDate = {};
    try {
      const tasks = await ThroneSync.loadTasks();
      tasks.forEach(t => {
        if (!t.due_date) return;
        (tasksByDate[t.due_date] = tasksByDate[t.due_date] || []).push(t);
      });
    } catch (e) { /* render an empty calendar rather than block on a fetch error */ }

    container.innerHTML = ThroneTasksPlus.monthCalendarHtml(calYear, calMonth, tasksByDate);

    container.querySelectorAll(".cal-nav").forEach(btn => {
      btn.addEventListener("click", () => {
        calMonth += parseInt(btn.dataset.dir, 10);
        if (calMonth < 0) { calMonth = 11; calYear--; }
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderTaskCalendarView();
      });
    });
    container.querySelectorAll(".cal-cell[data-date]").forEach(cell => {
      cell.addEventListener("click", () => renderCalDayTasks(cell.dataset.date, tasksByDate));
    });
  }

  async function bootTaskCalendar() {
    await renderTaskCalendarView();
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
      const { data: logs, isOffline } = await ThroneOfflineCache.cachedLoad("exercise-logs", () => ThroneSync.loadExerciseLogs(200));
      if (isOffline) setOfflineIndicator(true);
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
      <div class="goal-card" data-id="${g.id}">
        <div class="goal-top"><h4>${g.title}</h4><span class="pct">${g.progress_pct}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${g.progress_pct}%"></div></div>
        <div class="goal-meta" style="margin-bottom:10px;">${g.meta || ""}</div>
        <input type="range" class="goal-progress-slider" data-id="${g.id}" min="0" max="100" step="5" value="${g.progress_pct}" style="width:100%; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="ally-btn goal-complete-btn" data-id="${g.id}">Mark Complete</span>
          <span class="ally-btn decline goal-remove-btn" data-id="${g.id}">Remove</span>
        </div>
      </div>`).join("");

    list.querySelectorAll(".goal-progress-slider").forEach(slider => {
      slider.addEventListener("change", async () => {
        await ThroneSync.updateGoalProgress(slider.dataset.id, parseInt(slider.value));
      });
    });
    list.querySelectorAll(".goal-complete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        await ThroneSync.updateGoalProgress(btn.dataset.id, 100);
      });
    });
    list.querySelectorAll(".goal-remove-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (confirm("Remove this goal? This can't be undone.")) {
          await ThroneSync.removeGoal(btn.dataset.id);
        }
      });
    });
  }

  async function bootGoals() {
    try {
      const { data: goals, isOffline } = await ThroneOfflineCache.cachedLoad("goals", () => ThroneSync.loadGoals());
      renderGoals(goals);
      if (isOffline) setOfflineIndicator(true);
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
      refreshDashboardCoreStats();
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

    async function refreshPosts() {
      try {
        const posts = await ThroneSync.loadSocialPosts();
        renderSocialPosts(posts.filter(p => p.platform !== "instagram"));
      } catch (e) {
        // "Log a Post" panel (and its status line) was removed from the
        // Circle view — nowhere left to surface a load error inline, so
        // just leave the feed list empty/stale rather than throw.
      }
    }
    await refreshPosts();
    ThroneSync.subscribeSocialPosts(refreshPosts);
  }

  // ---------- YOUTUBE FEED (Your Feed) ----------
  // Combines followed channels' latest uploads with every active topic
  // chip's results into one sorted list. Topic chips persist the same
  // way News' custom topic chips do (typed once, remembered from then
  // on) — same table (social_follows), just a different platform value
  // ('youtube-topic' vs 'youtube' for a channel).
  let ytChannelFollows = [];
  let ytTopicFollows = [];
  let ytFollowedResults = {};   // channel follow id -> its latest videos
  let ytTopicResults = {};      // topic follow id -> that topic's results

  function ytHasKey() { return !!(typeof YOUTUBE_CONFIG !== "undefined" && YOUTUBE_CONFIG.configured); }

  function renderYtChannelChips() {
    const el = document.getElementById("yt-followed-list");
    el.innerHTML = ytChannelFollows.map(f => `
      <span class="follow-chip">${f.label || f.identifier}<span class="fc-remove" data-id="${f.id}">✕</span></span>
    `).join("");
    el.querySelectorAll(".fc-remove").forEach(btn => {
      btn.addEventListener("click", async () => { await ThroneSync.removeSocialFollow(btn.dataset.id); });
    });
  }

  function renderYtTopicChips() {
    const el = document.getElementById("yt-topic-chip-row");
    el.innerHTML = ytTopicFollows.map(f => `
      <span class="chip on">${f.identifier}<span class="fc-remove" data-id="${f.id}" style="margin-left:6px;">✕</span></span>
    `).join("");
    el.querySelectorAll(".fc-remove").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await ThroneSync.removeSocialFollow(btn.dataset.id);
      });
    });
  }

  function renderYtCombinedFeed() {
    const combined = [...Object.values(ytTopicResults).flat(), ...Object.values(ytFollowedResults).flat()];
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    ThroneFeeds.renderNewsList(document.getElementById("yt-feed-list"), combined, "Add a topic or follow a channel above to see videos here.");
    document.getElementById("yt-feed-status").textContent = combined.length ? `${combined.length} videos` : "—";
  }

  function showYtNeedsKeyNotice() {
    document.getElementById("yt-feed-status").textContent = "needs setup";
    ThroneFeeds.renderNewsList(document.getElementById("yt-feed-list"), [],
      "Set a YouTube API key as an Edge Function secret, then flip <code>configured: true</code> in youtube-config.js — see the setup notes in that file.");
  }

  async function refreshYtChannelVideos() {
    for (const f of ytChannelFollows) {
      try { ytFollowedResults[f.id] = await ThroneSocialFeeds.getYouTubeChannelVideos(f.identifier, 10); }
      catch (e) { ytFollowedResults[f.id] = []; }
    }
    renderYtCombinedFeed();
  }

  async function refreshYtTopicResults() {
    for (const f of ytTopicFollows) {
      try { ytTopicResults[f.id] = await ThroneSocialFeeds.searchYouTubeTopic(f.identifier, 10); }
      catch (e) { ytTopicResults[f.id] = []; }
    }
    renderYtCombinedFeed();
  }

  async function bootYouTubeFeed() {
    try {
      ytChannelFollows = await ThroneSync.loadSocialFollows("youtube");
      ytTopicFollows = await ThroneSync.loadSocialFollows("youtube-topic");
    } catch (e) { ytChannelFollows = []; ytTopicFollows = []; }
    renderYtChannelChips();
    renderYtTopicChips();

    if (!ytHasKey()) {
      showYtNeedsKeyNotice();
    } else {
      await refreshYtChannelVideos();
      await refreshYtTopicResults();
    }

    async function submitYtTopic() {
      const input = document.getElementById("yt-topic-input");
      const topic = input.value.trim();
      if (!topic) return;
      input.value = "";
      if (!ytHasKey()) { showYtNeedsKeyNotice(); return; }
      const { error } = await ThroneSync.addSocialFollow("youtube-topic", topic, topic);
      if (error) return;
      ytTopicFollows = await ThroneSync.loadSocialFollows("youtube-topic");
      renderYtTopicChips();
      await refreshYtTopicResults();
    }
    document.getElementById("yt-topic-btn").addEventListener("click", submitYtTopic);
    document.getElementById("yt-topic-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitYtTopic();
    });

    document.getElementById("yt-channel-btn").addEventListener("click", async () => {
      const input = document.getElementById("yt-channel-input");
      const identifier = input.value.trim();
      if (!identifier) return;
      if (!ytHasKey()) { showYtNeedsKeyNotice(); return; }
      try {
        const preview = await ThroneSocialFeeds.getYouTubeChannelVideos(identifier, 1);
        const label = (preview[0] && preview[0].source) || identifier;
        await ThroneSync.addSocialFollow("youtube", identifier, label);
        input.value = "";
      } catch (e) {
        alert("Couldn't follow that channel: " + e.message);
      }
    });

    ThroneSync.subscribeSocialFollows((payload) => {
      const row = (payload.new && Object.keys(payload.new).length) ? payload.new : payload.old;
      if (!row) return;
      (async () => {
        if (row.platform === "youtube") {
          ytChannelFollows = await ThroneSync.loadSocialFollows("youtube");
          renderYtChannelChips();
          if (ytHasKey()) await refreshYtChannelVideos();
        } else if (row.platform === "youtube-topic") {
          ytTopicFollows = await ThroneSync.loadSocialFollows("youtube-topic");
          renderYtTopicChips();
          if (ytHasKey()) await refreshYtTopicResults();
        }
      })();
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
  // ---------- CURRENCY ----------
  const CURRENCY_KEY = "throne_display_currency";
  function detectDefaultCurrency() {
    const locale = navigator.language || "en-US";
    const map = { "en-AU": "AUD", "en-GB": "GBP", "en-CA": "CAD", "en-NZ": "NZD", "en-IN": "INR", "ja-JP": "JPY", "en-US": "USD" };
    return map[locale] || "USD";
  }
  function getCurrency() {
    return localStorage.getItem(CURRENCY_KEY) || detectDefaultCurrency();
  }
  function setCurrency(code) {
    localStorage.setItem(CURRENCY_KEY, code);
  }
  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "$—";
    const currency = getCurrency();
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency", currency,
        maximumFractionDigits: n < 10 ? 4 : 2
      }).format(n);
    } catch (e) {
      return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  }

  async function renderWatchlist() {
    const container = document.getElementById("watchlist-cards");
    container.innerHTML = `<div class="feed-empty">Loading watchlist…</div>`;

    let items;
    try {
      items = await ThroneSync.loadWatchlist();
    } catch (e) {
      container.innerHTML = `<div class="feed-empty">Couldn't load your watchlist — check Supabase config.</div>`;
      return;
    }

    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = `<div class="feed-empty">Your watchlist is empty — add a symbol below.</div>`;
    }

    const currency = getCurrency().toLowerCase();
    const cryptoItems = items.filter(i => i.asset_type === "crypto");
    const stockItems = items.filter(i => i.asset_type === "stock");

    function makeCard(item, priceHtml, changeVal) {
      const card = document.createElement("div");
      card.className = "market-card";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div class="m-name">${item.label || item.symbol}</div>
          <span class="watchlist-remove" data-id="${item.id}" style="color:var(--ivory-dim); cursor:pointer; font-size:14px; line-height:1;">✕</span>
        </div>
        <div class="m-price">${priceHtml}</div>
        <div class="m-change ${changeVal >= 0 ? "up" : "down"}">${changeVal != null ? (changeVal >= 0 ? "▲" : "▼") + Math.abs(changeVal).toFixed(2) + "%" : ""}</div>`;
      card.querySelector(".watchlist-remove").addEventListener("click", async (e) => {
        e.stopPropagation();
        await ThroneSync.removeWatchlistItem(item.id);
      });
      card.addEventListener("click", () => openHoldingDetail(item.asset_type, item.symbol, item.label || item.symbol));
      container.appendChild(card);
    }

    if (cryptoItems.length) {
      try {
        const prices = await ThroneMarkets.getCryptoPrices(cryptoItems.map(i => i.symbol), currency);
        cryptoItems.forEach(item => {
          const p = prices[item.symbol];
          makeCard(item, p ? fmtUsd(p[currency]) : "—", p ? p[`${currency}_24h_change`] : null);
        });
      } catch (e) {
        container.innerHTML += `<div class="feed-empty">Couldn't reach CoinGecko right now.</div>`;
      }
    }

    if (stockItems.length) {
      if (ThroneMarkets.hasStockKey()) {
        try {
          const stockPrices = await ThroneMarkets.getStockPrices(stockItems.map(i => i.symbol));
          stockItems.forEach(item => {
            const q = stockPrices[item.symbol];
            makeCard(item, q ? fmtUsd(parseFloat(q.close)) : "—", q ? parseFloat(q.percent_change) : null);
          });
        } catch (e) { /* stock cards failed silently, crypto still shows */ }
      } else {
        const card = document.createElement("div");
        card.className = "market-card";
        card.innerHTML = `<div class="m-name">STOCKS</div><div class="feed-empty" style="padding:8px 0;">Add a free Twelve Data key in <code>market-config.js</code> to see live stock prices.</div>`;
        container.appendChild(card);
      }
    }
  }

  async function bootWatchlist() {
    await renderWatchlist();
    ThroneSync.subscribeWatchlist(renderWatchlist);

    document.getElementById("watchlist-add-btn").addEventListener("click", async () => {
      const type = document.getElementById("watchlist-type-select").value;
      const symbol = document.getElementById("watchlist-symbol-input").value.trim().toLowerCase();
      const label = document.getElementById("watchlist-label-input").value.trim();
      if (!symbol) return;
      document.getElementById("watchlist-symbol-input").value = "";
      document.getElementById("watchlist-label-input").value = "";
      await ThroneSync.addWatchlistItem(type, type === "stock" ? symbol.toUpperCase() : symbol, label || symbol.toUpperCase());
    });
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
    const currency = getCurrency().toLowerCase();

    let cryptoPrices = {}, stockPrices = {};
    try { cryptoPrices = await ThroneMarkets.getCryptoPrices(cryptoIds, currency); } catch (e) {}
    if (ThroneMarkets.hasStockKey()) {
      try { stockPrices = await ThroneMarkets.getStockPrices(stockSyms); } catch (e) {}
    }

    let total = 0;
    listEl.innerHTML = holdings.map(h => {
      let price = null;
      if (h.asset_type === "crypto" && cryptoPrices[h.symbol]) price = cryptoPrices[h.symbol][currency];
      if (h.asset_type === "stock" && stockPrices[h.symbol]) price = parseFloat(stockPrices[h.symbol].close);
      const value = price != null ? price * h.quantity : null;
      if (value != null) total += value;
      return `
        <div class="holding-row" data-id="${h.id}" data-type="${h.asset_type}" data-symbol="${h.symbol}" data-label="${h.label || h.symbol}" data-quantity="${h.quantity}" data-avg="${h.avg_price || ""}">
          <div class="h-name">${h.label || h.symbol} <span style="color:var(--ivory-dim); font-size:12px;">× ${h.quantity}</span></div>
          <div class="h-val">${value != null ? fmtUsd(value) : (h.asset_type === "stock" ? "needs API key" : "—")}</div>
        </div>`;
    }).join("");

    document.getElementById("portfolio-total").textContent = fmtUsd(total);
    lastPortfolioTotal = total;
    refreshNetWorth();

    listEl.querySelectorAll(".holding-row").forEach(row => {
      row.addEventListener("click", () => openHoldingDetail(row.dataset.type, row.dataset.symbol, row.dataset.label, {
        id: row.dataset.id, quantity: parseFloat(row.dataset.quantity), avgPrice: row.dataset.avg ? parseFloat(row.dataset.avg) : null
      }));
    });
  }

  async function bootMarkets() {
    await bootWatchlist();

    const statusEl = document.getElementById("portfolio-sync-status");
    async function refreshPortfolio() {
      try {
        const { data: holdings, isOffline } = await ThroneOfflineCache.cachedLoad("portfolio-holdings", () => ThroneSync.loadPortfolio());
        await renderPortfolio(holdings);
        if (isOffline) { setOfflineIndicator(true); statusEl.textContent = "Offline — showing your last saved holdings (prices may be stale too)."; }
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
      const avg = parseFloat(document.getElementById("holding-avg-input").value);
      if (!symbol || isNaN(qty)) return;
      document.getElementById("holding-symbol-input").value = "";
      document.getElementById("holding-label-input").value = "";
      document.getElementById("holding-qty-input").value = "";
      document.getElementById("holding-avg-input").value = "";
      await ThroneSync.addHolding(type, type === "stock" ? symbol.toUpperCase() : symbol, label, qty, isNaN(avg) ? null : avg);
      statusEl.textContent = "Added.";
    });
  }

  // ---------- DASHBOARD CORE STATS (Tasks Cleared, Goals in Motion, Vault Messages) ----------
  async function refreshDashboardCoreStats() {
    try {
      const [tasks, goals, unread] = await Promise.all([
        ThroneSync.loadTasks(), ThroneSync.loadGoals(), ThroneSync.loadUnreadMessageCount()
      ]);

      const doneCount = tasks.filter(t => t.done).length;
      document.getElementById("dash-tasks-value").innerHTML = `${doneCount} <small>/ ${tasks.length}</small>`;
      document.getElementById("dash-tasks-delta").textContent = tasks.length
        ? (doneCount === tasks.length ? "All clear" : `${tasks.length - doneCount} remaining`)
        : "Nothing queued";

      const inMotion = goals.filter(g => g.progress_pct < 100).length;
      document.getElementById("dash-goals-value").textContent = inMotion;
      document.getElementById("dash-goals-delta").textContent = goals.length
        ? `${goals.filter(g => g.progress_pct === 100).length} completed`
        : "No goals yet";

      document.getElementById("dash-vault-value").textContent = unread > 0 ? `${unread} new` : "0";
      const vaultDeltaEl = document.getElementById("dash-vault-delta");
      vaultDeltaEl.textContent = unread > 0 ? `${unread} unread` : "All read";
      vaultDeltaEl.className = "delta" + (unread > 0 ? " down" : "");
    } catch (e) { /* dashboard tiles just stay at their last known values */ }
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

  let hdChart = null;
  let hdCurrentContext = null; // { assetType, symbol, label, holding }

  async function openHoldingDetail(assetType, symbol, label, holding) {
    hdCurrentContext = { assetType, symbol, label, holding: holding || null };
    document.getElementById("hd-label").textContent = label;
    document.getElementById("hd-symbol").textContent = `${assetType.toUpperCase()} · ${symbol}`;
    document.getElementById("hd-price").textContent = "—";
    document.getElementById("hd-change").textContent = "";
    document.getElementById("holding-detail-overlay").classList.add("show");

    const currency = getCurrency().toLowerCase();
    let currentPrice = null, changePct = null;

    try {
      if (assetType === "crypto") {
        const prices = await ThroneMarkets.getCryptoPrices([symbol], currency);
        const p = prices[symbol];
        if (p) { currentPrice = p[currency]; changePct = p[`${currency}_24h_change`]; }
      } else if (ThroneMarkets.hasStockKey()) {
        const prices = await ThroneMarkets.getStockPrices([symbol]);
        const q = prices[symbol];
        if (q) { currentPrice = parseFloat(q.close); changePct = parseFloat(q.percent_change); }
      }
    } catch (e) { /* leave as — */ }

    document.getElementById("hd-price").textContent = currentPrice != null ? fmtUsd(currentPrice) : "—";
    const changeEl = document.getElementById("hd-change");
    if (changePct != null) {
      changeEl.textContent = (changePct >= 0 ? "▲" : "▼") + Math.abs(changePct).toFixed(2) + "%";
      changeEl.className = "m-change " + (changePct >= 0 ? "up" : "down");
    } else {
      changeEl.textContent = "";
    }

    // chart
    let points = [];
    try {
      points = assetType === "crypto"
        ? await ThroneMarkets.getCryptoChart(symbol, 30, currency)
        : await ThroneMarkets.getStockChart(symbol);
    } catch (e) { points = []; }
    if (hdChart) hdChart.destroy();
    hdChart = new Chart(document.getElementById("hd-chart"), {
      type: "line",
      data: {
        labels: points.map(p => new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
        datasets: [{
          data: points.map(p => p.y), borderColor: "#c9a84c", backgroundColor: "rgba(201,168,76,0.08)",
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
        }]
      },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#a9a290", maxTicksLimit: 6 }, grid: { color: "#2a251c" } },
          y: { ticks: { color: "#a9a290" }, grid: { color: "#2a251c" } }
        }
      }
    });

    // portfolio vs. add sections
    if (holding) {
      document.getElementById("hd-portfolio-section").style.display = "block";
      document.getElementById("hd-add-section").style.display = "none";
      document.getElementById("hd-qty").textContent = holding.quantity;
      const value = currentPrice != null ? currentPrice * holding.quantity : null;
      document.getElementById("hd-value").textContent = value != null ? fmtUsd(value) : "—";
      document.getElementById("hd-avg").textContent = holding.avgPrice != null ? fmtUsd(holding.avgPrice) : "Not set";
      const pnlEl = document.getElementById("hd-pnl");
      if (holding.avgPrice != null && currentPrice != null) {
        const pnl = (currentPrice - holding.avgPrice) * holding.quantity;
        const pnlPct = ((currentPrice - holding.avgPrice) / holding.avgPrice) * 100;
        pnlEl.textContent = `${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`;
        pnlEl.style.color = pnl >= 0 ? "#7ba885" : "#c98c7f";
      } else {
        pnlEl.textContent = "Add an avg. price to track";
        pnlEl.style.color = "var(--ivory-dim)";
      }
      document.getElementById("hd-edit-qty").value = holding.quantity;
      document.getElementById("hd-edit-avg").value = holding.avgPrice || "";
    } else {
      document.getElementById("hd-portfolio-section").style.display = "none";
      document.getElementById("hd-add-section").style.display = "block";
    }
  }

  function closeHoldingDetail() {
    document.getElementById("holding-detail-overlay").classList.remove("show");
    hdCurrentContext = null;
  }

  function bootHoldingDetailModal() {
    document.getElementById("hd-close").addEventListener("click", closeHoldingDetail);
    document.getElementById("holding-detail-overlay").addEventListener("click", (e) => {
      if (e.target.id === "holding-detail-overlay") closeHoldingDetail();
    });

    document.getElementById("hd-save-btn").addEventListener("click", async () => {
      if (!hdCurrentContext?.holding) return;
      const qty = parseFloat(document.getElementById("hd-edit-qty").value);
      const avg = parseFloat(document.getElementById("hd-edit-avg").value);
      if (isNaN(qty)) return;
      await ThroneSync.updateHolding(hdCurrentContext.holding.id, qty, isNaN(avg) ? null : avg);
      closeHoldingDetail();
    });

    document.getElementById("hd-remove-btn").addEventListener("click", async () => {
      if (!hdCurrentContext?.holding) return;
      if (confirm("Remove this holding from your portfolio?")) {
        await ThroneSync.removeHolding(hdCurrentContext.holding.id);
        closeHoldingDetail();
      }
    });

    document.getElementById("hd-add-btn").addEventListener("click", async () => {
      if (!hdCurrentContext) return;
      const qty = parseFloat(document.getElementById("hd-add-qty").value);
      const avg = parseFloat(document.getElementById("hd-add-avg").value);
      if (isNaN(qty)) return;
      const { assetType, symbol, label } = hdCurrentContext;
      await ThroneSync.addHolding(assetType, symbol, label, qty, isNaN(avg) ? null : avg);
      closeHoldingDetail();
    });
  }

  // ---------- NOTIFICATIONS (bell dropdown) ----------
  function timeAgoShort(dateStr) {
    return ThroneFeeds.timeAgo(dateStr);
  }

  function renderNotifList(notifications) {
    const listEl = document.getElementById("notif-list");
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById("notif-badge");
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    badge.style.display = unreadCount > 0 ? "flex" : "none";

    if (!notifications.length) {
      listEl.innerHTML = `<div class="feed-empty">Nothing yet.</div>`;
      return;
    }
    listEl.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}" data-url="${n.url || ""}">
        <div class="n-title">${n.title}</div>
        ${n.body ? `<div class="n-body">${n.body}</div>` : ""}
        <div class="n-time">${timeAgoShort(n.created_at)}</div>
      </div>`).join("");

    listEl.querySelectorAll(".notif-item").forEach(item => {
      item.addEventListener("click", async () => {
        await ThroneSync.markNotificationRead(item.dataset.id);
      });
    });
  }

  async function bootNotifications() {
    let notifications = [];
    try {
      notifications = await ThroneSync.loadNotifications();
      renderNotifList(notifications);
    } catch (e) {
      // Notifications table might not exist yet if this migration
      // hasn't been run — fail quietly rather than break the whole app.
    }

    const bell = document.getElementById("notif-bell");
    const dropdown = document.getElementById("notif-dropdown");
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && e.target !== bell) dropdown.classList.remove("show");
    });

    ThroneSync.subscribeNotifications(async () => {
      try {
        notifications = await ThroneSync.loadNotifications();
        renderNotifList(notifications);
      } catch (e) { /* table may not exist yet — see above */ }
    });
  }

  // ---------- GLOBAL SEARCH (v1) ----------
  // Deliberately scoped: searches Tasks, Goals, and Fitness logs only.
  // Vault messages are NOT indexed here on purpose — building a search
  // index means keeping plaintext somewhere searchable, which cuts
  // against the whole point of end-to-end encrypting them in the
  // first place. Reuses the same cache keys offline-cache.js already
  // populates, so search works offline too, for free.
  function switchToView(viewName) {
    document.querySelectorAll('.rail-btn[data-view]').forEach(b => b.classList.toggle("active", b.dataset.view === viewName));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + viewName));
  }

  async function runGlobalSearch(query) {
    const q = query.trim().toLowerCase();
    const resultsEl = document.getElementById("search-results");
    if (!q) { resultsEl.innerHTML = ""; return; }

    const [tasksRes, goalsRes, logsRes] = await Promise.allSettled([
      ThroneOfflineCache.cachedLoad("tasks", () => ThroneSync.loadTasks()),
      ThroneOfflineCache.cachedLoad("goals", () => ThroneSync.loadGoals()),
      ThroneOfflineCache.cachedLoad("exercise-logs", () => ThroneSync.loadExerciseLogs(200))
    ]);

    const results = [];
    if (tasksRes.status === "fulfilled") {
      tasksRes.value.data.filter(t => t.title.toLowerCase().includes(q)).slice(0, 6)
        .forEach(t => results.push({ type: "Task", title: t.title, view: "productivity" }));
    }
    if (goalsRes.status === "fulfilled") {
      goalsRes.value.data.filter(g => g.title.toLowerCase().includes(q)).slice(0, 6)
        .forEach(g => results.push({ type: "Goal", title: g.title, view: "goals" }));
    }
    if (logsRes.status === "fulfilled") {
      const seen = new Set();
      logsRes.value.data.filter(l => l.exercise_name.toLowerCase().includes(q)).forEach(l => {
        if (seen.has(l.exercise_name)) return;
        seen.add(l.exercise_name);
        results.push({ type: "Fitness", title: l.exercise_name, view: "fitness" });
      });
    }

    resultsEl.innerHTML = results.length
      ? results.slice(0, 20).map(r => `
          <div class="search-result" data-view="${r.view}">
            <span class="sr-type">${r.type}</span><span class="sr-title">${r.title}</span>
          </div>`).join("")
      : `<div class="feed-empty">No matches in Tasks, Goals, or Fitness.</div>`;

    resultsEl.querySelectorAll(".search-result").forEach(el => {
      el.addEventListener("click", () => {
        switchToView(el.dataset.view);
        document.getElementById("search-overlay").classList.remove("show");
      });
    });
  }

  function bootSearch() {
    const overlay = document.getElementById("search-overlay");
    const input = document.getElementById("search-input");
    document.getElementById("search-icon").addEventListener("click", () => {
      overlay.classList.add("show");
      input.value = "";
      document.getElementById("search-results").innerHTML = "";
      setTimeout(() => input.focus(), 50);
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("show"); });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        overlay.classList.add("show");
        setTimeout(() => input.focus(), 50);
      }
      if (e.key === "Escape") overlay.classList.remove("show");
    });
    let debounceTimer = null;
    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runGlobalSearch(input.value), 150);
    });
  }

  // ---------- ONBOARDING (first run only, per account) ----------
  function bootOnboarding() {
    const user = ThroneAuth.getUser();
    const key = "throne-onboarded-" + user.id;
    if (localStorage.getItem(key)) return; // seen it already

    const overlay = document.getElementById("onboard-overlay");
    const steps = overlay.querySelectorAll(".onboard-step");
    const dots = overlay.querySelectorAll(".onboard-dot");
    let step = 0;

    function render() {
      steps.forEach((el, i) => el.style.display = i === step ? "block" : "none");
      dots.forEach((el, i) => el.classList.toggle("on", i === step));
      document.getElementById("onboard-next").textContent = step === steps.length - 1 ? "Enter" : "Next";
    }
    function finish() {
      localStorage.setItem(key, "1");
      overlay.classList.remove("show");
    }
    document.getElementById("onboard-next").addEventListener("click", () => {
      step++;
      if (step >= steps.length) { finish(); return; }
      render();
    });
    document.getElementById("onboard-skip").addEventListener("click", finish);

    render();
    overlay.classList.add("show");
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

    // ---- API usage today ----
    const USAGE_LABELS = {
      stock_price: "Twelve Data (stock prices)", stock_chart: "Twelve Data (stock charts)",
      youtube_channel: "YouTube (channels)", youtube_search: "YouTube (search)", youtube_resolve_handle: "YouTube (handle lookup)",
      opensea_stats: "OpenSea", news_rss: "News RSS",
      crypto_price: "CoinGecko (prices)", crypto_chart: "CoinGecko (charts)"
    };
    try {
      const usage = await ThroneSync.loadApiUsageToday();
      const entries = Object.entries(usage);
      const usageListEl = document.getElementById("usage-list");
      if (!entries.length) {
        usageListEl.innerHTML = `<div class="feed-empty">No live calls yet today — everything so far came from cache.</div>`;
      } else {
        usageListEl.innerHTML = entries.map(([domain, count]) => `
          <div class="task-row"><div class="txt">${USAGE_LABELS[domain] || domain}</div><div class="prio">${count}</div></div>
        `).join("");
      }
      document.getElementById("usage-status").textContent = "since midnight";
    } catch (e) {
      document.getElementById("usage-status").textContent = "unavailable";
    }

    // ---- delete account ----
    document.getElementById("delete-account-btn").addEventListener("click", async () => {
      const input = document.getElementById("delete-account-confirm-input");
      const statusEl = document.getElementById("delete-account-status");
      if (input.value.trim() !== "DELETE") {
        statusEl.textContent = "Type DELETE (all caps) in the box first.";
        return;
      }
      if (!confirm("This permanently deletes your account and everything in it — tasks, goals, fitness logs, treasury data, every Vault message. There is no undo. Continue?")) return;
      statusEl.textContent = "Deleting…";
      try {
        await ThroneSync.deleteMyAccount();
        alert("Your account has been deleted.");
        window.location.reload();
      } catch (e) {
        statusEl.textContent = "Couldn't delete account: " + e.message;
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
        ${k.modelUrl
          ? `<div class="kingdom-model-wrap" data-no-card-click>
               <model-viewer
                 src="${k.modelUrl}"
                 alt="${k.kingdomTitle} seal"
                 auto-rotate auto-rotate-delay="0" rotation-per-second="18deg"
                 camera-controls disable-zoom disable-pan interaction-prompt="none"
                 shadow-intensity="0" exposure="1" loading="lazy">
               </model-viewer>
             </div>`
          : `<div class="kingdom-seal">${k.kingdomTitle.charAt(4)}</div>`}
        <h4>${k.kingdomTitle}</h4>
        <div class="k-tagline">${k.tagline}</div>
        <div class="k-count" id="kcount-${k.id}">— posts</div>
        ${k.inviteUrl
          ? `<a class="kingdom-invite-link" href="${k.inviteUrl}" target="_blank" rel="noopener" data-no-card-click>${k.inviteLabel || "Visit"}</a>`
          : ""}
      </div>`).join("");

    // The model (drag-to-rotate) and the invite link both need clicks that
    // don't also toggle the card's kingdom filter underneath them.
    container.querySelectorAll("[data-no-card-click]").forEach(el => {
      ["pointerdown", "click"].forEach(evt => el.addEventListener(evt, e => e.stopPropagation()));
    });

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
      startCallSafely(row.dataset.otherId, row.dataset.otherName);
    }));
  }

  // startCall()/answerCall() were being fired without a .catch anywhere —
  // if getUserMedia rejected (camera permission denied, camera already in
  // use by another app/tab, no camera found) the whole thing failed
  // completely silently: no camera, no call screen, nothing. This makes
  // that failure visible instead, with a message that actually explains
  // what went wrong rather than just "it didn't work."
  function describeCallError(err) {
    const name = err && err.name;
    if (name === "NotAllowedError") return "Camera/mic permission was denied. Check your browser's site settings and allow access, then try again.";
    if (name === "NotFoundError") return "No camera or microphone was found on this device.";
    if (name === "NotReadableError") return "Your camera is already in use by another app or browser tab. Close it and try again.";
    return (err && err.message) ? err.message : "Couldn't start the call.";
  }

  async function startCallSafely(otherId, otherName) {
    try {
      await ThroneCall.startCall(otherId, otherName);
    } catch (err) {
      alert(describeCallError(err));
    }
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
        statusEl.textContent = detail && detail.reason === "timeout"
          ? "Couldn't connect — this can happen on networks that block direct video calls"
          : "Call ended";
        setTimeout(hideCallOverlay, detail && detail.reason === "timeout" ? 3000 : 1000);
      }
    });

    document.getElementById("call-accept-btn").addEventListener("click", async () => {
      if (!pendingIncoming) return;
      document.getElementById("call-incoming-actions").style.display = "none";
      document.getElementById("call-active-controls").style.display = "flex";
      document.getElementById("call-status").textContent = "Connecting…";
      try {
        await ThroneCall.answerCall(pendingIncoming.roomId);
      } catch (err) {
        document.getElementById("call-status").textContent = describeCallError(err);
        setTimeout(hideCallOverlay, 3000);
      }
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
      startCallSafely(t.otherProfile.id, t.otherProfile.display_name || t.otherProfile.email);
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
        <a href="https://opensea.io/${c.slug}" target="_blank" rel="noopener">View on OpenSea</a>
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

  async function renderColosseum() {
    const grid = document.getElementById("colosseum-grid");
    const statusEl = document.getElementById("colosseum-status");
    try {
      const videos = await ThroneKings.getChannelVideos(KINGS_CONFIG.colosseum.channelId, KINGS_CONFIG.colosseum.videoCount);
      if (!videos.length) {
        grid.innerHTML = `<div class="feed-empty">No videos found on the channel yet.</div>`;
        statusEl.textContent = "0 videos";
        return;
      }
      grid.innerHTML = videos.map(v => `
        <a class="video-card" href="${v.link}" target="_blank" rel="noopener">
          <div class="video-thumb">${v.thumbnail ? `<img src="${v.thumbnail}" alt="" loading="lazy">` : ""}</div>
          <div class="video-card-body">
            <div class="video-card-title">${v.title}</div>
            <div class="video-card-date">${ThroneFeeds.timeAgo(v.published)}</div>
          </div>
        </a>`).join("");
      statusEl.textContent = `${videos.length} latest`;
    } catch (e) {
      const notConfigured = /YouTube key configured server-side/i.test(e.message || "");
      if (notConfigured) {
        grid.innerHTML = `<div class="feed-empty">Set a YouTube API key as an Edge Function secret — see DATA_PROXY_SETUP.md.</div>`;
        statusEl.textContent = "needs setup";
      } else {
        grid.innerHTML = `<div class="feed-empty">Couldn't load the channel feed right now — check the YouTube key set on the data-proxy Edge Function is valid.</div>`;
        statusEl.textContent = "unavailable";
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
    renderColosseum();
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

  function bootCurrencySetting() {
    const select = document.getElementById("settings-currency-select");
    select.value = getCurrency();
    select.addEventListener("change", async () => {
      setCurrency(select.value);
      // refresh anything currently showing prices so the change is visible immediately
      renderWatchlist();
      try {
        const holdings = await ThroneSync.loadPortfolio();
        renderPortfolio(holdings);
      } catch (e) { /* portfolio will pick up new currency on next natural refresh regardless */ }
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
          <div style="flex:1; min-width:0;"><div class="vname">${t.otherProfile.display_name || t.otherProfile.email}</div>
          <div class="vlast">${t.otherProfile.email}</div></div>
          <span class="vault-thread-remove" data-id="${id}" title="Remove chamber">✕</span>
        </div>`;
    }).join("");

    listEl.querySelectorAll(".vlist-item").forEach(item => {
      item.addEventListener("click", () => openThread(item.dataset.id));
    });
    listEl.querySelectorAll(".vault-thread-remove").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const t = vaultThreads[btn.dataset.id];
        const name = t ? (t.otherProfile.display_name || t.otherProfile.email) : "this chamber";
        if (!confirm(`Remove your chamber with ${name}? This deletes the whole conversation for both of you — it can't be undone.`)) return;
        await ThroneSync.removeThread(btn.dataset.id);
        delete vaultThreads[btn.dataset.id];
        if (activeThreadId === btn.dataset.id) {
          activeThreadId = null;
          if (activeThreadSub) supabaseClient.removeChannel(activeThreadSub);
          document.getElementById("vault-msgs").innerHTML = `<div class="feed-empty">Select a chamber.</div>`;
        }
        renderThreadList();
      });
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
    await ThroneSync.markThreadMessagesRead(threadId);
    refreshDashboardCoreStats();

    if (activeThreadSub) supabaseClient.removeChannel(activeThreadSub);
    activeThreadSub = ThroneSync.subscribeThreadMessages(threadId, async () => {
      const fresh = await ThroneSync.loadThreadMessages(threadId, t.otherProfile.public_key);
      renderMessages(fresh);
      await ThroneSync.markThreadMessagesRead(threadId);
      refreshDashboardCoreStats();
    });
  }

  async function bootVault() {
    try {
      const threads = await ThroneSync.loadMyThreads();
      threads.forEach(t => { vaultThreads[t.threadId] = { otherProfile: t.otherProfile }; });
      renderThreadList();
    } catch (e) {
      // Leave the list empty rather than block the rest of Vault setup —
      // the "add someone" flow below still works even if this failed.
    }

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
