const FALLBACK_PREFIX = "/assets";

function cleanBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    if (url.protocol !== "https:" && url.origin !== window.location.origin) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function externalPath(path, baseUrl) {
  if (!baseUrl || !path) return path;
  const raw = String(path);
  const suffix = raw.replace(/^(?:\.\/|\/)+/, "");
  if (!suffix.startsWith("assets/")) return raw;
  return `${baseUrl}/${encodeURI(suffix)}`;
}

function mediaOwner(element) {
  if (!element) return null;
  if (element.tagName === "VIDEO" || element.tagName === "AUDIO") return element;
  return element.closest?.("video, audio") || null;
}

function restoreBundledMedia(media) {
  const targets = [media, ...(media.querySelectorAll?.("[data-media-src], [data-media-poster]") || [])];
  for (const target of targets) {
    if (target.dataset?.mediaSrc) target.setAttribute("src", target.dataset.mediaSrc);
    if (target.dataset?.mediaPoster) target.setAttribute("poster", target.dataset.mediaPoster);
  }
  media.load?.();
  window.dispatchEvent(new CustomEvent("wasteland-media-ready", { detail: { baseUrl: "", external: false, fallback: true } }));
}

function bindBundledFallback(element, baseUrl) {
  if (!baseUrl) return;
  const media = mediaOwner(element);
  if (!media || media.__wastelandMediaFallbackBound) return;
  media.__wastelandMediaFallbackBound = true;
  media.addEventListener("error", () => restoreBundledMedia(media), { once: true });
}

export function applyMediaBase(baseUrl) {
  for (const element of document.querySelectorAll("[data-media-src], [data-media-poster]")) {
    const source = element.dataset.mediaSrc;
    const poster = element.dataset.mediaPoster;
    const media = mediaOwner(element);
    bindBundledFallback(element, baseUrl);
    if (source) element.setAttribute("src", externalPath(source, baseUrl));
    if (poster) element.setAttribute("poster", externalPath(poster, baseUrl));
    media?.load?.();
  }
  window.dispatchEvent(new CustomEvent("wasteland-media-ready", { detail: { baseUrl, external: Boolean(baseUrl) } }));
}

async function loadMediaConfig() {
  try {
    const response = await fetch("/api/media-config", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error(`media config ${response.status}`);
    const config = await response.json();
    const baseUrl = cleanBase(config.baseUrl);
    window.__WASTELAND_MEDIA__ = Object.freeze({
      baseUrl,
      version: config.version || "nightfall-v2",
      external: Boolean(baseUrl),
      fallback: FALLBACK_PREFIX,
      url: path => externalPath(path, baseUrl),
    });
    applyMediaBase(baseUrl);
  } catch {
    window.__WASTELAND_MEDIA__ = Object.freeze({
      baseUrl: "",
      version: "nightfall-v2",
      external: false,
      fallback: FALLBACK_PREFIX,
      url: path => path,
    });
    applyMediaBase("");
  }
}

window.__WASTELAND_MEDIA__ = Object.freeze({ baseUrl: "", version: "nightfall-v2", external: false, fallback: FALLBACK_PREFIX, url: path => path });
export const mediaReady = loadMediaConfig();
