const AIM_PRESETS = new Set(["full", "assist", "manual"]);

function clamp(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(numeric) ? numeric : fallback));
}

export function resolveInputMode({ coarsePointer = false, mouseInputActive = false, controllerConnected = false } = {}) {
  if (controllerConnected) return "controller";
  if (mouseInputActive || !coarsePointer) return "mouse";
  return "touch";
}

export function normalizeAimSettings({ sensitivity = 1, adsSensitivity = 0.75, assistStrength = 0.65, preset = "assist" } = {}) {
  return {
    sensitivity: clamp(sensitivity, 0.5, 2, 1),
    adsSensitivity: clamp(adsSensitivity, 0.5, 2, 0.75),
    assistStrength: clamp(assistStrength, 0, 1, 0.65),
    preset: AIM_PRESETS.has(preset) ? preset : "assist",
  };
}

export function aimPresetForDifficulty(difficultyRatio) {
  const ratio = Number(difficultyRatio);
  if (Number.isFinite(ratio) && ratio <= 0.1) return "full";
  if (Number.isFinite(ratio) && ratio <= 0.22) return "assist";
  return "manual";
}

export function shouldAutoLock({ coarsePointer, difficultyRatio, manualAim, mouseInputActive = false, controllerInputActive = false, preset }) {
  const activePreset = AIM_PRESETS.has(preset) ? preset : aimPresetForDifficulty(difficultyRatio);
  return coarsePointer && activePreset === "full" && !mouseInputActive && !controllerInputActive && !manualAim;
}

export function shouldDuckMusic({ voiceActive, voiceMuted }) {
  return voiceActive && !voiceMuted;
}
