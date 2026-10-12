function normalizeBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const base = raw.replace(/\/+$/, "");
  const isBucketName = candidate => /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(candidate);

  if (base.startsWith("gs://")) {
    try {
      const url = new URL(base);
      if (!isBucketName(url.hostname) || url.username || url.password || url.port || url.search || url.hash) return "";
      return `https://storage.googleapis.com/${url.hostname}${url.pathname}`.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  if (isBucketName(base)) return `https://storage.googleapis.com/${base}`;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:") return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, HEAD");
    response.end();
    return;
  }
  const requestedVersion = String(process.env.GAME_MEDIA_VERSION || "nightfall-v2").trim() || "nightfall-v2";
  const version = requestedVersion.toLowerCase() === "nightfall-v1" ? "nightfall-v2" : requestedVersion;
  const configuredBaseUrl = normalizeBase(
    process.env.GAME_MEDIA_BASE_URL ||
      process.env.PUBLIC_MEDIA_BASE_URL ||
      process.env.GOOGLE_CLOUD_STORAGE_BASE_URL ||
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
      process.env.GENMEDIA_BUCKET,
  );
  const baseUrl = configuredBaseUrl.replace(/\/nightfall-v\d+$/i, `/${version}`);
  response.statusCode = 200;
  response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ baseUrl, version, external: Boolean(baseUrl), fallback: "/assets" }));
}

module.exports = handler;
