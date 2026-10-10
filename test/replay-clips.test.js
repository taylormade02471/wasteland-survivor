import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReplayLibrary,
  normalizeAutoRecordPreference,
  removeReplayClip,
  selectNextReplayClip,
  toggleReplayFavorite,
} from "../public/replay-clips.mjs";

const clips = [
  { id: "new", createdAt: 300, favorite: false },
  { id: "mid", createdAt: 200, favorite: false },
  { id: "old", createdAt: 100, favorite: true },
];

test("builds a bounded replay library while preserving favorites", () => {
  const result = buildReplayLibrary([
    ...clips,
    { id: "extra-1", createdAt: 90, favorite: false },
    { id: "extra-2", createdAt: 80, favorite: false },
  ], { maxClips: 4 });

  assert.deepEqual(result.map(clip => clip.id), ["new", "mid", "old", "extra-1"]);
  assert.equal(result.find(clip => clip.id === "old").favorite, true);
});

test("favorite toggles and deletion are immutable", () => {
  const toggled = toggleReplayFavorite(clips, "mid");
  assert.equal(toggled.find(clip => clip.id === "mid").favorite, true);
  assert.equal(clips.find(clip => clip.id === "mid").favorite, false);
  assert.deepEqual(removeReplayClip(toggled, "new").map(clip => clip.id), ["mid", "old"]);
});

test("cycles replay selection in either direction", () => {
  assert.equal(selectNextReplayClip(clips, "mid", 1).id, "old");
  assert.equal(selectNextReplayClip(clips, "new", -1).id, "old");
  assert.equal(selectNextReplayClip([], "missing", 1), null);
});

test("normalizes the automatic recording preference", () => {
  assert.equal(normalizeAutoRecordPreference(false), false);
  assert.equal(normalizeAutoRecordPreference("false"), false);
  assert.equal(normalizeAutoRecordPreference("yes"), true);
});
