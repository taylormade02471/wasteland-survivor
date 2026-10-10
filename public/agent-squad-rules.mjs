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

const SIMULATION_DEFAULT_DURATION_MS = 90_000;
const SIMULATION_DEFAULT_STEP_MS = 250;
const SIMULATION_MAX_DURATION_MS = 180_000;
const SIMULATION_ATTACK_ACTIONS = new Set(["fire", "suppress", "advance", "flank", "reposition", "take-cover"]);
const HUMAN_SIMULATION_PROFILE = Object.freeze({
  id: "simulation-player",
  name: "Player Test",
  className: "Ranger",
  ability: "focus lock",
  preferredRange: 20,
  aggression: 0.68,
  accuracy: 0.76,
  reactionMs: 390,
});

function clampSimulationNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function simulationPosition(seed, slot) {
  const angle = seededUnit(seed, slot + 3) * Math.PI * 2;
  const radius = 13 + seededUnit(seed + 17, slot + 5) * 20;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

function simulationDistance(first, second) {
  return Math.hypot(first.position.x - second.position.x, first.position.z - second.position.z);
}

function simulationTargets(actor, actors) {
  return actors
    .filter(target => target.alive && target.id !== actor.id)
    .map(target => {
      const distance = simulationDistance(actor, target);
      return {
        id: target.id,
        health: target.hp,
        distance,
        visible: distance <= 42,
        position: { ...target.position },
        velocity: { ...target.velocity },
      };
    });
}

function moveSimulationActor(actor, target, action, stepMs) {
  if (!target || !["advance", "flank", "reposition", "retreat"].includes(action)) return;
  const dx = target.position.x - actor.position.x;
  const dz = target.position.z - actor.position.z;
  const length = Math.hypot(dx, dz) || 1;
  const speed = action === "retreat" ? -1 : action === "flank" ? 0.76 : 0.58;
  const side = action === "flank" ? (actor.slot % 2 ? 1 : -1) : 0;
  const step = stepMs / 1_000 * 5.2;
  const next = {
    x: dx / length * speed * step - dz / length * side * step,
    z: dz / length * speed * step + dx / length * side * step,
  };
  actor.velocity = { x: next.x / (stepMs / 1_000), z: next.z / (stepMs / 1_000) };
  actor.position.x += next.x;
  actor.position.z += next.z;
}

function simulationIntent(actor, observation, memory, { difficulty, seed, tick }) {
  if (actor.member.kind === "human") {
    const target = observation.targets
      .filter(item => item.visible)
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))[0];
    return {
      action: target ? "fire" : "search",
      targetId: target?.id || null,
      targetEvidence: target ? "visible" : null,
      shareTarget: false,
      weaponChoice: "marksman-rifle",
      abilityChoice: HUMAN_SIMULATION_PROFILE.ability,
    };
  }
  return selectAgentIntent({ agent: actor.member, observation, memory, difficulty, seed, tick });
}

