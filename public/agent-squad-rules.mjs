const PREP_DURATION_MS = 15_000;
const DEFAULT_MEMORY_MS = 4_000;

const DIFFICULTY = Object.freeze({
  easy: Object.freeze({ reactionScale: 1.45, coordination: 0.25, errorScale: 1.5 }),
  medium: Object.freeze({ reactionScale: 1.15, coordination: 0.48, errorScale: 1.08 }),
  expert: Object.freeze({ reactionScale: 0.9, coordination: 0.72, errorScale: 0.72 }),
  insane: Object.freeze({ reactionScale: 0.72, coordination: 0.9, errorScale: 0.5 }),
});

export const AGENT_RIVALS = Object.freeze([
  Object.freeze({
    id: "agent-raman", name: "Raman", className: "Scout", role: "aggressive skirmisher",
    ability: "dash breach", visualArchetype: "dust-scout", preferredRange: 9,
    aggression: 0.92, accuracy: 0.68, reactionMs: 320,
    weights: Object.freeze({ advance: 0.95, cover: 0.3, flank: 0.85, retreat: 0.2, support: 0.1 }),
  }),
  Object.freeze({
    id: "agent-parfit", name: "Parfit", className: "Ranger", role: "precision cover",
    ability: "focus lock", visualArchetype: "night-ranger", preferredRange: 24,
    aggression: 0.58, accuracy: 0.88, reactionMs: 410,
    weights: Object.freeze({ advance: 0.35, cover: 0.95, flank: 0.55, retreat: 0.45, support: 0.2 }),
  }),
  Object.freeze({
    id: "agent-heisenberg", name: "Heisenberg", className: "Heavy", role: "area controller",
    ability: "shield brace", visualArchetype: "iron-heavy", preferredRange: 17,
    aggression: 0.74, accuracy: 0.72, reactionMs: 520,
    weights: Object.freeze({ advance: 0.55, cover: 0.6, flank: 0.25, retreat: 0.1, support: 0.45 }),
  }),
  Object.freeze({
    id: "agent-banach", name: "Banach", className: "Tech", role: "tactical support",
    ability: "repair pulse", visualArchetype: "signal-tech", preferredRange: 14,
    aggression: 0.46, accuracy: 0.76, reactionMs: 455,
    weights: Object.freeze({ advance: 0.4, cover: 0.7, flank: 0.42, retreat: 0.38, support: 0.92 }),
  }),
  Object.freeze({
    id: "agent-kierkegaard", name: "Kierkegaard", className: "Medic", role: "survival support",
    ability: "field recovery", visualArchetype: "ash-medic", preferredRange: 12,
    aggression: 0.31, accuracy: 0.64, reactionMs: 610,
    weights: Object.freeze({ advance: 0.22, cover: 0.8, flank: 0.18, retreat: 0.72, support: 0.98 }),
  }),
]);

function assertHumanInitiation(initiated, human) {
  if (!initiated || !human?.id || human.kind === "ai") {
    throw new Error("A valid human initiation is required to start this room.");
  }
}

function normalizeSeed(seed) {
  const number = Number(seed);
  return Number.isFinite(number) ? Math.trunc(number) : 1;
}

