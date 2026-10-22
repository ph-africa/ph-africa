/*
 * Cloudflare Worker for the Bakulu videos-and-live-only project.
 *
 * In Cloudflare, enable Workers Static Assets and bind the assets directory
 * as ASSETS. This Worker exposes:
 *   GET /api/livecams
 *   GET /api/videos?page=1&per_page=30
 *
 * No payment endpoints, secrets, or payment integrations are included.
 */
const LIVE_FEED_URL = "https://api.a00s.net/v3/cache/affiliates/camsfeed/json";
const EPORNER_API_URL = "https://www.eporner.com/api/v2/video/search/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/livecams") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      return proxyJson(LIVE_FEED_URL, {
        headers: { "Accept": "application/json" }
      });
    }

    if (url.pathname === "/api/videos") {
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
      const page = clampInteger(url.searchParams.get("page"), 1, 1, 10000);
      const perPage = clampInteger(url.searchParams.get("per_page"), 30, 1, 50);
      const apiUrl = new URL(EPORNER_API_URL);
      apiUrl.searchParams.set("query", "all");
      apiUrl.searchParams.set("per_page", String(perPage));
      apiUrl.searchParams.set("page", String(page));
      apiUrl.searchParams.set("thumbsize", "big");
      apiUrl.searchParams.set("order", "latest");
      apiUrl.searchParams.set("format", "json");

      return proxyJson(apiUrl.toString(), {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; BakuluVideoSite/1.0)"
        }
      });
    }

    if (env && env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return new Response("Bakulu Worker is running. Configure the ASSETS binding to serve the website.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value || "", 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}


async function proxyJson(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      redirect: "follow",
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    const contentType =
      response.headers.get("content-type") || "";

    const bodyText = await response.text();

    let data;

    try {
      data = JSON.parse(bodyText);
    } catch {
      data = null;
    }

    if (!response.ok) {
      return json({
        error: "Upstream provider returned an error",
        upstream_status: response.status,
        upstream_content_type: contentType,
        upstream_final_url: response.url
      }, 502);
    }

    if (data === null) {
      return json({
        error: "Provider returned HTML or invalid JSON",
        upstream_status: response.status,
        upstream_content_type: contentType,
        upstream_final_url: response.url,
        response_preview: bodyText.slice(0, 250),
        hint: "The provider may require approved API access or a supported endpoint."
      }, 502);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return json({
      error: "Could not contact upstream provider",
      message: error instanceof Error
        ? error.message
        : "Unknown network error"
    }, 502);
  }
}


    // Some providers return an HTML challenge page instead of JSON.
    if (!contentType.toLowerCase().includes("json")) {
      try {
        JSON.parse(bodyText);
      } catch {
        return json({
          error: "Upstream provider did not return JSON",
          upstream_content_type: contentType
        }, 502);
      }
    }

    return new Response(bodyText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return json({
      error: "Could not contact upstream provider",
      message: error instanceof Error ? error.message : "Unknown network error"
    }, 502);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