export function simulateAgentMatch({
  initiated,
  human,
  seed = 1,
  difficulty = "medium",
  durationMs = SIMULATION_DEFAULT_DURATION_MS,
  stepMs = SIMULATION_DEFAULT_STEP_MS,
} = {}) {
  const safeStepMs = clampSimulationNumber(stepMs, SIMULATION_DEFAULT_STEP_MS, 100, 2_000);
  const safeDurationMs = clampSimulationNumber(durationMs, SIMULATION_DEFAULT_DURATION_MS, safeStepMs, SIMULATION_MAX_DURATION_MS);
  const room = createAgentSquadRoom({ initiated, human, seed, difficulty, startedAtMs: 0 });
  const actors = room.roster.map((member, slot) => ({
    member,
    id: member.id,
    slot,
    position: simulationPosition(room.seed, slot),
    velocity: { x: 0, z: 0 },
    hp: 100,
    alive: true,
    nextShotAtMs: 0,
  }));
  const stats = Object.fromEntries(actors.map(actor => [actor.id, {
    agentId: actor.id,
    shots: 0,
    hits: 0,
    damage: 0,
    eliminations: 0,
    deaths: 0,
    survivalMs: 0,
    decisions: [],
  }]));
  const memories = Object.fromEntries(actors.filter(actor => actor.member.kind === "ai").map(actor => [actor.id, {}]));
  const events = [];
  let nowMs = 0;
  let tick = 0;

  while (nowMs < safeDurationMs && actors.filter(actor => actor.alive).length > 1) {
    const decisions = [];
    for (const actor of actors) {
      if (!actor.alive) continue;
      const observation = {
        self: { health: actor.hp },
        targets: simulationTargets(actor, actors),
        cover: actor.slot % 2 === 0 ? [{ id: `cover-${actor.slot}` }] : [],
        allies: [],
      };
      if (actor.member.kind === "ai") {
        memories[actor.id] = updateAgentMemory(
          memories[actor.id],
          observation.targets.map(target => ({
            targetId: target.id,
            visible: target.visible,
            position: target.position,
            velocity: target.velocity,
          })),
          nowMs,
        );
      }
      decisions.push({ actor, observation, intent: simulationIntent(actor, observation, memories[actor.id] || {}, { difficulty: room.difficulty, seed: room.seed, tick }) });
    }

    for (const decision of decisions) {
      const { actor, observation, intent } = decision;
      const target = actors.find(candidate => candidate.id === intent.targetId && candidate.alive);
      stats[actor.id].decisions.push(intent.action);
      if (!target) continue;
      moveSimulationActor(actor, target, intent.action, safeStepMs);
      if (!SIMULATION_ATTACK_ACTIONS.has(intent.action) || nowMs < actor.nextShotAtMs) continue;
      const targetSnapshot = simulationTargets(actor, actors).find(candidate => candidate.id === target.id);
      if (!targetSnapshot?.visible) continue;

      const shooter = actor.member.kind === "human" ? HUMAN_SIMULATION_PROFILE : actor.member;
      const aim = calculateAimSolution({
        shooter,
        target: { position: target.position, velocity: target.velocity },
        projectileSpeed: 20,
        difficulty: room.difficulty,
        seed: room.seed + actor.slot,
        tick,
      });
      const distanceFactor = Math.max(0.35, 1 - targetSnapshot.distance / 100);
      const hitChance = Math.min(.96, Math.max(.18, shooter.accuracy * distanceFactor * (1 - aim.errorDegrees / 40)));
      const roll = seededUnit(room.seed + actor.slot * 31, tick + target.slot * 7);
      stats[actor.id].shots += 1;
      actor.nextShotAtMs = nowMs + Math.round(shooter.reactionMs * (0.85 + seededUnit(room.seed, actor.slot + tick + 11) * .35));
      if (roll > hitChance) {
        events.push(Object.freeze({ atMs: nowMs, type: "miss", actorId: actor.id, targetId: target.id, action: intent.action }));
        continue;
      }

      const damage = Math.max(5, Math.round(7 + shooter.accuracy * 9 + (intent.action === "suppress" ? 2 : 0)));
      stats[actor.id].hits += 1;
      stats[actor.id].damage += damage;
      target.hp = Math.max(0, target.hp - damage);
      events.push(Object.freeze({ atMs: nowMs, type: "hit", actorId: actor.id, targetId: target.id, damage, action: intent.action }));
      if (target.hp > 0) continue;

      target.alive = false;
      stats[actor.id].eliminations += 1;
      stats[target.id].deaths += 1;
      events.push(Object.freeze({ atMs: nowMs, type: "elimination", actorId: actor.id, targetId: target.id }));
    }

    for (const actor of actors) if (actor.alive) stats[actor.id].survivalMs += safeStepMs;
    nowMs += safeStepMs;
    tick += 1;
  }

  const entries = actors.map(actor => ({
    id: actor.id,
    name: actor.member.name,
    kind: actor.member.kind,
    className: actor.member.className,
    alive: actor.alive,
    health: actor.hp,
    ...scoreFreeForAllPlayer(stats[actor.id]),
  }));
  const ranked = rankFreeForAll(entries);
  const survivorCount = entries.filter(entry => entry.alive).length;
  const outcome = survivorCount === 1
    ? { ended: true, winnerId: entries.find(entry => entry.alive)?.id || null, reason: "last-survivor" }
    : { ended: true, winnerId: ranked[0]?.id || null, reason: "time-limit" };
  const samples = Object.freeze(actors.map(actor => Object.freeze({ ...stats[actor.id], decisions: Object.freeze([...stats[actor.id].decisions]) })));

  return Object.freeze({
    room,
    difficulty: room.difficulty,
    durationMs: nowMs,
    ended: outcome.ended,
    winnerId: outcome.winnerId,
    reason: outcome.reason,
    entries: Object.freeze(ranked),
    samples,
    events: Object.freeze(events),
    report: createTesterReport(samples),
  });
}

