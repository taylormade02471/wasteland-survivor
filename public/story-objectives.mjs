import { STORY_CHAPTERS } from "./progression-rules.mjs";
import { STORY_QUESTS } from "./story-quests.mjs";

// This is the one authored bridge between the campaign rail, its repeatable
// gameplay requirement, and the 3D world location.  The renderer can use the
// beacon for long-range navigation and the approach point for an interaction
// that is guaranteed to sit outside the connected world's collision blockers.
const OBJECTIVE_PLACEMENTS = Object.freeze({
  "c1-m1": Object.freeze({
    beacon: Object.freeze({ mapKey: "wasteland", x: -86, z: 184, label: "Relay at the Looted Armory", color: 0xff9b42 }),
    approach: Object.freeze({ x: -86, z: 164, radius: 7 }),
    actionId: "restore-relay",
    actionLabel: "Restore Relay",
  }),
  "c1-m2": Object.freeze({
    beacon: Object.freeze({ mapKey: "wasteland", x: -126, z: 78, label: "Scrap cache at the old depot", color: 0xffc34e }),
    approach: Object.freeze({ x: -126, z: 78, radius: 7 }),
    actionId: "hold-relay-perimeter",
    actionLabel: "Secure Perimeter",
  }),
  "c2-m1": Object.freeze({
    beacon: Object.freeze({ mapKey: "toxic", x: 172, z: -172, label: "Raiders at the flooded pumping station", color: 0xff5d75 }),
    approach: Object.freeze({ x: 182, z: -172, radius: 7 }),
    actionId: "survey-pumping-station",
    actionLabel: "Survey Station",
  }),
  "c2-m2": Object.freeze({
    beacon: Object.freeze({ mapKey: "toxic", x: -162, z: -112, label: "Purifier route through poisoned ground", color: 0x8ee9ff }),
    approach: Object.freeze({ x: -162, z: -104, radius: 7 }),
    actionId: "prime-purifier",
    actionLabel: "Prime Purifier",
  }),
  "c3-m1": Object.freeze({
    beacon: Object.freeze({ mapKey: "ice", x: 166, z: 156, label: "Mountain transmitter signal", color: 0xffd36a }),
    approach: Object.freeze({ x: 144, z: 166, radius: 7 }),
    actionId: "align-transmitter",
    actionLabel: "Align Transmitter",
  }),
  "c3-m2": Object.freeze({
    beacon: Object.freeze({ mapKey: "ice", x: 166, z: -2, label: "White signal in the storm", color: 0xd5d9de }),
    approach: Object.freeze({ x: 166, z: 20, radius: 7 }),
    actionId: "protect-white-signal",
    actionLabel: "Raise White Signal",
  }),
  "c4-m1": Object.freeze({
    beacon: Object.freeze({ mapKey: "inferno", x: -202, z: 18, label: "Ash Castle cinder gate", color: 0xff542e }),
    approach: Object.freeze({ x: -202, z: 44, radius: 8 }),
    actionId: "open-cinder-gate",
    actionLabel: "Open Cinder Gate",
  }),
  "c4-m2": Object.freeze({
    beacon: Object.freeze({ mapKey: "inferno", x: 178, z: -90, label: "Crown of Steel command ruin", color: 0xb7c4d8 }),
    approach: Object.freeze({ x: 178, z: -58, radius: 8 }),
    actionId: "secure-fortress-core",
    actionLabel: "Secure Fortress Core",
  }),
});

const MISSIONS = Object.freeze(STORY_CHAPTERS.flatMap(chapter => chapter.missions.map(mission => Object.freeze({
  ...mission,
  chapterId: chapter.id,
  chapterTitle: chapter.title,
  map: chapter.map,
}))));
const MISSION_BY_ID = new Map(MISSIONS.map(mission => [mission.id, mission]));
const QUEST_BY_MISSION_ID = new Map(STORY_QUESTS.map(quest => [quest.missionId, quest]));
export const STORY_OBJECTIVE_STATE_VERSION = 1;

