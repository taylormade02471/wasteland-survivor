const QUEST_BEACONS = Object.freeze({
  "first-watch": Object.freeze({ mapKey: "wasteland", x: -86, z: 184, label: "Relay at the Looted Armory", color: 0xff9b42 }),
  "scrap-run": Object.freeze({ mapKey: "wasteland", x: -126, z: 78, label: "Scrap cache at the old depot", color: 0xffc34e }),
  "raider-breaker": Object.freeze({ mapKey: "toxic", x: 172, z: -172, label: "Raiders at the flooded pumping station", color: 0xff5d75 }),
  "frontier-reach": Object.freeze({ mapKey: "toxic", x: -162, z: -112, label: "Purifier route through poisoned ground", color: 0x8ee9ff }),
  "defend-the-frontier": Object.freeze({ mapKey: "ice", x: 166, z: 156, label: "Mountain transmitter signal", color: 0xffd36a }),
  "white-signal": Object.freeze({ mapKey: "ice", x: 166, z: -2, label: "White signal in the storm", color: 0xd5d9de }),
  "across-the-cinders": Object.freeze({ mapKey: "inferno", x: -202, z: 18, label: "Ash Castle cinder gate", color: 0xff542e }),
  "crown-of-steel": Object.freeze({ mapKey: "inferno", x: 178, z: -90, label: "Crown of Steel command ruin", color: 0xb7c4d8 }),
});

export function questBeaconProfile({ questId, mapKey } = {}) {
  const beacon = QUEST_BEACONS[questId] || QUEST_BEACONS["first-watch"];
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
