const FALLBACKS = Object.freeze({
  playerName: "UNKNOWN OPERATOR",
  mission: "MISSION UNAVAILABLE",
  objective: "NO ACTIVE OBJECTIVE",
  ability: "ABILITY",
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function wholeNumber(value, fallback = 0) {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

function clampPercent(value, max) {
  const safeMax = Math.max(0, finiteNumber(max));
  if (!safeMax) return 0;
  return Math.round(Math.min(100, Math.max(0, finiteNumber(value) / safeMax * 100)));
}

function labelOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function formatTimer(value) {
  if (typeof value === "string" && value.trim()) return value;
  const seconds = wholeNumber(value);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function teamLabel(mode) {
  if (mode === "ctf") return "BLUE TEAM CTF";
  if (mode === "teams") return "BLUE TEAM";
  return "SOLO OPERATION";
}

export function createHudViewModel(state = {}) {
  const health = wholeNumber(state.health);
  const maxHealth = Math.max(1, wholeNumber(state.maxHealth, 100));
  const armor = wholeNumber(state.armor);
  const maxArmor = wholeNumber(state.maxArmor);
  const ammoCurrent = wholeNumber(state.ammo?.current);
  const ammoReserve = wholeNumber(state.ammo?.reserve);
  const abilityLabel = labelOr(state.ability?.label, FALLBACKS.ability).toUpperCase();
  const abilityNow = wholeNumber(state.ability?.now);
  const abilityReadyAt = wholeNumber(state.ability?.readyAt);
  const cooldownMs = Math.max(1, wholeNumber(state.ability?.cooldownMs, 1));
  const abilityRemainingMs = Math.max(0, abilityReadyAt - abilityNow);
  const abilityState = abilityRemainingMs > 0 ? "cooldown" : "ready";
  const abilityPercentage = abilityState === "cooldown" ? Math.min(100, Math.round(abilityRemainingMs / cooldownMs * 100)) : 0;
  const teamHealth = wholeNumber(state.teamHealth, health);
  const teamHealthMax = Math.max(1, wholeNumber(state.teamHealthMax, maxHealth));
  const mode = ["solo", "teams", "ctf"].includes(state.mode) ? state.mode : "solo";
  const blue = wholeNumber(state.score?.blue);
  const red = wholeNumber(state.score?.red);

  return {
    health: {
      value: Math.min(maxHealth, health),
      percentage: clampPercent(health, maxHealth),
      label: `${Math.min(maxHealth, health)} HP`,
    },
    armor: {
      value: Math.min(maxArmor, armor),
      percentage: clampPercent(armor, maxArmor),
      label: `${Math.min(maxArmor, armor)} ARMOR`,
    },
    ammo: { current: ammoCurrent, reserve: ammoReserve, label: `${ammoCurrent} / ${ammoReserve}` },
    ability: {
      label: abilityLabel,
      state: abilityState,
      remainingMs: abilityRemainingMs,
      percentage: abilityPercentage,
      statusLabel: abilityState === "cooldown" ? `COOLDOWN ${Math.ceil(abilityRemainingMs / 1000)}s` : "READY",
    },
    team: {
      mode,
      label: teamLabel(mode),
      playerName: labelOr(state.playerName, FALLBACKS.playerName),
      healthPercentage: clampPercent(teamHealth, teamHealthMax),
      healthLabel: `${clampPercent(teamHealth, teamHealthMax)}%`,
      overflowClass: "hud-text-ellipsis",
    },
    mission: { label: labelOr(state.mission, FALLBACKS.mission) },
    round: { label: `WAVE ${Math.max(1, wholeNumber(state.round, 1))}` },
    timer: { label: formatTimer(state.timer) },
    objective: {
      label: labelOr(state.objective, FALLBACKS.objective),
      overflowClass: "hud-text-ellipsis",
    },
    score: { blue, red, label: `BLUE ${blue} - ${red} RED` },
  };
}