function requirementList(quest) {
  return Object.freeze((quest.requirements?.length
    ? quest.requirements
    : [{ metric: quest.metric, target: quest.target }])
    .map(requirement => Object.freeze({ metric: requirement.metric, target: requirement.target })));
}

function buildObjective(mission) {
  const quest = QUEST_BY_MISSION_ID.get(mission.id);
  const placement = OBJECTIVE_PLACEMENTS[mission.id];
  if (!quest || !placement) throw new Error(`Missing story objective source data for ${mission.id}`);
  return Object.freeze({
    missionId: mission.id,
    questId: quest.id,
    chapterId: mission.chapterId,
    chapterTitle: mission.chapterTitle,
    map: mission.map,
    title: mission.title,
    narrative: mission.objective,
    actionId: placement.actionId,
    actionLabel: placement.actionLabel,
    beacon: placement.beacon,
    approach: placement.approach,
    progression: Object.freeze({
      title: quest.title,
      objective: quest.objective,
      metric: quest.metric,
      target: quest.target,
      requirements: requirementList(quest),
    }),
    reward: Object.freeze({ ...quest.reward }),
  });
}

const objectives = MISSIONS.map(buildObjective);
if (Object.keys(OBJECTIVE_PLACEMENTS).length !== objectives.length || STORY_QUESTS.length !== objectives.length) {
  throw new Error("Story objective catalog must cover every campaign mission exactly once");
}

export const STORY_OBJECTIVES = Object.freeze(objectives);
const OBJECTIVE_BY_MISSION_ID = new Map(STORY_OBJECTIVES.map(objective => [objective.missionId, objective]));
const OBJECTIVE_BY_QUEST_ID = new Map(STORY_OBJECTIVES.map(objective => [objective.questId, objective]));
const OBJECTIVE_MISSION_IDS = new Set(OBJECTIVE_BY_MISSION_ID.keys());

export function storyObjectiveForMission(missionId) {
  return OBJECTIVE_BY_MISSION_ID.get(String(missionId || "")) || null;
}

export function storyObjectiveForQuest(questId) {
  return OBJECTIVE_BY_QUEST_ID.get(String(questId || "")) || null;
}

function canonicalMissionIds(values) {
  const selected = new Set(Array.isArray(values) ? values.filter(id => OBJECTIVE_MISSION_IDS.has(id)) : []);
  return STORY_OBJECTIVES.filter(objective => selected.has(objective.missionId)).map(objective => objective.missionId);
}

function freezeState({ arrivedMissionIds = [], interactedMissionIds = [], completedMissionIds = [] } = {}) {
  const arrivedSource = Array.isArray(arrivedMissionIds) ? arrivedMissionIds : [];
  const interactedSource = Array.isArray(interactedMissionIds) ? interactedMissionIds : [];
  const completedSource = Array.isArray(completedMissionIds) ? completedMissionIds : [];
  const completed = canonicalMissionIds(completedSource);
  const interacted = canonicalMissionIds([...interactedSource, ...completed]);
  const arrived = canonicalMissionIds([...arrivedSource, ...interacted]);
  return Object.freeze({
    version: STORY_OBJECTIVE_STATE_VERSION,
    arrivedMissionIds: Object.freeze(arrived),
    interactedMissionIds: Object.freeze(interacted),
    completedMissionIds: Object.freeze(completed),
  });
}

// This shape is intentionally JSON-safe.  Persist it under progress.storyObjectiveState
// and it can be restored without rehydrating renderer-specific objects.
export function createStoryObjectiveState(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return freezeState({
    arrivedMissionIds: source.arrivedMissionIds,
    interactedMissionIds: source.interactedMissionIds,
    completedMissionIds: source.completedMissionIds,
  });
}

