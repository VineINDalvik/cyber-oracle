// IMPORTANT: Must be a *.vercel.app origin to avoid proxy loop.
const UPSTREAM = "https://cyber-oracle-nine.vercel.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const upstreamUrl = UPSTREAM + url.pathname + url.search;
    const upstreamHost = new URL(UPSTREAM).host;

    // Avoid accidental proxy loops if misconfigured.
    if (url.host === upstreamHost) {
      return new Response("Bad gateway: proxy loop", { status: 502 });
    }

    // Handle CORS preflight quickly
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const headers = new Headers(request.headers);
    headers.set("Host", upstreamHost);
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("accept-encoding"); // let CF handle compression

    const isStaticAsset =
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/cards/") ||
      url.pathname.startsWith("/images/") ||
      /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map)$/.test(url.pathname);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
      redirect: "follow",
      // Force Cloudflare to NOT edge-cache HTML/API responses (prevents "stuck old version").
      // Keep static assets cacheable via their own headers.
      cf: isStaticAsset
        ? { cacheEverything: true }
        : { cacheEverything: false, cacheTtl: 0 },
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Expose-Headers", "*");
    responseHeaders.delete("content-security-policy");
    responseHeaders.delete("x-frame-options");

    // Critical: prevent caching HTML/API at the edge/browser.
    if (!isStaticAsset) {
      responseHeaders.set("Cache-Control", "no-store");
      responseHeaders.set("CDN-Cache-Control", "no-store");
      responseHeaders.set("Pragma", "no-cache");
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