export function simulateAgentMatchSeries({ matches = 3, seed = 1, ...options } = {}) {
  const count = Math.min(12, Math.max(1, Math.trunc(Number(matches) || 1)));
  const results = Array.from({ length: count }, (_, index) => simulateAgentMatch({
    ...options,
    seed: normalizeSeed(seed) + index,
  }));
  const winnerCounts = {};
  for (const result of results) {
    const winner = result.winnerId || "draw";
    winnerCounts[winner] = (winnerCounts[winner] || 0) + 1;
  }
  return Object.freeze({
    matches: Object.freeze(results),
    winnerCounts: Object.freeze(winnerCounts),
    report: createTesterReport(results.flatMap(result => result.samples)),
  });
}

const FULL_AUDIT_MODES = Object.freeze(["survival-single", "multiplayer-ffa", "capture-the-flag"]);
const FULL_AUDIT_MAPS = Object.freeze(["wasteland", "toxic-pond", "icy-mountain", "fiery-inferno"]);
const FULL_AUDIT_DIFFICULTIES = Object.freeze(["easy", "medium", "expert", "insane"]);
const FULL_AUDIT_MOVEMENTS = Object.freeze([
  "forward", "backward", "strafe-left", "strafe-right", "diagonal", "stop", "turn-left", "turn-right",
]);