export function storyObjectiveStatus(state = {}, missionId) {
  const normalized = createStoryObjectiveState(state);
  const id = String(missionId || "");
  if (!OBJECTIVE_MISSION_IDS.has(id)) return "unknown";
  if (normalized.completedMissionIds.includes(id)) return "completed";
  if (normalized.interactedMissionIds.includes(id)) return "interacted";
  if (normalized.arrivedMissionIds.includes(id)) return "arrived";
  return "available";
}

export function objectiveInteractionEligibility(state = {}, { missionId, currentMissionId } = {}) {
  const normalized = createStoryObjectiveState(state);
  const objective = storyObjectiveForMission(missionId);
  if (!objective) return Object.freeze({ state: normalized, objective: null, eligible: false, reason: "unknown-mission" });
  if (currentMissionId && objective.missionId !== currentMissionId) {
    return Object.freeze({ state: normalized, objective, eligible: false, reason: "mission-locked" });
  }
  const status = storyObjectiveStatus(normalized, objective.missionId);
  if (status === "completed") return Object.freeze({ state: normalized, objective, eligible: false, reason: "already-completed" });
  if (status === "interacted") return Object.freeze({ state: normalized, objective, eligible: false, reason: "already-interacted" });
  if (status !== "arrived") return Object.freeze({ state: normalized, objective, eligible: false, reason: "arrive-first" });
  return Object.freeze({ state: normalized, objective, eligible: true, reason: "ready" });
}

function eventBase(state, event) {
  const normalized = createStoryObjectiveState(state);
  const objective = storyObjectiveForMission(event?.missionId);
  if (!objective) return { state: normalized, objective: null, reason: "unknown-mission" };
  if (event?.currentMissionId && event.currentMissionId !== objective.missionId) {
    return { state: normalized, objective, reason: "mission-locked" };
  }
  return { state: normalized, objective, reason: null };
}

function eventResult({ state, objective, changed = false, reason, arrived = false, interacted = false, completed = false }) {
  return Object.freeze({ state, objective, changed, reason, arrived, interacted, completed });
}

// A caller should emit `arrived` only after the live player is within
// objective.approach.radius, then emit `interacted` from the existing E/A/touch
// interaction path. `completed` is emitted only once the quest's metric gate is met.
export function applyStoryObjectiveEvent(state = {}, event = {}) {
  const type = String(event?.type || "").toLowerCase();
  const base = eventBase(state, event);
  if (base.reason) return eventResult({ ...base, reason: base.reason });
  const { objective } = base;
  const status = storyObjectiveStatus(base.state, objective.missionId);

  if (type === "arrived") {
    if (status === "completed" || status === "interacted" || status === "arrived") {
      return eventResult({ ...base, reason: "already-arrived" });
    }
    return eventResult({
      state: freezeState({ ...base.state, arrivedMissionIds: [...base.state.arrivedMissionIds, objective.missionId] }),
      objective,
      changed: true,
      reason: "arrived",
      arrived: true,
    });
  }

  if (type === "interacted") {
    const eligibility = objectiveInteractionEligibility(base.state, { missionId: objective.missionId, currentMissionId: event.currentMissionId });
    if (!eligibility.eligible) return eventResult({ ...base, reason: eligibility.reason });
    return eventResult({
      state: freezeState({ ...base.state, interactedMissionIds: [...base.state.interactedMissionIds, objective.missionId] }),
      objective,
      changed: true,
      reason: "interacted",
      interacted: true,
    });
  }

  if (type === "completed") {
    if (status === "completed") return eventResult({ ...base, reason: "already-completed" });
    if (status !== "interacted") return eventResult({ ...base, reason: "interact-first" });
    return eventResult({
      state: freezeState({ ...base.state, completedMissionIds: [...base.state.completedMissionIds, objective.missionId] }),
      objective,
      changed: true,
      reason: "completed",
      completed: true,
    });
  }

  return eventResult({ ...base, reason: "unknown-event" });
}
