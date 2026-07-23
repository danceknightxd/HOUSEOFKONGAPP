/* ============================================================
   THE THRONE — FEED ENGINE
   Handles: Blogger JSONP feeds + external RSS via rss2json.
   No dependencies. Vanilla JS.
   ============================================================ */

const ThroneFeeds = (() => {

  let jsonpCounter = 0;
  const newsStore = []; // { topic, title, link, source, date, summary }

  // ---------- utilities ----------
  function timeAgo(dateStr) {
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return "";
    const diffMin = Math.max(1, Math.round((Date.now() - then) / 60000));
    if (diffMin < 60) return diffMin + " MIN AGO";
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return diffHr + " HR" + (diffHr > 1 ? "S" : "") + " AGO";
    const diffDay = Math.round(diffHr / 24);
    return diffDay + " DAY" + (diffDay > 1 ? "S" : "") + " AGO";
  }

  function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").trim();
  }

  function hostFromUrl(url) {
    try { return new URL(url).hostname.replace("www.", "").toUpperCase(); }
    catch (e) { return "SOURCE"; }
  }

  // ---------- Blogger JSONP ----------
  function fetchBloggerFeed(feedConfig, onDone) {
    const cbName = "throneJsonpCb_" + (jsonpCounter++);
    const timeout = setTimeout(() => {
      cleanup();
      onDone({ ok: false, error: "timeout", feed: feedConfig });
    }, 8000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      const s = document.getElementById(cbName);
      if (s) s.remove();
    }

    window[cbName] = (data) => {
      cleanup();
      try {
        const entries = (data.feed.entry || []).map(entry => {
          const linkObj = (entry.link || []).find(l => l.rel === "alternate") || {};
          // Blogger gives a small media$thumbnail when the post has an
          // image; if not, try pulling the first <img> out of the post
          // content itself as a fallback.
          let thumbnail = entry.media$thumbnail ? entry.media$thumbnail.url : null;
          if (thumbnail) thumbnail = thumbnail.replace(/\/s72-c\//, "/s400/"); // upsize Blogger's tiny default crop
          if (!thumbnail && entry.content && entry.content.$t) {
            const match = entry.content.$t.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (match) thumbnail = match[1];
          }
          return {
            topic: feedConfig.label || feedConfig.name,
            title: stripHtml(entry.title ? entry.title.$t : "Untitled"),
            link: linkObj.href || "#",
            source: feedConfig.name,
            date: entry.published ? entry.published.$t : new Date().toISOString(),
            summary: stripHtml(entry.summary ? entry.summary.$t : ""),
            thumbnail,
            kind: "blogger"
          };
        });
        onDone({ ok: true, entries, feed: feedConfig });
      } catch (e) {
        onDone({ ok: false, error: "parse", feed: feedConfig });
      }
    };

    const sep = feedConfig.url.includes("?") ? "&" : "?";
    const script = document.createElement("script");
    script.id = cbName;
    script.src = feedConfig.url + sep + "callback=" + cbName;
    script.onerror = () => { cleanup(); onDone({ ok: false, error: "network", feed: feedConfig }); };
    document.body.appendChild(script);
  }

  // ---------- External RSS via the data-proxy (was: direct rss2json call) ----------
  async function fetchRssTopic(topicConfig) {
    try {
      const res = await ThroneProxy.call("news_rss", { rssUrl: topicConfig.rss, count: THRONE_CONFIG.itemsPerTopic });
      const items = res.data || [];
      const entries = items.slice(0, THRONE_CONFIG.itemsPerTopic).map(item => {
        // rss2json auto-extracts a thumbnail for most sources, but not
        // all (some feeds just don't tag images the way it expects) —
        // fall back to pulling the first <img> out of the article's
        // own content/description HTML, same trick used for Blogger.
        let thumbnail = item.thumbnail || item.enclosure?.link || null;
        if (!thumbnail && item.content) {
          const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (match) thumbnail = match[1];
        }
        if (!thumbnail && item.description) {
          const match = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (match) thumbnail = match[1];
        }
        return {
          topic: topicConfig.name,
          title: stripHtml(item.title),
          link: item.link,
          source: hostFromUrl(item.link),
          date: item.pubDate,
          summary: stripHtml(item.description).slice(0, 160),
          thumbnail,
          kind: "rss"
        };
      });
      return { ok: true, entries, topic: topicConfig };
    } catch (e) {
      return { ok: false, error: e.message, topic: topicConfig };
    }
  }

  // ---------- rendering ----------
  function newsItemHtml(item) {
    const thumbInner = item.thumbnail
      ? `<img src="${item.thumbnail}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<svg viewBox=&quot;0 0 24 24&quot;><path d=&quot;M4 4h16v16H4z&quot;/><path d=&quot;M4 9h16&quot;/></svg>';">`
      : `<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M4 9h16"/></svg>`;
    return `
      <a class="news-item" href="${item.link}" target="_blank" rel="noopener" data-topic="${item.topic}">
        <div class="news-thumb">${thumbInner}</div>
        <div class="news-body">
          <div class="topic">${item.topic}</div>
          <h4>${item.title}</h4>
          <div class="meta">${item.source.toUpperCase()} · ${timeAgo(item.date)}</div>
        </div>
      </a>`;
  }

  function renderNewsList(containerEl, items, emptyMsg) {
    if (!items.length) {
      containerEl.innerHTML = `<div class="feed-empty">${emptyMsg || "No items yet."}</div>`;
      return;
    }
    containerEl.innerHTML = items.map(newsItemHtml).join("");
  }

  function renderSkeleton(containerEl, rows = 3) {
    containerEl.innerHTML = Array.from({ length: rows }).map(() => `
      <div class="news-item skeleton">
        <div class="news-thumb skel-block"></div>
        <div class="news-body">
          <div class="skel-line" style="width:40%"></div>
          <div class="skel-line" style="width:85%; height:18px; margin-top:8px;"></div>
          <div class="skel-line" style="width:30%; margin-top:8px;"></div>
        </div>
      </div>`).join("");
  }

  // ---------- public: load everything ----------
  async function loadAll({ onTopicsUpdated, onBloggerUpdated } = {}) {
    // RSS topics — fire in parallel
    const enabledTopics = THRONE_CONFIG.topics.filter(t => t.enabled);
    const rssPromises = enabledTopics.map(fetchRssTopic);
    const rssResults = await Promise.all(rssPromises);

    rssResults.forEach(r => {
      if (r.ok) newsStore.push(...r.entries);
    });
    newsStore.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (onTopicsUpdated) onTopicsUpdated(rssResults, newsStore);

    // Blogger JSONP — fire independently, callback style
    THRONE_CONFIG.bloggerFeeds.forEach(fc => {
      fetchBloggerFeed(fc, (result) => {
        if (result.ok) newsStore.push(...result.entries);
        newsStore.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (onBloggerUpdated) onBloggerUpdated(result, newsStore);
      });
    });
  }

  function addToStore(entries) {
    newsStore.push(...entries);
    newsStore.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return {
    loadAll,
    getStore: () => newsStore,
    renderNewsList,
    renderSkeleton,
    timeAgo,
    fetchRssTopic,
    fetchBloggerFeed,
    addToStore
  };
})();
