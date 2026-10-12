import assert from "node:assert/strict";
import test from "node:test";
import { STORY_QUESTS, advanceQuestState, createQuestState, questView } from "../public/story-quests.mjs";

test("story quests advance in order and award separate gold and silver", () => {
  let state = createQuestState();
  const first = advanceQuestState(state, { survivedSeconds: 60 });
  assert.equal(first.completed, true);
  assert.ok(first.reward.gold > 0);
  assert.ok(first.reward.silver > first.reward.gold);
  state = first.state;
  assert.equal(questView(state).id, STORY_QUESTS[1].id);
  const second = advanceQuestState(state, { scrap: 60 });
  assert.equal(second.completed, true);
  assert.equal(second.state.completedIds.length, 2);
});

test("quest progress is monotonic and duplicate events do not duplicate rewards", () => {
  const first = advanceQuestState(createQuestState(), { survivedSeconds: 60 });
  const duplicate = advanceQuestState(first.state, { survivedSeconds: 120 });
  assert.equal(duplicate.completed, false);
  assert.equal(duplicate.reward.gold, 0);
  assert.equal(duplicate.state.completedIds.length, 1);
  assert.equal(questView(duplicate.state).value, 0);
});
