import assert from "node:assert/strict";
import test from "node:test";
import { STORY_QUESTS, advanceQuestState, createQuestState, questView } from "../public/story-quests.mjs";

test("story quests advance in order and award separate gold and silver", () => {
  let state = createQuestState();
  const first = advanceQuestState(state, { survivedSeconds: 60 });
  assert.equal(first.completed, true);
  assert.equal(first.quest.missionId, "c1-m1");
  assert.ok(first.reward.gold > 0);
  assert.ok(first.reward.silver > first.reward.gold);
  state = first.state;
  assert.equal(questView(state).id, STORY_QUESTS[1].id);
  assert.equal(questView(state).missionId, "c1-m2");
  const second = advanceQuestState(state, { scrap: 60 });
  assert.equal(second.completed, true);
  assert.equal(second.state.completedIds.length, 2);
});

test("the quest chain covers every authored campaign mission", () => {
  assert.deepEqual(STORY_QUESTS.map(quest => quest.missionId), [
    "c1-m1", "c1-m2", "c2-m1", "c2-m2", "c3-m1", "c3-m2", "c4-m1", "c4-m2",
  ]);
  const finalQuest = STORY_QUESTS.at(-1);
  assert.deepEqual(finalQuest.requirements, [
    { metric: "stage", target: 4 },
    { metric: "discoveries", target: 10 },
  ]);
  let state = createQuestState({ currentIndex: STORY_QUESTS.length - 1 });
  const incomplete = advanceQuestState(state, { stage: 4, discoveries: 9 });
  assert.equal(incomplete.completed, false);
  const complete = advanceQuestState(incomplete.state, { stage: 4, discoveries: 10 });
  assert.equal(complete.completed, true);
  assert.equal(complete.reward.gold, 140);
  assert.equal(complete.reward.silver, 380);
});

test("quest progress is monotonic and duplicate events do not duplicate rewards", () => {
  const first = advanceQuestState(createQuestState(), { survivedSeconds: 60 });
  const duplicate = advanceQuestState(first.state, { survivedSeconds: 120 });
  assert.equal(duplicate.completed, false);
  assert.equal(duplicate.reward.gold, 0);
  assert.equal(duplicate.state.completedIds.length, 1);
  assert.equal(questView(duplicate.state).value, 0);
});
