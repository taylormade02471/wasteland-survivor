const supportedTeamSizes = new Set([1, 2, 3]);
const supportedMaps = new Set(["wasteland", "toxic", "ice", "inferno"]);

export function normalizeTeamSize(value) {
  const match = String(value ?? "").match(/^([123])(?:v\1)?$/);
  const teamSize = Number(match?.[1]);
  return supportedTeamSizes.has(teamSize) ? teamSize : 2;
}

export function teamCapacity(value) {
  return normalizeTeamSize(value) * 2;
}

export function createTeamRoomId(map, teamSize) {
  const normalizedMap = supportedMaps.has(map) ? map : "wasteland";
  const normalizedSize = normalizeTeamSize(teamSize);
  return `${normalizedMap}-teams-${normalizedSize}v${normalizedSize}`;
}

export function createLobbyRoomId({ map, mode, teamSize, ctfPlayers } = {}) {
  const normalizedMap = supportedMaps.has(map) ? map : "wasteland";
  if (mode === "teams") return createTeamRoomId(normalizedMap, teamSize);
  if (mode === "ctf") return `${normalizedMap}-ctf-${Number(ctfPlayers) === 6 ? 6 : 4}`;
  return `${normalizedMap}-solo`;
}

export function resolveMatchCountdown(startsAt, now = Date.now()) {
  const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const deadline = Number.isFinite(Number(startsAt)) ? Number(startsAt) : currentTime;
  const millisecondsRemaining = Math.max(0, deadline - currentTime);
  return {
    startsAt: deadline,
    millisecondsRemaining,
    secondsRemaining: Math.ceil(millisecondsRemaining / 1000),
    expired: millisecondsRemaining === 0,
  };
}

export function resolveMatchReadyAction({ phase, currentStartsAt, startsAt } = {}) {
  const deadline = Number(startsAt);
  if (!Number.isFinite(deadline)) return "ignore";
  if (Number(currentStartsAt) === deadline) return "ignore";
  return phase === "combat" || phase === "prep" ? "defer" : "start";
}

export function resolveMatchResetAction(phase) {
  return phase === "loadout" || phase === "countdown" ? "loadout" : "preserve";
}

export function parseTeamRoomId(roomId) {
  const match = String(roomId ?? "").match(/^(wasteland|toxic|ice|inferno)-teams-([123])v\2$/);
  if (!match) return null;
  const teamSize = Number(match[2]);
  return { map: match[1], teamSize, capacity: teamCapacity(teamSize) };
}

export function createMatchPlan(teamSize, playerIds = []) {
  const normalizedSize = normalizeTeamSize(teamSize);
  const capacity = teamCapacity(normalizedSize);
  const humans = Array.isArray(playerIds) ? playerIds.slice(0, capacity) : [];
  let botNumber = 0;
  const slots = Array.from({ length: capacity }, (_, slot) => {
    const playerId = humans[slot];
    const playerType = playerId === undefined ? "bot" : "human";
    if (playerType === "bot") botNumber++;
    return {
      slot,
      team: slot % 2 === 0 ? "alpha" : "bravo",
      teamSlot: Math.floor(slot / 2),
      playerType,
      playerId: playerType === "human" ? playerId : `bot-${botNumber}`,
    };
  });

  return {
    teamSize: normalizedSize,
    capacity,
    humanPlayers: humans.length,
    botPlayers: capacity - humans.length,
    slots,
  };
}
