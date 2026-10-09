import { resolvePointerInputHandoff } from "./input-recovery.mjs";

const POINTER_CAPTURE_LOST = "pointer-capture-lost";

function pointerIdOf(event) {
  return Number.isFinite(event?.pointerId) ? event.pointerId : null;
}

function hasPointerCapture(target, event) {
  const pointerId = pointerIdOf(event);
  if (pointerId === null || typeof target?.hasPointerCapture !== "function") return false;
  try {
    return target.hasPointerCapture(pointerId);
  } catch {
    return false;
  }
}

function defer(callback) {
  if (typeof queueMicrotask === "function") queueMicrotask(callback);
  else Promise.resolve().then(callback);
}

export function applyCanvasPointerHandoff(event, {
  inputMode,
  pointerResumeRequired = false,
  setInputMode,
} = {}) {
  const handoff = resolvePointerInputHandoff({
    pointerType: event?.pointerType,
    inputMode,
    pointerResumeRequired,
  });
  if (handoff.inputMode) setInputMode?.(handoff.inputMode);
  return handoff;
}

export function bindTransientPointerInterrupts({ targets = [], interrupt } = {}) {
  if (typeof interrupt !== "function") return () => {};
  const unbind = [];

  for (const target of new Set(targets.filter(Boolean))) {
    if (typeof target.addEventListener !== "function") continue;
    const activePointers = new Set();
    const expectedCaptureLosses = new Set();

    const expectCaptureLoss = pointerId => {
      if (pointerId === null) return;
      expectedCaptureLosses.add(pointerId);
      defer(() => expectedCaptureLosses.delete(pointerId));
    };
    const onPointerDown = event => {
      const pointerId = pointerIdOf(event);
      if (pointerId === null) return;
      activePointers.add(pointerId);
      expectedCaptureLosses.delete(pointerId);
    };
    const onPointerUp = event => {
      const pointerId = pointerIdOf(event);
      if (pointerId === null || !activePointers.delete(pointerId)) return;
      expectCaptureLoss(pointerId);
    };
    const onPointerCancel = event => {
      const pointerId = pointerIdOf(event);
      activePointers.delete(pointerId);
      expectCaptureLoss(pointerId);
      interrupt(POINTER_CAPTURE_LOST, event, target);
    };
    const onPointerLeave = event => {
      if (hasPointerCapture(target, event)) return;
      const pointerId = pointerIdOf(event);
      activePointers.delete(pointerId);
      expectCaptureLoss(pointerId);
      interrupt(POINTER_CAPTURE_LOST, event, target);
    };
    const onLostPointerCapture = event => {
      const pointerId = pointerIdOf(event);
      activePointers.delete(pointerId);
      if (pointerId !== null && expectedCaptureLosses.delete(pointerId)) return;
      interrupt(POINTER_CAPTURE_LOST, event, target);
    };

    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointercancel", onPointerCancel);
    target.addEventListener("pointerleave", onPointerLeave);
    target.addEventListener("lostpointercapture", onLostPointerCapture);
    unbind.push(() => {
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("pointercancel", onPointerCancel);
      target.removeEventListener("pointerleave", onPointerLeave);
      target.removeEventListener("lostpointercapture", onLostPointerCapture);
    });
  }

  return () => unbind.forEach(removeListeners => removeListeners());
}
