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
  const fullTitle = firstString(
  item.title,
  item.name,
  item.keyword
) || "Untitled video";

const title = fullTitle.length > 25
  ? fullTitle.slice(0, 22).trimEnd() + "..."
  : fullTitle;
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
  const username = firstString(
    item.username,
    item.model,
    item.name,
    item.nickname
  ) || "Live stream";

  const image = safeHttpUrl(firstString(
    item.image,
    item.image_url,
    item.imageCapture,
    item.thumbnail,
    item.thumb,
    item.photo
  ));

  const viewers = item.viewers ?? item.viewer_count ?? item.num_viewers ?? "";

  // The feed provides a profile URL, not a confirmed player URL.
  const embed = safeHttpUrl(firstString(
    item.embed_url,
    item.player_url,
    item.iframe_url,
    item.embed
  ));

  const page = safeHttpUrl(firstString(
    item.url,
    item.profile_url,
    item.room_url,
    item.chat_url,
    item.link
  ));

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

  if (!modal || !frame || !providerLink) return;

  $("playerTitle").textContent = title || "Now playing";
  providerLink.hidden = true;
  providerLink.removeAttribute("href");

  // Use the official Amateur.tv affiliate room for live streams.
  if (kind === "live") {
    frame.src =
      "https://l.amateur.tv/streamroom?base_domain=" +
      encodeURIComponent("https://www.amateur.tv/") +
      "&a=b05a029d-18d1-461b-a229-40f9bf7f44c3&noHud=1";

    $("playerHelp").textContent =
      "Live room provided by Amateur.tv.";

    if (page) {
      providerLink.href = page;
      providerLink.textContent = "Open this profile on Amateur.tv ↗";
      providerLink.hidden = false;
    }
  } else if (embed) {
    frame.src = embed;
    $("playerHelp").textContent =
      "If playback is blocked, the provider may not allow embedded playback.";

    if (page) {
      providerLink.href = page;
      providerLink.textContent = "Open on provider ↗";
      providerLink.hidden = false;
    }
  } else {
    frame.src = "about:blank";
    $("playerHelp").textContent =
      "An embedded player is not available for this video.";

    if (page) {
      providerLink.href = page;
      providerLink.textContent = "Open on provider ↗";
      providerLink.hidden = false;
    }
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $("closePlayer").focus();
}



function closePlayer() {
  const frame = $("playerFrame");
  const modal = $("playerModal");

  if (frame) frame.src = "about:blank";
  if (modal) modal.classList.add("hidden");

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


function showPage(page) {
  document.querySelectorAll(".page-section").forEach(section => {
    section.classList.toggle("hidden", section.id !== page);
  });

  document.querySelectorAll("[data-page]").forEach(link => {
    const active = link.dataset.page === page;

    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  // Start the selected page at the top.
  window.scrollTo({ top: 0, behavior: "auto" });
}

document.querySelectorAll("[data-page]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    showPage(link.dataset.page);
  });
});


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
  : Array.isArray(data.camsfeed) ? data.camsfeed
  : [];
    state.live = items.map(normaliseCam).filter(cam => cam.username);
    const liveNavImage = $("liveNavImage");
const liveNavFallback = $("liveNavFallback");

const firstLiveImage = state.live.find(cam => cam.image)?.image || "";

if (liveNavImage && firstLiveImage) {
  liveNavImage.src = firstLiveImage;
  liveNavImage.hidden = false;

  if (liveNavFallback) {
    liveNavFallback.hidden = true;
  }
}
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


const TOTAL_VIDEO_PAGES = 125;