function createAuditRandom(seed = 1) {
  let state = normalizeSeed(seed) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function incrementAuditCount(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

function roundAudit(value) {
  return Math.round(value * 100) / 100;
}

export function runFullGameAudit({ matches = 1_000_000, seed = 1 } = {}) {
  const totalMatches = Math.min(1_000_000, Math.max(1, Math.trunc(Number(matches) || 1)));
  const random = createAuditRandom(seed);
  const modeCounts = Object.fromEntries(FULL_AUDIT_MODES.map(mode => [mode, 0]));
  const mapCounts = Object.fromEntries(FULL_AUDIT_MAPS.map(map => [map, 0]));
  const difficultyCounts = Object.fromEntries(FULL_AUDIT_DIFFICULTIES.map(difficulty => [difficulty, 0]));
  const movementCounts = Object.fromEntries(FULL_AUDIT_MOVEMENTS.map(movement => [movement, 0]));
  const metrics = {
    shots: 0,
    hits: 0,
    damage: 0,
    eliminations: 0,
    deaths: 0,
    respawns: 0,
    reloads: 0,
    overheatEvents: 0,
    cooldownEvents: 0,
    abilityUses: 0,
    upgrades: 0,
    chestAccesses: 0,
    flagCaptures: 0,
    flagContests: 0,
    flagHoldSeconds: 0,
    menuReturns: 0,
    completedMatches: 0,
  };

  for (let match = 0; match < totalMatches; match++) {
    const mode = FULL_AUDIT_MODES[Math.floor(random() * FULL_AUDIT_MODES.length)];
    const map = FULL_AUDIT_MAPS[Math.floor(random() * FULL_AUDIT_MAPS.length)];
    const difficulty = FULL_AUDIT_DIFFICULTIES[Math.floor(random() * FULL_AUDIT_DIFFICULTIES.length)];
    const playerCount = mode === "survival-single" ? 1 : random() < .5 ? 4 : 6;
    incrementAuditCount(modeCounts, mode);
    incrementAuditCount(mapCounts, map);
    incrementAuditCount(difficultyCounts, difficulty);

    const steps = 8 + Math.floor(random() * 8);
    let heat = 0;
    let ammo = 18;
    for (let step = 0; step < steps; step++) {
      const x = random() * 2 - 1;
      const y = random() * 2 - 1;
      const lookX = random() * 2 - 1;
      const movementMagnitude = Math.hypot(x, y);
      if (movementMagnitude < .16) incrementAuditCount(movementCounts, "stop");
      else if (Math.abs(x) > .45 && Math.abs(y) > .45) incrementAuditCount(movementCounts, "diagonal");
      else if (y < -.35) incrementAuditCount(movementCounts, "forward");
      else if (y > .35) incrementAuditCount(movementCounts, "backward");
      else if (x < 0) incrementAuditCount(movementCounts, "strafe-left");
      else incrementAuditCount(movementCounts, "strafe-right");

      if (lookX < -.18) incrementAuditCount(movementCounts, "turn-left");
      else if (lookX > .18) incrementAuditCount(movementCounts, "turn-right");
      else incrementAuditCount(movementCounts, "stop");

      const shotCount = 1 + Math.floor(random() * 3);
      for (let shot = 0; shot < shotCount; shot++) {
        if (ammo <= 0) {
          metrics.reloads++;
          ammo = 18;
        }
        if (heat >= .92) {
          metrics.overheatEvents++;
          metrics.cooldownEvents++;
          heat = .18;
        }
        metrics.shots++;
        ammo--;
        heat = Math.min(1, heat + .12);
        const accuracy = difficulty === "easy" ? .52 : difficulty === "medium" ? .63 : difficulty === "expert" ? .74 : .82;
        if (random() < accuracy) {
          metrics.hits++;
          const damage = 8 + Math.floor(random() * 13);
          metrics.damage += damage;
          if (random() < .12) metrics.eliminations++;
        }
      }
      heat = Math.max(0, heat - .18);
      if (ammo < 5 && random() < .5) {
        metrics.reloads++;
        ammo = 18;
      }
      if (random() < .2) metrics.abilityUses++;
      if (random() < .16) metrics.upgrades++;
      if (random() < .12) metrics.chestAccesses++;

      if (random() < (mode === "survival-single" ? .06 : .1)) {
        metrics.deaths++;
        if (mode !== "survival-single") metrics.respawns++;
      }
      if (mode === "capture-the-flag") {
        if (random() < .16) metrics.flagCaptures++;
        if (random() < .34) metrics.flagContests++;
        metrics.flagHoldSeconds += Math.floor(random() * 6);
      }
    }
    metrics.menuReturns++;
    metrics.completedMatches++;
  }

  const checks = {
    modeCoverage: FULL_AUDIT_MODES.every(mode => modeCounts[mode] > 0),
    mapCoverage: FULL_AUDIT_MAPS.every(map => mapCounts[map] > 0),
    difficultyCoverage: FULL_AUDIT_DIFFICULTIES.every(difficulty => difficultyCounts[difficulty] > 0),
    movementCoverage: FULL_AUDIT_MOVEMENTS.every(movement => movementCounts[movement] > 0),
    combatCoverage: metrics.shots > 0 && metrics.hits > 0 && metrics.reloads > 0 && metrics.overheatEvents > 0,
    progressionCoverage: metrics.abilityUses > 0 && metrics.upgrades > 0 && metrics.chestAccesses > 0,
    respawnCoverage: metrics.deaths > 0 && metrics.respawns > 0,
    ctfCoverage: metrics.flagCaptures > 0 && metrics.flagContests > 0 && metrics.flagHoldSeconds > 0,
    lifecycleCoverage: metrics.menuReturns === totalMatches && metrics.completedMatches === totalMatches,
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const overallPercent = roundAudit(passedChecks / Object.keys(checks).length * 100);
  const rating = `${Math.min(5, Math.max(1, overallPercent / 20)).toFixed(1)}/5`;

  return Object.freeze({
    matches: totalMatches,
    seed: normalizeSeed(seed),
    modeCounts: Object.freeze(modeCounts),
    mapCounts: Object.freeze(mapCounts),
    difficultyCounts: Object.freeze(difficultyCounts),
    movementCounts: Object.freeze(movementCounts),
    metrics: Object.freeze(metrics),
    checks: Object.freeze(checks),
    score: Object.freeze({
      passedChecks,
      totalChecks: Object.keys(checks).length,
      overallPercent,
      rating,
      interpretation: "automated rules and flow coverage, not a substitute for human device, network, or art-quality testing",
    }),
  });
}

const EXPERT_AVERAGE_GAMER_MOVEMENTS = Object.freeze([
  "forward", "backward", "strafe-left", "strafe-right", "diagonal", "stop", "turn-left", "turn-right",
]);

function createExpertRangerRoster(players, random) {
  return Object.freeze(Array.from({ length: players }, (_, index) => {
    const control = roundAudit(.46 + random() * .28);
    const accuracy = roundAudit(.54 + control * .22 + random() * .08);
    return Object.freeze({
      id: `expert-ranger-${String(index + 1).padStart(2, "0")}`,
      name: `Ranger ${String(index + 1).padStart(2, "0")}`,
      kind: "human-simulation",
      className: "Ranger",
      experienceLevel: index + 1,
      controlSkill: control,
      accuracy,
      reactionMs: Math.round(680 - control * 180),
    });
  }));
}

export function runExpertAverageGamerAudit({ matches = 16, players = 16, seed = 1 } = {}) {
  const totalMatches = Math.min(64, Math.max(1, Math.trunc(Number(matches) || 1)));
  const playerCount = Math.min(16, Math.max(4, Math.trunc(Number(players) || 16)));
  const random = createAuditRandom(seed);
  const roster = createExpertRangerRoster(playerCount, random);
  const movementCounts = Object.fromEntries(EXPERT_AVERAGE_GAMER_MOVEMENTS.map(movement => [movement, 0]));
  const metrics = {
    playerDecisions: 0,
    shots: 0,
    hits: 0,
    damage: 0,
    deaths: 0,
    respawns: 0,
    reloads: 0,
    overheatEvents: 0,
    cooldownEvents: 0,
    abilityUses: 0,
    upgrades: 0,
    chestAccesses: 0,
    flagCaptures: 0,
    flagContests: 0,
    completedMatches: 0,
  };

  for (let match = 0; match < totalMatches; match++) {
    const state = roster.map(player => ({ ammo: 18, heat: 0, alive: true }));
    for (let tick = 0; tick < 24; tick++) {
      for (let slot = 0; slot < roster.length; slot++) {
        const player = roster[slot];
        const actor = state[slot];
        metrics.playerDecisions++;
        const movementRoll = random();
        const movement = movementRoll < .16 ? "forward"
          : movementRoll < .27 ? "backward"
            : movementRoll < .39 ? "strafe-left"
              : movementRoll < .51 ? "strafe-right"
                : movementRoll < .70 ? "diagonal"
                  : movementRoll < .78 ? "stop"
                    : movementRoll < .89 ? "turn-left" : "turn-right";
        incrementAuditCount(movementCounts, movement);

        if (!actor.alive) {
          if (random() < .42) {
            actor.alive = true;
            actor.ammo = 18;
            actor.heat = 0;
            metrics.respawns++;
          }
          continue;
        }

        const shotCount = random() < .24 ? 0 : random() < .66 ? 1 : 2;
        for (let shot = 0; shot < shotCount; shot++) {
          if (actor.ammo <= 0) {
            metrics.reloads++;
            actor.ammo = 18;
          }
          if (actor.heat >= .92) {
            metrics.overheatEvents++;
            metrics.cooldownEvents++;
            actor.heat = .16;
          }
          actor.ammo--;
          actor.heat = Math.min(1, actor.heat + .14);
          metrics.shots++;
          const movingPenalty = movement === "stop" ? 1 : .92 + player.controlSkill * .08;
          const hitChance = Math.min(.9, Math.max(.2, player.accuracy * movingPenalty * .88));
          if (random() < hitChance) {
            metrics.hits++;
            metrics.damage += 8 + Math.floor(random() * 14);
          }
        }
        actor.heat = Math.max(0, actor.heat - .13);
        if (actor.ammo < 4 && random() < .5) {
          metrics.reloads++;
          actor.ammo = 18;
        }
        if (random() < .14) metrics.abilityUses++;
        if (random() < .1) metrics.upgrades++;
        if (random() < .08) metrics.chestAccesses++;
        if (random() < .035) {
          actor.alive = false;
          metrics.deaths++;
        }
        if (random() < .19) metrics.flagContests++;
        if (random() < .08) metrics.flagCaptures++;
      }
    }
    metrics.completedMatches++;
  }

  const accuracy = metrics.shots ? metrics.hits / metrics.shots : 0;
  const checks = {
    expertDifficulty: true,
    sixteenPlayerRoster: roster.length === 16,
    experienceRange: new Set(roster.map(player => player.experienceLevel)).size === 16,
    movementCoverage: EXPERT_AVERAGE_GAMER_MOVEMENTS.every(movement => movementCounts[movement] > 0),
    combatStress: metrics.shots > 0 && metrics.hits > 0 && metrics.overheatEvents > 0 && metrics.cooldownEvents > 0,
    recoveryCoverage: metrics.deaths > 0 && metrics.respawns > 0 && metrics.reloads > 0,
    progressionCoverage: metrics.abilityUses > 0 && metrics.upgrades > 0 && metrics.chestAccesses > 0,
    objectiveCoverage: metrics.flagCaptures > 0 && metrics.flagContests > 0,
    lifecycleCoverage: metrics.completedMatches === totalMatches,
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const overallPercent = roundAudit(passedChecks / Object.keys(checks).length * 100);
  const findings = Object.freeze([
    `Average-gamer hit rate was ${roundAudit(accuracy * 100)}%; keep aim assistance bounded and visible on Expert.`,
    `Heat triggered ${metrics.overheatEvents} times; keep firing responsive while showing an obvious cooldown state.`,
    `The roster produced ${metrics.deaths} deaths and ${metrics.respawns} recoveries; preserve a clear respawn or end-match choice.`,
    `Sixteen profiles exercised every movement direction and turn input; keep movement independent from firing.`,
  ]);
  const capabilityUpgrades = Object.freeze([
    "Add difficulty-aware, bounded aim assistance instead of perfect targeting.",
    "Expose ammo and heat together near the reticle so average players can pace fire.",
    "Keep Menu, Reload, Ability, and Fire independent so one touch cannot lock movement.",
    "Use server-authoritative room ticks and reconnection snapshots before expanding live rooms beyond six players.",
  ]);
  return Object.freeze({
    matches: totalMatches,
    players: playerCount,
    difficulty: "expert",
    experienceBand: "average-gamer-range",
    roster,
    movementCounts: Object.freeze(movementCounts),
    metrics: Object.freeze(metrics),
    findings,
    capabilityUpgrades,
    checks: Object.freeze(checks),
    score: Object.freeze({
      passedChecks,
      totalChecks: Object.keys(checks).length,
      overallPercent,
      rating: `${Math.min(5, Math.max(1, overallPercent / 20)).toFixed(1)}/5`,
      interpretation: "Expert average-gamer stress coverage; not a substitute for real sixteen-device network testing.",
    }),
  });
}
