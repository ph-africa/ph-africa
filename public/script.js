/* Bakulu: videos and live streams only.
   API calls are made to this site's Cloudflare Worker. */
"use strict";

const API = {
  videos: "https://www.eporner.com/api/v2/video/search/",
  live: "/api/livecams"
};

const state = {
  videoPage: 1,
  perPage: 30,
  loadingVideos: false,
  finishedVideos: false,
  videos: [],
  live: [],
  search: ""
};

const $ = (id) => document.getElementById(id);

function safeText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function firstString(...values) {
  return values.find(value => typeof value === "string" && value.trim()) || "";
}

function escapeHtml(value) {
  return safeText(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function formatViewers(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? `${number.toLocaleString()} watching` : "";
}

function setStatus(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function normaliseVideo(item) {
  const id = safeText(item.id || item.video_id || item.videoId).trim();
  const title = firstString(item.title, item.name, item.keyword) || "Untitled video";
  const image = safeHttpUrl(firstString(
    item.image, item.default_thumb && item.default_thumb.src, item.thumb,
    item.thumbnail, item.thumb_url, item.thumbnail_url, item.poster
  ));
  const duration = firstString(item.length_min, item.duration, item.length);
  const embed = safeHttpUrl(firstString(item.embed_url, item.embed, item.player_url));
  const page = safeHttpUrl(firstString(item.url, item.video_url, item.page_url));
  return { id, title, image, duration, embed, page };
}

function normaliseCam(item) {
  const username = firstString(item.username, item.model, item.name, item.nickname) || "Live stream";
  const image = safeHttpUrl(firstString(item.image_url, item.image, item.thumbnail, item.thumb, item.photo));
  const viewers = item.viewers ?? item.viewer_count ?? item.num_viewers ?? "";
  // Only use a provider-supplied player/embed URL. Do not guess a live-player URL.
  const embed = safeHttpUrl(firstString(item.embed_url, item.embed, item.player_url, item.iframe_url));
  const page = safeHttpUrl(firstString(item.url, item.link, item.profile_url, item.room_url, item.chat_url));
  return { username, image, viewers, embed, page };
}

function createCardImage(imageUrl, altText, placeholderText = "Preview unavailable") {
  if (!imageUrl) return `<div class="thumb-placeholder">${escapeHtml(placeholderText)}</div>`;
  return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-placeholder',textContent:'Preview unavailable'}))">`;
}

function openPlayer({ title, embed, page, kind }) {
  const modal = $("playerModal");
  const frame = $("playerFrame");
  const providerLink = $("openProvider");
  if (!modal || !frame) return;

  $("playerTitle").textContent = title || "Now playing";
  providerLink.hidden = true;
  providerLink.removeAttribute("href");

  if (embed) {
    frame.src = embed;
    $("playerHelp").textContent = "If playback is blocked, the provider may not allow embedded playback.";
    if (page) {
      providerLink.href = page;
      providerLink.hidden = false;
    }
  } else {
    frame.src = "about:blank";
    $("playerHelp").textContent = page
      ? "This feed did not provide an embeddable player URL. Use the provider link to watch there."
      : (kind === "live"
          ? "This live feed did not provide an embeddable player or a stream page, so playback cannot be opened yet."
          : "This video did not provide an embed URL. Try opening it on the provider if a page link is available.");
    if (page) {
      providerLink.href = page;
      providerLink.hidden = false;
    }
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $("closePlayer").focus();
}

function closePlayer() {
  $("playerFrame").src = "about:blank";
  $("playerModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function videoCard(video) {
  const card = document.createElement("article");
  card.className = "media-card";
  const duration = video.duration ? `<p class="card-subtitle">${escapeHtml(video.duration)}</p>` : "";
  card.innerHTML = `
    <button class="thumb-button" type="button" aria-label="Play ${escapeHtml(video.title)}">
      ${createCardImage(video.image, video.title)}
      <span class="play-icon" aria-hidden="true">▶</span>
    </button>
    <div class="card-info">
      <h3 class="card-title">${escapeHtml(video.title)}</h3>
      ${duration}
      <button class="card-action" type="button">Watch video</button>
    </div>`;
  const play = () => openPlayer({
    title: video.title,
    embed: video.embed || (video.id ? `https://www.eporner.com/embed/${encodeURIComponent(video.id)}` : ""),
    page: video.page || (video.id ? `https://www.eporner.com/video-${encodeURIComponent(video.id)}/` : ""),
    kind: "video"
  });
  card.querySelector(".thumb-button").addEventListener("click", play);
  card.querySelector(".card-action").addEventListener("click", play);
  card.dataset.searchText = `${video.title} ${video.duration}`.toLowerCase();
  return card;
}

function liveCard(cam) {
  const card = document.createElement("article");
  card.className = "media-card";
  const viewers = formatViewers(cam.viewers);
  card.innerHTML = `
    <button class="thumb-button" type="button" aria-label="Watch ${escapeHtml(cam.username)} live">
      ${createCardImage(cam.image, cam.username, "Live stream")}
      <span class="live-pill">LIVE</span>
      ${viewers ? `<span class="viewers-pill">${escapeHtml(viewers)}</span>` : ""}
      <span class="play-icon" aria-hidden="true">▶</span>
    </button>
    <div class="card-info">
      <h3 class="card-title">${escapeHtml(cam.username)}</h3>
      <p class="card-subtitle">${viewers ? escapeHtml(viewers) : "Live now"}</p>
      <button class="card-action" type="button">Watch live</button>
    </div>`;
  const play = () => openPlayer({
    title: `${cam.username} — Live`,
    embed: cam.embed,
    page: cam.page,
    kind: "live"
  });
  card.querySelector(".thumb-button").addEventListener("click", play);
  card.querySelector(".card-action").addEventListener("click", play);
  card.dataset.searchText = `${cam.username} live ${cam.viewers}`.toLowerCase();
  return card;
}

function applySearch() {
  state.search = $("siteSearch").value.trim().toLowerCase();
  $("clearSearch").hidden = !state.search;
  document.querySelectorAll(".media-card").forEach(card => {
    card.hidden = Boolean(state.search) && !card.dataset.searchText.includes(state.search);
  });
  if (state.search) {
    const visible = document.querySelectorAll(".media-card:not([hidden])").length;
    setStatus("videoStatus", visible ? `${visible} matching item${visible === 1 ? "" : "s"}.` : "No matching videos or live streams.");
  } else {
    setStatus("videoStatus", state.videos.length ? `${state.videos.length} videos loaded.` : "");
  }
}

async function loadLiveCams() {
  const container = $("liveContainer");
  const button = $("refreshLive");
  button.disabled = true;
  setStatus("liveStatus", "Loading live streams…");
  try {
    const response = await fetch(API.live, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`Live API returned ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data) ? data
  : Array.isArray(data.body) ? data.body
  : Array.isArray(data.cams) ? data.cams
  : Array.isArray(data.models) ? data.models
  : Array.isArray(data.results) ? data.results
  : Array.isArray(data.data) ? data.data
  : Array.isArray(data.camsfeed) ? data.camsfeed : [];
    state.live = items.map(normaliseCam).filter(cam => cam.username);
    container.replaceChildren();
    state.live.slice(0, 40).forEach(cam => container.appendChild(liveCard(cam)));
    setStatus("liveStatus", state.live.length ? `${state.live.length} live listings found.` : "No live listings were returned by the feed.");
    applySearch();
  } catch (error) {
    console.error("Unable to load live streams:", error);
    setStatus("liveStatus", "Live streams could not be loaded. Check the Worker route and provider response.");
  } finally {
    button.disabled = false;
  }
}

async function loadVideos() {
  if (state.loadingVideos || state.finishedVideos) return;
  state.loadingVideos = true;
  const button = $("loadMoreVideos");
  button.disabled = true;
  button.textContent = "Loading videos…";
  setStatus("videoStatus", "Loading videos…");
  try {
    const url = new URL(API.videos);
url.searchParams.set("query", "all");
url.searchParams.set("page", String(state.videoPage));
url.searchParams.set("per_page", String(state.perPage));
url.searchParams.set("format", "json");
    const response = await fetch(url.toString(), {
  headers: { "Accept": "application/json" }
});
    if (!response.ok) throw new Error(`Video API returned ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data.videos) ? data.videos
      : Array.isArray(data.results) ? data.results
      : Array.isArray(data.data) ? data.data : [];
    const videos = items.map(normaliseVideo).filter(video => video.id || video.embed || video.page);

    if (videos.length === 0) {
      state.finishedVideos = true;
      setStatus("videoStatus", state.videos.length ? "No more videos." : "No videos were returned by the API.");
      button.textContent = "No more videos";
      button.disabled = true;
      return;
    }

    const container = $("videoContainer");
    videos.forEach(video => {
      state.videos.push(video);
      container.appendChild(videoCard(video));
    });
    state.videoPage += 1;
    const hasMore = data.total_pages ? state.videoPage <= Number(data.total_pages)
      : videos.length >= state.perPage;
    if (!hasMore) {
      state.finishedVideos = true;
      button.textContent = "No more videos";
    } else {
      button.textContent = "Load more videos ›";
    }
    setStatus("videoStatus", `${state.videos.length} videos loaded.`);
    applySearch();
  } catch (error) {
    console.error("Unable to load videos:", error);
    setStatus("videoStatus", "Videos could not be loaded. Check the Worker route and provider response.");
    button.textContent = "Try again ›";
  } finally {
    state.loadingVideos = false;
    button.disabled = state.finishedVideos;
  }
}

$("siteSearch").addEventListener("input", applySearch);
$("clearSearch").addEventListener("click", () => {
  $("siteSearch").value = "";
  applySearch();
  $("siteSearch").focus();
});
$("loadMoreVideos").addEventListener("click", loadVideos);
$("refreshLive").addEventListener("click", loadLiveCams);
$("closePlayer").addEventListener("click", closePlayer);
$("playerModal").addEventListener("click", event => {
  if (event.target === $("playerModal")) closePlayer();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("playerModal").classList.contains("hidden")) closePlayer();
});

loadLiveCams();
loadVideos();
setInterval(loadLiveCams, 60000);