function seededUnit(seed, salt = 0) {
  let value = (normalizeSeed(seed) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function asHuman(human, slot) {
  const fallbackClasses = ["Survivor", "Warden", "Pathfinder", "Sentinel", "Vanguard", "Outrider"];
  const fallbackVisuals = ["player-survivor", "player-warden", "player-pathfinder", "player-sentinel", "player-vanguard", "player-outrider"];
  return Object.freeze({
    ...human,
    className: human.className || fallbackClasses[slot] || `Survivor ${slot + 1}`,
    visualArchetype: human.visualArchetype || fallbackVisuals[slot] || `player-survivor-${slot + 1}`,
    kind: "human",
    slot,
    teamId: null,
  });
}

function asAgent(template, slot, occupiedIds = []) {
  const occupied = new Set(occupiedIds);
  let id = template.id;
  let suffix = 1;
  while (occupied.has(id)) id = `${template.id}-${suffix++}`;
  return Object.freeze({ ...template, archetypeId: template.id, id, kind: "ai", slot, teamId: null, networkClient: false });
}

export function createAgentSquadRoom({ initiated, human, seed = 1, difficulty = "medium", startedAtMs = 0 } = {}) {
  assertHumanInitiation(initiated, human);
  const normalizedSeed = normalizeSeed(seed);
  const roster = [asHuman(human, 0)];
  for (const agent of AGENT_RIVALS) roster.push(asAgent(agent, roster.length, roster.map((member) => member.id)));
  return Object.freeze({
    id: `agent-squad-${normalizedSeed}`,
    mode: "agent-squad",
    seed: normalizedSeed,
    difficulty: DIFFICULTY[difficulty] ? difficulty : "medium",
    startedBy: human.id,
    startedAtMs,
    prepDurationMs: PREP_DURATION_MS,
    localSimulation: true,
    roster: Object.freeze(roster),
  });
}

export function getCountdownState(room, nowMs) {
  const remainingMs = Math.max(0, room.startedAtMs + room.prepDurationMs - nowMs);
  return Object.freeze({
    phase: remainingMs > 0 ? "preparing" : "active",
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1_000),
  });
}

export function updateAgentMemory(memory = {}, observations = [], nowMs = 0, options = {}) {
  const memoryDurationMs = options.memoryDurationMs ?? DEFAULT_MEMORY_MS;
  const next = {};

  for (const [targetId, evidence] of Object.entries(memory)) {
    if (nowMs - evidence.lastSeenAtMs <= memoryDurationMs) next[targetId] = { ...evidence };
  }

  for (const observation of observations) {
    if (!observation?.targetId || !observation.visible) continue;
    next[observation.targetId] = {
      targetId: observation.targetId,
      position: observation.position ? { ...observation.position } : null,
      velocity: observation.velocity ? { ...observation.velocity } : null,
      lastSeenAtMs: nowMs,
      source: "direct-visibility",
    };
  }
  return next;
}

export function shareSquadIntel({ memory = {}, reports = [], nowMs = 0, difficulty = "medium", memoryDurationMs = DEFAULT_MEMORY_MS } = {}) {
  const next = updateAgentMemory(memory, [], nowMs, { memoryDurationMs });
  const coordination = DIFFICULTY[difficulty]?.coordination ?? DIFFICULTY.medium.coordination;
  const reportLimit = Math.max(1, Math.ceil(reports.length * coordination));
  const verified = reports
    .filter((report) => report?.targetId && report.reporterId && report.verifiedVisible === true)
    .filter((report) => nowMs - report.observedAtMs <= memoryDurationMs)
    .sort((a, b) => b.observedAtMs - a.observedAtMs || a.targetId.localeCompare(b.targetId))
    .slice(0, reportLimit);

  for (const report of verified) {
    next[report.targetId] = {
      targetId: report.targetId,
      position: report.position ? { ...report.position } : null,
      velocity: report.velocity ? { ...report.velocity } : null,
      lastSeenAtMs: report.observedAtMs,
      reporterId: report.reporterId,
      source: "squad-visible-report",
    };
  }
  return next;
}

function validTargets(observation, memory) {
  return (observation.targets || []).filter((target) => target.visible || memory[target.id]);
}

function targetPriority(target) {
  const woundedBonus = target.health == null ? 0 : (100 - target.health) * 0.08;
  const visibleBonus = target.visible ? 20 : 0;
  return visibleBonus + woundedBonus - (target.distance || 0) * 0.25;
}

export function selectAgentIntent({ agent, observation = {}, memory = {}, difficulty = "medium", seed = 1, tick = 0 } = {}) {
  const candidates = validTargets(observation, memory).sort((a, b) => targetPriority(b) - targetPriority(a) || a.id.localeCompare(b.id));
  const target = candidates[0] || null;
  const weaponByClass = {
    Scout: "scrap-smg",
    Ranger: "marksman-rifle",
    Heavy: "rotary-cannon",
    Tech: "arc-projector",
    Medic: "field-carbine",
  };
  if (!target) return Object.freeze({
    action: "search",
    targetId: null,
    shareTarget: false,
    weaponChoice: weaponByClass[agent.className] || "service-rifle",
    abilityChoice: agent.ability,
  });

  const health = observation.self?.health ?? 100;
  const distance = target.distance ?? agent.preferredRange;
  const hasCover = (observation.cover || []).length > 0;
  const allyNeedsHelp = (observation.allies || []).some((ally) => ally.health < 55 && ally.distance <= 8);
  const roll = seededUnit(seed + tick, agent.id.length);
  let action;

  if (agent.className === "Medic" && (health < 58 || allyNeedsHelp)) action = "field-recovery";
  else if (agent.className === "Tech" && allyNeedsHelp) action = "repair-pulse";
  else if (agent.className === "Heavy") action = distance <= agent.preferredRange * 1.25 ? "suppress" : "advance";
  else if (agent.className === "Ranger") action = hasCover ? "take-cover" : "reposition";
  else if (agent.className === "Scout") action = roll < agent.weights.flank ? "flank" : "advance";
  else action = health < 30 ? "retreat" : "fire";

  return Object.freeze({
    action,
    targetId: target.id,
    targetEvidence: target.visible ? "visible" : "remembered",
    shareTarget: DIFFICULTY[difficulty]?.coordination >= 0.48,
    preferredRange: agent.preferredRange,
    weaponChoice: weaponByClass[agent.className] || "service-rifle",
    abilityChoice: agent.ability,
  });
}

export function calculateAimSolution({ shooter, target, projectileSpeed = 20, difficulty = "medium", seed = 1, tick = 0 } = {}) {
  const tuning = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const speed = Math.max(1, projectileSpeed);
  const distance = Math.hypot(target.position.x || 0, target.position.z || 0);
  const leadSeconds = Math.min(1.25, distance / speed) * tuning.coordination;
  const baseError = Math.max(0.7, (1 - shooter.accuracy) * 18);
  const variation = 0.85 + seededUnit(seed, tick + shooter.id.length) * 0.3;
  const errorDegrees = Math.min(12, Math.max(0.35, baseError * tuning.errorScale * variation));

  return Object.freeze({
    predictedPosition: Object.freeze({
      x: target.position.x + (target.velocity?.x || 0) * leadSeconds,
      z: target.position.z + (target.velocity?.z || 0) * leadSeconds,
    }),
    reactionMs: Math.round(shooter.reactionMs * tuning.reactionScale),
    coordination: tuning.coordination,
    errorDegrees,
    healthMultiplier: 1,
    requiresVisibility: true,
  });
}

export function createTesterReport(samples = []) {
  const totals = samples.reduce((sum, sample) => ({
    shots: sum.shots + (sample.shots || 0),
    hits: sum.hits + (sample.hits || 0),
    damage: sum.damage + (sample.damage || 0),
    eliminations: sum.eliminations + (sample.eliminations || 0),
    deaths: sum.deaths + (sample.deaths || 0),
    survivalMs: sum.survivalMs + (sample.survivalMs || 0),
  }), { shots: 0, hits: 0, damage: 0, eliminations: 0, deaths: 0, survivalMs: 0 });
  const decisionMix = {};
  for (const sample of samples) {
    for (const decision of sample.decisions || []) decisionMix[decision] = (decisionMix[decision] || 0) + 1;
  }
  return Object.freeze({
    totals: Object.freeze(totals),
    accuracy: totals.shots ? totals.hits / totals.shots : 0,
    averageSurvivalMs: samples.length ? totals.survivalMs / samples.length : 0,
    decisionMix: Object.freeze(decisionMix),
    fairness: Object.freeze({
      hiddenHealthMultiplier: 1,
      usesPlayerDamageRules: true,
      requiresVisibleOrRememberedEvidence: true,
      omniscience: false,
    }),
  });
}

export function createFreeForAllRoom({ initiated, human, players = [], size = 4, seed = 1, difficulty = "medium", startedAtMs = 0 } = {}) {
  assertHumanInitiation(initiated, human);
  if (size !== 4 && size !== 6) throw new Error("Free-for-all rooms support exactly 4 or 6 players.");

  const humans = [human, ...players]
    .filter((player, index, all) => player?.id && player.kind !== "ai" && all.findIndex((item) => item?.id === player.id) === index)
    .slice(0, size);
  const roster = humans.map((player, index) => asHuman(player, index));
  for (const agent of AGENT_RIVALS) {
    if (roster.length >= size) break;
    roster.push(asAgent(agent, roster.length, roster.map((member) => member.id)));
  }

  const normalizedSeed = normalizeSeed(seed);
  return Object.freeze({
    id: `ffa-${size}-${normalizedSeed}`,
    mode: `ffa-${size}`,
    size,
    seed: normalizedSeed,
    difficulty: DIFFICULTY[difficulty] ? difficulty : "medium",
    startedBy: human.id,
    startedAtMs,
    prepDurationMs: PREP_DURATION_MS,
    localSimulation: true,
    requiresBotPrompt: false,
    opponentModel: "all-vs-all",
    roster: Object.freeze(roster),
  });
}

export function scoreFreeForAllPlayer({ eliminations = 0, damage = 0, survivalMs = 0 } = {}) {
  const safeEliminations = Math.max(0, Math.trunc(eliminations));
  const safeDamage = Math.max(0, Math.trunc(damage));
  const safeSurvivalMs = Math.max(0, Math.trunc(survivalMs));
  return Object.freeze({
    eliminations: safeEliminations,
    damage: safeDamage,
    survivalMs: safeSurvivalMs,
    score: safeEliminations * 1_000 + Math.floor(safeSurvivalMs / 1_000),
  });
}

export function rankFreeForAll(entries = []) {
  return entries.map((entry) => ({ ...entry })).sort((a, b) =>
    (b.score ?? scoreFreeForAllPlayer(b).score) - (a.score ?? scoreFreeForAllPlayer(a).score)
    || (b.eliminations || 0) - (a.eliminations || 0)
    || (b.damage || 0) - (a.damage || 0)
    || (b.survivalMs || 0) - (a.survivalMs || 0)
    || String(a.id).localeCompare(String(b.id))
  );
}

export function determineFreeForAllWinner(entries = []) {
  const survivors = entries.filter((entry) => entry.alive);
  if (survivors.length > 1) return Object.freeze({ ended: false, winnerId: null, reason: "multiple-survivors" });
  if (survivors.length === 1) return Object.freeze({ ended: true, winnerId: survivors[0].id, reason: "last-survivor" });
  const winner = rankFreeForAll(entries)[0];
  return Object.freeze({ ended: true, winnerId: winner?.id || null, reason: "score-tiebreak" });
}

const WAIT_CAP_MS = Object.freeze({ 1: 30_000, 2: 20_000, 3: 15_000, 4: 10_000, 5: 5_000, 6: 0 });

function waitCapForHumans(humanCount, roomSize) {
  if (humanCount >= roomSize) return 0;
  return WAIT_CAP_MS[Math.min(6, Math.max(1, humanCount))];
}

function stampSharedStart(search, nowMs, fillBots) {
  const roster = search.roster.map((member) => ({ ...member }));
  if (fillBots) {
    for (const agent of AGENT_RIVALS) {
      if (roster.length >= search.size) break;
      if (roster.some((member) => member.kind === "ai" && member.archetypeId === agent.id)) continue;
      roster.push(asAgent(agent, roster.length, roster.map((member) => member.id)));
    }
  }
  const stampedRoster = roster.map((member) => Object.freeze({ ...member, startsAtMs: nowMs }));
  return Object.freeze({
    ...search,
    status: "preparing",
    deadlineAtMs: nowMs,
    remainingMs: 0,
    startsAtMs: nowMs,
    preparationEndsAtMs: nowMs + PREP_DURATION_MS,
    roster: Object.freeze(stampedRoster),
  });
}

export function createMatchmakingSearch({ initiated, human, size = 4, seed = 1, difficulty = "medium", requestedAtMs = 0 } = {}) {
  assertHumanInitiation(initiated, human);
  if (size !== 4 && size !== 6) throw new Error("Matchmaking supports exactly 4 or 6 players.");
  const normalizedSeed = normalizeSeed(seed);
  return Object.freeze({
    id: `matchmaking-ffa-${size}-${normalizedSeed}`,
    mode: `ffa-${size}`,
    opponentModel: "all-vs-all",
    authority: "backend",
    status: "searching",
    size,
    seed: normalizedSeed,
    difficulty: DIFFICULTY[difficulty] ? difficulty : "medium",
    startedBy: human.id,
    requestedAtMs,
    deadlineAtMs: requestedAtMs + WAIT_CAP_MS[1],
    prepDurationMs: PREP_DURATION_MS,
    requiresBotPrompt: false,
    roster: Object.freeze([asHuman(human, 0)]),
  });
}

export function addMatchmakingHuman(search, human, nowMs) {
  if (search.status !== "searching" || !human?.id || human.kind === "ai") return search;
  if (search.roster.some((member) => member.id === human.id) || search.roster.length >= search.size) return search;

  const roster = [...search.roster, asHuman(human, search.roster.length)];
  if (roster.length >= search.size) return stampSharedStart({ ...search, roster }, nowMs, false);

  const shortenedDeadline = Math.min(search.deadlineAtMs, nowMs + waitCapForHumans(roster.length, search.size));
  return Object.freeze({ ...search, deadlineAtMs: shortenedDeadline, roster: Object.freeze(roster) });
}

export function advanceMatchmaking(search, nowMs) {
  if (search.status !== "searching") return search;
  const remainingMs = Math.max(0, search.deadlineAtMs - nowMs);
  if (remainingMs > 0) return Object.freeze({ ...search, remainingMs });
  return stampSharedStart(search, nowMs, true);
}