function renderVideoPagination() {
  const pagination = $("videoPagination");
  if (!pagination) return;

  pagination.replaceChildren();

  const current = state.videoPage;
  const total = TOTAL_VIDEO_PAGES;

  function addPage(page, label = String(page)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "video-page-button";
    button.textContent = label;

    if (page === current) {
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    button.disabled = state.loadingVideos || page === current;

    button.addEventListener("click", () => {
      loadVideos(page);
    });

    pagination.appendChild(button);
  }

  function addDots() {
    const dots = document.createElement("span");
    dots.className = "video-page-dots";
    dots.textContent = "…";
    pagination.appendChild(dots);
  }

  // Previous page
  if (current > 1) {
    addPage(current - 1, "‹");
  }

  // Always show page 1
  addPage(1);

  let start = Math.max(2, current - 2);
  let end = Math.min(total - 1, current + 2);

  if (current <= 4) end = Math.min(5, total - 1);
  if (current >= total - 3) start = Math.max(2, total - 4);

  if (start > 2) addDots();

  for (let page = start; page <= end; page++) {
    addPage(page);
  }

  if (end < total - 1) addDots();

  // Always show the last page
  if (total > 1) addPage(total);

  // Next page
  if (current < total) {
    addPage(current + 1, "›");
  }
}

async function loadVideos(page = 1) {
  if (state.loadingVideos) return;

  state.loadingVideos = true;
  state.videoPage = page;

  const container = $("videoContainer");
  const pagination = $("videoPagination");

  setStatus("videoStatus", `Loading videos from page ${page}…`);

  if (pagination) renderVideoPagination();

  try {
    const selectedCategory = document.querySelector(
  ".category-button.active"
);

const order = selectedCategory?.dataset.order || "latest";

const url =
  `${API.videos}?page=${page}` +
  `&per_page=${state.perPage}` +
  `&order=${encodeURIComponent(order)}`;

    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Video API returned ${response.status}`);
    }

    const data = await response.json();

    const items = Array.isArray(data.videos) ? data.videos
      : Array.isArray(data.results) ? data.results
      : Array.isArray(data.data) ? data.data
      : [];

    const videos = items
      .map(normaliseVideo)
      .filter(video => video.id || video.embed || video.page);

    // Replace the previous page instead of adding cards underneath it.
    container.replaceChildren();
    state.videos = videos;

    videos.forEach(video => {
      container.appendChild(videoCard(video));
    });

    if (videos.length === 0) {
      setStatus("videoStatus", `No videos found on page ${page}.`);
    } else {
      setStatus(
        "videoStatus",
        `Page ${page} — ${videos.length} videos`
      );
    }

    applySearch();
  } catch (error) {
    console.error("Unable to load videos:", error);
    setStatus(
      "videoStatus",
      "Videos could not be loaded. Please try another page."
    );
  } finally {
    state.loadingVideos = false;
    renderVideoPagination();
  }
}


$("siteSearch").addEventListener("input", applySearch);
$("clearSearch").addEventListener("click", () => {
  $("siteSearch").value = "";
  applySearch();
  $("siteSearch").focus();
});
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

// Side menu behaviour
(() => {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("menuOverlay");
  const openButton = document.getElementById("menuToggle");
  const closeButton = document.getElementById("menuClose");
  const joinButton = document.getElementById("joinToggle");
  const countryList = document.getElementById("countryList");

  if (!menu || !overlay || !openButton || !closeButton) return;

  function openMenu() {
    menu.classList.add("open");
    overlay.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
    openButton.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    menu.classList.remove("open");
    overlay.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    openButton.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  openButton.addEventListener("click", openMenu);
  closeButton.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  joinButton?.addEventListener("click", () => {
    const expanded = joinButton.getAttribute("aria-expanded") === "true";
    joinButton.setAttribute("aria-expanded", String(!expanded));
    countryList.hidden = expanded;
  });
})();
// Menu destination links — replace with your real URLs
const menuLinks = {
  contact: "https://example.com/contact",
  channels: "https://example.com/channels",
  countries: {
    zambia: "https://example.com/zambia",
    malawi: "https://example.com/malawi",
    kenya: "https://example.com/kenya",
    "south-africa": "https://example.com/south-africa"
  }
};

document.getElementById("contactLink").href = menuLinks.contact;
document.getElementById("channelsLink").href = menuLinks.channels;

document.querySelectorAll(".country-link").forEach(link => {
  const country = link.dataset.country;
  link.href = menuLinks.countries[country];
});
// Video sorting buttons
document.querySelectorAll(".category-button").forEach(button => {
  button.addEventListener("click", () => {
    if (button.classList.contains("active")) return;

    document.querySelectorAll(".category-button").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    loadVideos(1);
  });
});