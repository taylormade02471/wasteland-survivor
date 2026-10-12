import { STORY_CHAPTERS } from "./progression-rules.mjs";

const clampWhole = (value, min, max) => Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));

export function storyCampaignView({ stage = 1, missionIndex = 0, kingdomUnlocked = false } = {}) {
  const chapterIndex = clampWhole(stage, 1, STORY_CHAPTERS.length) - 1;
  const chapter = STORY_CHAPTERS[chapterIndex] || STORY_CHAPTERS[0];
  const missionSlot = clampWhole(missionIndex, 0, chapter.missions.length - 1) % chapter.missions.length;
  const mission = chapter.missions[missionSlot] || chapter.missions[0];
  const epilogue = Boolean(kingdomUnlocked && chapterIndex === STORY_CHAPTERS.length - 1 && missionSlot === chapter.missions.length - 1);
  return Object.freeze({
    chapterId: chapter.id,
    chapterTitle: epilogue ? "Kingdom Rising" : chapter.title,
    map: chapter.map,
    missionId: mission.id,
    missionTitle: epilogue ? "Crown of Steel" : mission.title,
    objective: epilogue ? "Secure the fortress core and establish the survivor kingdom." : mission.objective,
    missionIndex: missionSlot,
  });
}
