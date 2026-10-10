const SUPPORTED_TEAM_SIZE = 4;

export function normalizeTeamSize(value) {
  return SUPPORTED_TEAM_SIZE;
}

export function teamCapacity(value) {
  return normalizeTeamSize(value) * 2;
}

export function createTeamRoomId(map, teamSize) {
  return "immersive-teams-4v4";
}

export function createLobbyRoomId({ map, mode, teamSize, ctfPlayers } = {}) {
  if (mode === "teams") return createTeamRoomId(map, teamSize);
  if (mode === "ctf") return `immersive-ctf-${Number(ctfPlayers) === 6 ? 6 : 4}`;
  return "immersive-solo";
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

export function parseTeamRoomId(roomId) {
  const match = String(roomId ?? "").match(/^immersive-teams-4v4(?:-([A-Z0-9]{6}))?$/);
  if (!match) return null;
  return { map: "immersive", teamSize: SUPPORTED_TEAM_SIZE, capacity: teamCapacity(SUPPORTED_TEAM_SIZE) };
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
      team: slot < normalizedSize ? "alpha" : "bravo",
      teamSlot: slot % normalizedSize,
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
