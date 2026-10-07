const DATABASE = "wasteland-survivor-replays";
const STORE = "clips";
const MAX_CLIPS = 6;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function records(mode = "readonly") {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, mode);
  const store = transaction.objectStore(STORE);
  return { database, store, transaction };
}

export async function saveReplayClip(blob, metadata = {}) {
  if (!(blob instanceof Blob) || !blob.size) return false;
  const { database, store, transaction } = await records("readwrite");
  const existing = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
  store.put({ id: crypto.randomUUID(), blob, createdAt: Date.now(), ...metadata });
  existing.slice(MAX_CLIPS - 1).forEach(clip => store.delete(clip.id));
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return true;
}

export async function recentReplayClips() {
  const { database, store } = await records();
  const clips = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
  database.close();
  return clips;
}

export function captureGameplayClip(canvas, { durationMs = 12000, metadata = {} } = {}) {
  if (!canvas?.captureStream || !globalThis.MediaRecorder || document.hidden) return Promise.resolve(false);
  const stream = canvas.captureStream(30);
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) return Promise.resolve(false);
  return new Promise(resolve => {
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2400000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      try { resolve(await saveReplayClip(new Blob(chunks, { type: mimeType }), metadata)); }
      catch { resolve(false); }
    };
    recorder.start(1000);
    setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, durationMs);
  });
}

let activeUrl = null;
export async function playRandomReplay(video) {
  if (!video) return false;
  try {
    const clips = await recentReplayClips();
    if (!clips.length) return false;
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    const clip = clips[Math.floor(Math.random() * clips.length)];
    activeUrl = URL.createObjectURL(clip.blob);
    video.src = activeUrl;
    video.muted = true;
    video.loop = true;
    await video.play();
    return true;
  } catch { return false; }
}
