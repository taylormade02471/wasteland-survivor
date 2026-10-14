import { storyObjectiveForMission, storyObjectiveForQuest } from "./story-objectives.mjs";

export function questBeaconProfile({ questId, mapKey } = {}) {
  const objective = storyObjectiveForQuest(questId) || storyObjectiveForMission("c1-m1");
  const beacon = objective.beacon;
  return Object.freeze({
    ...beacon,
    questId: String(questId || "first-watch"),
    visible: beacon.mapKey === mapKey,
  });
}

export function questBeaconFrame({ profile, elapsed = 0 } = {}) {
  const safe = profile || questBeaconProfile({ questId: "first-watch", mapKey: "wasteland" });
  const time = Math.max(0, Number(elapsed) || 0);
  const pulse = .98 + Math.sin(time * 2.4) * .14;
  return Object.freeze({
    scale: Number(pulse.toFixed(4)),
    opacity: Number((.72 + Math.sin(time * 3.1) * .2).toFixed(4)),
    rotation: Number(((time * .8) % (Math.PI * 2)).toFixed(4)),
    color: safe.color,
  });
}
