// Story quests are intentionally pure and deterministic so the renderer can
// update them from combat, exploration, and match lifecycle events without
// making the controls or network layer responsible for progression.

export const STORY_QUESTS = Object.freeze([
  Object.freeze({ id: "first-watch", missionId: "c1-m1", title: "First Watch", objective: "Survive the cycle", metric: "survivedSeconds", target: 60, reward: Object.freeze({ gold: 18, silver: 42, xp: 120 }) }),
  Object.freeze({ id: "scrap-run", missionId: "c1-m2", title: "Scrap Run", objective: "Collect 60 scrap", metric: "scrap", target: 60, reward: Object.freeze({ gold: 22, silver: 65, xp: 150 }) }),
  Object.freeze({ id: "raider-breaker", missionId: "c2-m1", title: "Raider Breaker", objective: "Defeat 10 raiders", metric: "kills", target: 10, reward: Object.freeze({ gold: 30, silver: 80, xp: 200 }) }),
  Object.freeze({ id: "frontier-reach", missionId: "c2-m2", title: "Frontier Reach", objective: "Reach stage 3", metric: "stage", target: 3, reward: Object.freeze({ gold: 42, silver: 110, xp: 300 }) }),
  Object.freeze({ id: "defend-the-frontier", missionId: "c3-m1", title: "Defend the Frontier", objective: "Discover 4 landmarks", metric: "discoveries", target: 4, reward: Object.freeze({ gold: 60, silver: 160, xp: 450 }) }),
]);

const whole = value => Math.max(0, Math.floor(Number(value) || 0));

export function createQuestState(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const progress = source.progress && typeof source.progress === "object" ? source.progress : {};
  const completed = Array.isArray(source.completedIds) ? source.completedIds.filter(id => STORY_QUESTS.some(quest => quest.id === id)) : [];
  const currentIndex = Math.min(STORY_QUESTS.length - 1, Math.max(0, whole(source.currentIndex)));
  return {
    currentIndex,
    completedIds: [...new Set(completed)],
    progress: {
      survivedSeconds: whole(progress.survivedSeconds),
      scrap: whole(progress.scrap),
      kills: whole(progress.kills),
      stage: whole(progress.stage),
      discoveries: whole(progress.discoveries),
    },
  };
}

export function currentQuest(state = {}) {
  const normalized = createQuestState(state);
  return STORY_QUESTS[normalized.currentIndex] || STORY_QUESTS.at(-1);
}

export function advanceQuestState(state = {}, event = {}) {
  const next = createQuestState(state);
  const quest = currentQuest(next);
  const updates = {
    survivedSeconds: whole(event.survivedSeconds),
    scrap: whole(event.scrap),
    kills: whole(event.kills),
    stage: whole(event.stage),
    discoveries: whole(event.discoveries),
  };
  for (const [key, value] of Object.entries(updates)) next.progress[key] = Math.max(next.progress[key], value);
  if (next.completedIds.includes(quest.id)) return { state: next, quest, completed: false, reward: { gold: 0, silver: 0, xp: 0 } };
  const reached = next.progress[quest.metric] >= quest.target;
  if (!reached) return { state: next, quest, completed: false, reward: { gold: 0, silver: 0, xp: 0 } };
  next.completedIds.push(quest.id);
  const reward = { ...quest.reward };
  next.currentIndex = Math.min(STORY_QUESTS.length - 1, next.currentIndex + 1);
  return { state: next, quest, completed: true, reward };
}

export function questView(state = {}) {
  const normalized = createQuestState(state);
  const quest = currentQuest(normalized);
  return Object.freeze({
    id: quest.id,
    missionId: quest.missionId,
    title: quest.title,
    objective: quest.objective,
    metric: quest.metric,
    target: quest.target,
    value: Math.min(quest.target, normalized.progress[quest.metric] || 0),
    completed: normalized.completedIds.includes(quest.id),
    reward: quest.reward,
  });
}
