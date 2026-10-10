import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../public/game3d.js", import.meta.url), "utf8");

test("movement collision uses the captured player position", () => {
  assert.match(source, /const playerFrom = player\.g\.position\.clone\(\);/);
  assert.match(source, /resolvePlayerMapCollision\(playerFrom\);/);
  assert.doesNotMatch(source, /resolvePlayerMapCollision\(beforeMove\);/);
});
