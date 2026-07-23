/* ============================================================
   THE THRONE — SYNC ENGINE
   CRUD + realtime subscriptions for tasks, goals, and Vault
   messages. Everything here is scoped to the signed-in user via
   Supabase Row Level Security (see schema.sql) — this file never
   needs to check "is this mine?" itself, the database enforces it.
   ============================================================ */

const ThroneSync = (() => {
  // Unique per-call suffix — prevents channel name collisions when the
  // same subscribe function is called from more than one place (e.g.
  // Circle and King's Gallery both listening to social_posts changes).
  function uniqueChannelSuffix() {
    return Math.random().toString(36).slice(2, 9);
  }


  // ---------- TASKS ----------
  async function loadTasks() {
    const { data, error } = await supabaseClient
      .from("tasks").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addTask(title, priority = "med", due_date = null, recurrence = "none") {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("tasks").insert({ title, priority, due_date, recurrence, user_id: user.id });
  }

  async function toggleTask(id, done) {
    return supabaseClient.from("tasks").update({ done, completed_at: done ? new Date().toISOString() : null }).eq("id", id);
  }

  async function removeTask(id) {
    return supabaseClient.from("tasks").delete().eq("id", id);
  }

  // Deletes tasks that were marked done more than 24 hours ago. Safe to
  // call on every load — only touches already-completed, already-old tasks.
  async function purgeOldCompletedTasks() {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    return supabaseClient.from("tasks").delete().eq("done", true).lt("completed_at", cutoff);
  }

  function subscribeTasks(onChange) {
    return supabaseClient
      .channel("tasks-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
      .subscribe();
  }

  // Sets (or clears, if reminderAtIso is null) a push-reminder time on a
  // task. reminder_sent resets to false so a changed time re-arms it —
  // the scheduled Edge Function (see TASK_REMINDERS_SETUP.md) picks up
  // anything due with reminder_sent = false.
  async function setTaskReminder(id, reminderAtIso) {
    return supabaseClient.from("tasks")
      .update({ reminder_at: reminderAtIso, reminder_sent: false })
      .eq("id", id);
  }

  // ---------- TIME BLOCKS (standalone hour-grid scheduling) ----------
  async function loadTimeBlocks(day) {
    const { data, error } = await supabaseClient
      .from("time_blocks").select("*").eq("day", day).order("start_minutes", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addTimeBlock(label, day, startMinutes, durationMinutes, color) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("time_blocks").insert({
      user_id: user.id, label, day, start_minutes: startMinutes,
      duration_minutes: durationMinutes, color: color || null
    });
  }

  async function removeTimeBlock(id) {
    return supabaseClient.from("time_blocks").delete().eq("id", id);
  }

  function subscribeTimeBlocks(onChange) {
    return supabaseClient
      .channel("time-blocks-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "time_blocks" }, onChange)
      .subscribe();
  }

  // ---------- SOCIAL FOLLOWS (YouTube channels + X accounts, Your Feed) ----------
  async function loadSocialFollows(platform) {
    const user = ThroneAuth.getUser();
    const { data, error } = await supabaseClient
      .from("social_follows").select("*")
      .eq("user_id", user.id).eq("platform", platform)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addSocialFollow(platform, identifier, label) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("social_follows").insert({
      user_id: user.id, platform, identifier, label: label || null
    });
  }

  async function removeSocialFollow(id) {
    return supabaseClient.from("social_follows").delete().eq("id", id);
  }

  function subscribeSocialFollows(onChange) {
    return supabaseClient
      .channel("social-follows-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "social_follows" }, onChange)
      .subscribe();
  }

  // ---------- NOTIFICATIONS (in-app history) ----------
  async function loadNotifications(limit = 30) {
    const user = ThroneAuth.getUser();
    const { data, error } = await supabaseClient
      .from("notifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  }

  async function markNotificationRead(id) {
    return supabaseClient.from("notifications").update({ read: true }).eq("id", id);
  }

  async function markAllNotificationsRead() {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  }

  function subscribeNotifications(onChange) {
    const user = ThroneAuth.getUser();
    return supabaseClient
      .channel("notifications-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, onChange)
      .subscribe();
  }

  // ---------- API USAGE (Settings panel) ----------
  async function loadApiUsageToday() {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data, error } = await supabaseClient
      .from("api_usage_log").select("domain").gte("called_at", since.toISOString());
    if (error) throw error;
    const counts = {};
    (data || []).forEach(row => { counts[row.domain] = (counts[row.domain] || 0) + 1; });
    return counts;
  }

  // ---------- ACCOUNT DELETION ----------
  async function deleteMyAccount() {
    const { data, error } = await supabaseClient.functions.invoke("delete-account", { body: {} });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  // ---------- FOCUS SESSIONS (real time-tracking) ----------
  async function logFocusSession(taskTitle, durationMinutes) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("focus_sessions").insert({
      user_id: user.id, task_title: taskTitle, duration_minutes: durationMinutes
    });
  }

  async function loadFocusSessions(sinceDays = 7) {
    const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabaseClient
      .from("focus_sessions").select("*").gte("completed_at", since)
      .order("completed_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  // ---------- GOALS ----------
  async function loadGoals() {
    const { data, error } = await supabaseClient
      .from("goals").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addGoal(title, progress_pct = 0, meta = "") {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("goals").insert({ title, progress_pct, meta, user_id: user.id });
  }

  async function updateGoalProgress(id, progress_pct) {
    return supabaseClient.from("goals").update({ progress_pct }).eq("id", id);
  }

  async function removeGoal(id) {
    return supabaseClient.from("goals").delete().eq("id", id);
  }

  function subscribeGoals(onChange) {
    return supabaseClient
      .channel("goals-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, onChange)
      .subscribe();
  }

  // ---------- FITNESS ----------
  async function loadFitnessLogs(limit = 60) {
    const { data, error } = await supabaseClient
      .from("fitness_logs").select("*").order("logged_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  }

  async function logMetric(metric, value) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("fitness_logs").insert({ metric, value, user_id: user.id });
  }

  function subscribeFitness(onChange) {
    return supabaseClient
      .channel("fitness-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "fitness_logs" }, onChange)
      .subscribe();
  }

  // ---------- WORKOUT SPLITS ----------
  function currentWeekStart() {
    const d = new Date();
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }

  async function loadSplits() {
    const { data, error } = await supabaseClient
      .from("workout_splits").select("*")
      .eq("week_start", currentWeekStart())
      .order("day_of_week", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function upsertSplit(dayOfWeek, label, status) {
    const user = ThroneAuth.getUser();
    const weekStart = currentWeekStart();
    const { data: existing } = await supabaseClient
      .from("workout_splits").select("id")
      .eq("day_of_week", dayOfWeek).eq("week_start", weekStart).eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return supabaseClient.from("workout_splits")
        .update({ label, status }).eq("id", existing.id);
    }
    return supabaseClient.from("workout_splits").insert({
      user_id: user.id, day_of_week: dayOfWeek, label, status, week_start: weekStart
    });
  }

  function subscribeSplits(onChange) {
    return supabaseClient
      .channel("splits-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "workout_splits" }, onChange)
      .subscribe();
  }

  // ---------- SOCIAL POSTS (manual entry — see README for why) ----------
  async function loadSocialPosts() {
    const { data, error } = await supabaseClient
      .from("social_posts").select("*").order("posted_at", { ascending: false }).limit(20);
    if (error) throw error;
    return data;
  }

  async function addSocialPost(platform, caption, link, image_url) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("social_posts").insert({ user_id: user.id, platform, caption, link, image_url });
  }

  function subscribeSocialPosts(onChange) {
    return supabaseClient
      .channel("social-posts-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "social_posts" }, onChange)
      .subscribe();
  }

  // ---------- CUSTOM NEWS TOPICS ----------
  async function loadCustomTopics() {
    const { data, error } = await supabaseClient
      .from("news_topics").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addCustomTopic(name) {
    const user = ThroneAuth.getUser();
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(name)}&hl=en-US&gl=US&ceid=US:en`;
    return supabaseClient.from("news_topics").insert({ user_id: user.id, name, rss_url: rssUrl });
  }

  async function removeCustomTopic(id) {
    return supabaseClient.from("news_topics").delete().eq("id", id);
  }

  function subscribeCustomTopics(onChange) {
    return supabaseClient
      .channel("news-topics-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "news_topics" }, onChange)
      .subscribe();
  }

  // ---------- PORTFOLIO ----------
  async function loadPortfolio() {
    const { data, error } = await supabaseClient
      .from("portfolio_holdings").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addHolding(asset_type, symbol, label, quantity, avgPrice) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("portfolio_holdings").insert({ user_id: user.id, asset_type, symbol, label, quantity, avg_price: avgPrice || null });
  }

  async function updateHolding(id, quantity, avgPrice) {
    const updates = { quantity };
    if (avgPrice !== undefined) updates.avg_price = avgPrice;
    return supabaseClient.from("portfolio_holdings").update(updates).eq("id", id);
  }

  async function removeHolding(id) {
    return supabaseClient.from("portfolio_holdings").delete().eq("id", id);
  }

  function subscribePortfolio(onChange) {
    return supabaseClient
      .channel("portfolio-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolio_holdings" }, onChange)
      .subscribe();
  }

  // ---------- EXERCISE LOGS (real sets/reps/weight/RPE tracking) ----------
  async function loadExerciseLogs(limit = 200) {
    const { data, error } = await supabaseClient
      .from("exercise_logs").select("*").order("logged_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  }

  async function logExercise(exerciseName, weight, reps, sets, rpe) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("exercise_logs").insert({
      user_id: user.id, exercise_name: exerciseName, weight, reps, sets, rpe: rpe || null
    });
  }

  async function removeExerciseLog(id) {
    return supabaseClient.from("exercise_logs").delete().eq("id", id);
  }

  function subscribeExerciseLogs(onChange) {
    return supabaseClient
      .channel("exercise-logs-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "exercise_logs" }, onChange)
      .subscribe();
  }

  // ---------- PUSH NOTIFICATIONS ----------
  async function savePushSubscription(subscription) {
    const user = ThroneAuth.getUser();
    const json = subscription.toJSON();
    return supabaseClient.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth
    }, { onConflict: "endpoint" });
  }

  async function removePushSubscription(endpoint) {
    return supabaseClient.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }

  // ---------- PROFILE ----------
  async function updateDisplayName(name) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("profiles").update({ display_name: name }).eq("id", user.id);
  }

  // ---------- ALLIANCES (friends list) ----------
  async function loadAlliances() {
    const user = ThroneAuth.getUser();
    const { data, error } = await supabaseClient
      .from("alliances").select("*, requester:requester_id(email, display_name), recipient:recipient_id(email, display_name)")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async function sendAllianceRequest(email) {
    const user = ThroneAuth.getUser();
    const { data: target, error: lookupErr } = await supabaseClient
      .from("profiles").select("id, email").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!target) throw new Error(`No one with email ${email} has signed into The Throne yet.`);
    if (target.id === user.id) throw new Error("You can't ally with yourself.");
    return supabaseClient.from("alliances").insert({ requester_id: user.id, recipient_id: target.id });
  }

  async function respondToAlliance(id, status) {
    return supabaseClient.from("alliances").update({ status }).eq("id", id);
  }

  async function removeAlliance(id) {
    return supabaseClient.from("alliances").delete().eq("id", id);
  }

  function subscribeAlliances(onChange) {
    return supabaseClient
      .channel("alliances-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "alliances" }, onChange)
      .subscribe();
  }

  // ---------- OTHER ASSETS (net worth beyond portfolio) ----------
  async function loadOtherAssets() {
    const { data, error } = await supabaseClient
      .from("other_assets").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addOtherAsset(category, label, value) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("other_assets").insert({ user_id: user.id, category, label, value });
  }

  async function updateOtherAssetValue(id, value) {
    return supabaseClient.from("other_assets").update({ value, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function removeOtherAsset(id) {
    return supabaseClient.from("other_assets").delete().eq("id", id);
  }

  function subscribeOtherAssets(onChange) {
    return supabaseClient
      .channel("other-assets-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "other_assets" }, onChange)
      .subscribe();
  }

  // ---------- INVESTMENT PLANS (Autoinvest-style planning) ----------
  async function loadInvestmentPlans() {
    const { data, error } = await supabaseClient
      .from("investment_plans").select("*, holding:holding_id(label, symbol, asset_type)")
      .order("next_due", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addInvestmentPlan(label, holdingId, amount, frequency, nextDue) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("investment_plans").insert({
      user_id: user.id, label, holding_id: holdingId || null, amount, frequency, next_due: nextDue
    });
  }

  function advanceDate(dateStr, frequency) {
    const d = new Date(dateStr + "T00:00:00");
    if (frequency === "weekly") d.setDate(d.getDate() + 7);
    else if (frequency === "fortnightly") d.setDate(d.getDate() + 14);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  // Logs a contribution: bumps the linked holding's quantity (if the
  // plan has one) and rolls next_due forward. This is a manual planning
  // action, not a real trade — see README for why.
  async function logPlanContribution(plan, quantityToAdd) {
    if (plan.holding_id && quantityToAdd) {
      const { data: holding } = await supabaseClient
        .from("portfolio_holdings").select("quantity").eq("id", plan.holding_id).maybeSingle();
      if (holding) {
        await supabaseClient.from("portfolio_holdings")
          .update({ quantity: holding.quantity + quantityToAdd }).eq("id", plan.holding_id);
      }
    }
    return supabaseClient.from("investment_plans")
      .update({ next_due: advanceDate(plan.next_due, plan.frequency) }).eq("id", plan.id);
  }

  async function removeInvestmentPlan(id) {
    return supabaseClient.from("investment_plans").delete().eq("id", id);
  }

  function subscribeInvestmentPlans(onChange) {
    return supabaseClient
      .channel("investment-plans-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "investment_plans" }, onChange)
      .subscribe();
  }

  // ---------- FINANCIAL INDEPENDENCE ----------
  async function updateFiExpenses(annualExpenses) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("profiles").update({ fi_annual_expenses: annualExpenses }).eq("id", user.id);
  }

  async function loadFiExpenses() {
    const user = ThroneAuth.getUser();
    const { data } = await supabaseClient
      .from("profiles").select("fi_annual_expenses").eq("id", user.id).maybeSingle();
    return data ? data.fi_annual_expenses : null;
  }

  // ---------- BUDGET ENVELOPES (Goodbudget-style) ----------
  async function loadEnvelopes() {
    const { data, error } = await supabaseClient
      .from("budget_envelopes").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addEnvelope(label, monthlyBudget) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("budget_envelopes").insert({ user_id: user.id, label, monthly_budget: monthlyBudget });
  }

  async function removeEnvelope(id) {
    return supabaseClient.from("budget_envelopes").delete().eq("id", id);
  }

  async function loadEnvelopeSpending(envelopeIds) {
    if (!envelopeIds.length) return {};
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { data, error } = await supabaseClient
      .from("envelope_expenses").select("envelope_id, amount")
      .in("envelope_id", envelopeIds).gte("logged_at", monthStart.toISOString());
    if (error) throw error;
    const totals = {};
    data.forEach(e => { totals[e.envelope_id] = (totals[e.envelope_id] || 0) + parseFloat(e.amount); });
    return totals;
  }

  async function logEnvelopeExpense(envelopeId, amount, note) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("envelope_expenses").insert({ envelope_id: envelopeId, user_id: user.id, amount, note });
  }

  function subscribeEnvelopes(onChange) {
    return supabaseClient
      .channel("envelope-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_envelopes" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "envelope_expenses" }, onChange)
      .subscribe();
  }

  // ---------- BILLS (GetReminded-style) ----------
  async function loadBills() {
    const { data, error } = await supabaseClient
      .from("bills").select("*").order("due_day", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addBill(label, amount, dueDay, category) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("bills").insert({ user_id: user.id, label, amount, due_day: dueDay, category });
  }

  async function markBillPaid(id) {
    return supabaseClient.from("bills").update({ last_paid: new Date().toISOString().slice(0, 10) }).eq("id", id);
  }

  async function removeBill(id) {
    return supabaseClient.from("bills").delete().eq("id", id);
  }

  function subscribeBills(onChange) {
    return supabaseClient
      .channel("bills-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, onChange)
      .subscribe();
  }

  // ---------- SAVINGS GOALS (Frollo/WeMoney-style, dollar-based) ----------
  async function loadSavingsGoals() {
    const { data, error } = await supabaseClient
      .from("savings_goals").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addSavingsGoal(label, targetAmount, targetDate) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("savings_goals").insert({
      user_id: user.id, label, target_amount: targetAmount, target_date: targetDate || null
    });
  }

  async function contributeSavingsGoal(id, currentAmount, addAmount) {
    return supabaseClient.from("savings_goals").update({ current_amount: currentAmount + addAmount }).eq("id", id);
  }

  async function removeSavingsGoal(id) {
    return supabaseClient.from("savings_goals").delete().eq("id", id);
  }

  function subscribeSavingsGoals(onChange) {
    return supabaseClient
      .channel("savings-goals-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_goals" }, onChange)
      .subscribe();
  }

  // ---------- WATCHLIST (user-editable, replaces hardcoded config) ----------
  async function loadWatchlist() {
    const { data, error } = await supabaseClient
      .from("watchlist_items").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addWatchlistItem(assetType, symbol, label) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("watchlist_items").insert({ user_id: user.id, asset_type: assetType, symbol, label });
  }

  async function removeWatchlistItem(id) {
    return supabaseClient.from("watchlist_items").delete().eq("id", id);
  }

  function subscribeWatchlist(onChange) {
    return supabaseClient
      .channel("watchlist-changes-" + uniqueChannelSuffix())
      .on("postgres_changes", { event: "*", schema: "public", table: "watchlist_items" }, onChange)
      .subscribe();
  }

  async function markThreadMessagesRead(threadId) {
    const user = ThroneAuth.getUser();
    return supabaseClient.from("vault_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", threadId).neq("sender_id", user.id).is("read_at", null);
  }

  async function loadUnreadMessageCount() {
    const user = ThroneAuth.getUser();
    const { data: myThreads } = await supabaseClient
      .from("vault_participants").select("thread_id").eq("user_id", user.id);
    if (!myThreads || !myThreads.length) return 0;
    const threadIds = myThreads.map(t => t.thread_id);
    const { count } = await supabaseClient
      .from("vault_messages").select("id", { count: "exact", head: true })
      .in("thread_id", threadIds).neq("sender_id", user.id).is("read_at", null);
    return count || 0;
  }

  // ---------- VAULT ----------
  // Get (or create) a two-person thread between me and another user's email.
  async function getOrCreateThreadWith(otherEmail) {
    const { data: otherProfile, error } = await supabaseClient
      .from("profiles").select("id, email, public_key, display_name")
      .eq("email", otherEmail.trim().toLowerCase())
      .maybeSingle();

    if (error) throw error;
    if (!otherProfile) {
      throw new Error(`No one with email ${otherEmail} has signed into The Throne yet.`);
    }
    if (!otherProfile.public_key) {
      throw new Error(`${otherEmail} hasn't generated their Vault key yet — ask them to open the Vault once first.`);
    }

    const threadId = await getOrCreateThreadWithUserId(otherProfile.id);
    return { threadId, otherProfile };
  }

  async function getOrCreateThreadWithUserId(otherUserId) {
    const user = ThroneAuth.getUser();

    const { data: existingThreads } = await supabaseClient
      .from("vault_participants").select("thread_id").eq("user_id", user.id);

    if (existingThreads && existingThreads.length) {
      const threadIds = existingThreads.map(t => t.thread_id);
      // NOTE: this used to be .maybeSingle(), which throws once more than
      // one shared thread exists between the same two people — and since
      // that error wasn't checked, it silently fell through to creating
      // ANOTHER thread every time, compounding duplicates forever. Taking
      // the first match instead means it can never error on multiplicity,
      // and it deterministically reuses the same (oldest) thread.
      const { data: sharedThreads } = await supabaseClient
        .from("vault_participants")
        .select("thread_id")
        .in("thread_id", threadIds)
        .eq("user_id", otherUserId)
        .order("thread_id", { ascending: true })
        .limit(1);
      if (sharedThreads && sharedThreads.length) return sharedThreads[0].thread_id;
    }

    const { data: newThread, error } = await supabaseClient
      .from("vault_threads").insert({ created_by: user.id }).select().single();
    if (error) throw error;

    await supabaseClient.from("vault_participants").insert([
      { thread_id: newThread.id, user_id: user.id },
      { thread_id: newThread.id, user_id: otherUserId }
    ]);

    return newThread.id;
  }

  // Loads every chamber the current user is already part of, so the Vault
  // list is populated on open instead of staying empty until you retype
  // someone's email. Done as separate queries (not a nested PostgREST
  // embed through vault_participants.user_id) because that column only
  // has a foreign key to auth.users, not profiles — same class of issue
  // fix-alliances-load.sql addressed for the alliances table.
  async function loadMyThreads() {
    const user = ThroneAuth.getUser();
    const { data: myRows, error } = await supabaseClient
      .from("vault_participants").select("thread_id").eq("user_id", user.id);
    if (error) throw error;
    if (!myRows || !myRows.length) return [];

    const threadIds = myRows.map(r => r.thread_id);
    const { data: otherRows, error: err2 } = await supabaseClient
      .from("vault_participants").select("thread_id, user_id")
      .in("thread_id", threadIds).neq("user_id", user.id);
    if (err2) throw err2;
    if (!otherRows || !otherRows.length) return [];

    const otherUserIds = [...new Set(otherRows.map(r => r.user_id))];
    const { data: profiles, error: err3 } = await supabaseClient
      .from("profiles").select("id, email, display_name, public_key")
      .in("id", otherUserIds);
    if (err3) throw err3;

    const profileById = {};
    (profiles || []).forEach(p => { profileById[p.id] = p; });

    return otherRows
      .map(r => ({ threadId: r.thread_id, otherProfile: profileById[r.user_id] }))
      .filter(t => t.otherProfile);
  }

  // Deletes a chamber entirely (messages + your and the other person's
  // membership row cascade-delete along with it — no separate cleanup
  // needed). Either participant can do this.
  async function removeThread(threadId) {
    return supabaseClient.from("vault_threads").delete().eq("id", threadId);
  }

  async function loadThreadMessages(threadId, otherPublicKeyBase64) {
    const { data, error } = await supabaseClient
      .from("vault_messages").select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const decrypted = [];
    for (const msg of data) {
      try {
        const plaintext = await VaultCrypto.decryptMessage(msg.ciphertext, msg.iv, otherPublicKeyBase64, msg.salt);
        decrypted.push({ ...msg, plaintext });
      } catch (e) {
        decrypted.push({ ...msg, plaintext: "[Could not decrypt — key mismatch]" });
      }
    }
    return decrypted;
  }

  async function sendMessage(threadId, plaintext, otherPublicKeyBase64) {
    const user = ThroneAuth.getUser();
    const { ciphertext, iv, salt } = await VaultCrypto.encryptMessage(plaintext, otherPublicKeyBase64);
    return supabaseClient.from("vault_messages").insert({
      thread_id: threadId, sender_id: user.id, ciphertext, iv, salt
    });
  }

  function subscribeThreadMessages(threadId, onNewMessage) {
    return supabaseClient
      .channel(`vault-thread-${threadId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "vault_messages", filter: `thread_id=eq.${threadId}` },
        onNewMessage
      )
      .subscribe();
  }

  return {
    loadTasks, addTask, toggleTask, removeTask, purgeOldCompletedTasks, subscribeTasks, setTaskReminder,
    loadTimeBlocks, addTimeBlock, removeTimeBlock, subscribeTimeBlocks,
    loadSocialFollows, addSocialFollow, removeSocialFollow, subscribeSocialFollows,
    loadNotifications, markNotificationRead, markAllNotificationsRead, subscribeNotifications,
    loadApiUsageToday, deleteMyAccount,
    logFocusSession, loadFocusSessions,
    loadGoals, addGoal, updateGoalProgress, removeGoal, subscribeGoals,
    loadFitnessLogs, logMetric, subscribeFitness,
    loadExerciseLogs, logExercise, removeExerciseLog, subscribeExerciseLogs,
    savePushSubscription, removePushSubscription,
    loadSplits, upsertSplit, subscribeSplits,
    loadSocialPosts, addSocialPost, subscribeSocialPosts,
    loadCustomTopics, addCustomTopic, removeCustomTopic, subscribeCustomTopics,
    loadPortfolio, addHolding, updateHolding, removeHolding, subscribePortfolio,
    loadWatchlist, addWatchlistItem, removeWatchlistItem, subscribeWatchlist,
    loadOtherAssets, addOtherAsset, updateOtherAssetValue, removeOtherAsset, subscribeOtherAssets,
    loadInvestmentPlans, addInvestmentPlan, logPlanContribution, removeInvestmentPlan, subscribeInvestmentPlans,
    updateFiExpenses, loadFiExpenses,
    loadEnvelopes, addEnvelope, removeEnvelope, loadEnvelopeSpending, logEnvelopeExpense, subscribeEnvelopes,
    loadBills, addBill, markBillPaid, removeBill, subscribeBills,
    loadSavingsGoals, addSavingsGoal, contributeSavingsGoal, removeSavingsGoal, subscribeSavingsGoals,
    updateDisplayName,
    loadAlliances, sendAllianceRequest, respondToAlliance, removeAlliance, subscribeAlliances,
    getOrCreateThreadWith, getOrCreateThreadWithUserId, loadMyThreads, removeThread,
    markThreadMessagesRead, loadUnreadMessageCount,
    loadThreadMessages, sendMessage, subscribeThreadMessages
  };
})();
