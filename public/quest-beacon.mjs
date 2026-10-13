const QUEST_BEACONS = Object.freeze({
  "first-watch": Object.freeze({ mapKey: "inferno", x: -86, z: 184, label: "Relay at the Looted Armory", color: 0xff9b42 }),
  "scrap-run": Object.freeze({ mapKey: "inferno", x: -126, z: 78, label: "Scrap cache in the Cinder Line", color: 0xffc34e }),
  "raider-breaker": Object.freeze({ mapKey: "city", x: 172, z: -172, label: "Raiders in Shattered Downtown", color: 0xff5d75 }),
  "frontier-reach": Object.freeze({ mapKey: "ice", x: -162, z: -112, label: "Mountain pass to the frontier", color: 0x8ee9ff }),
  "defend-the-frontier": Object.freeze({ mapKey: "desert", x: 166, z: 156, label: "Desert homes signal", color: 0xffd36a }),
  "white-signal": Object.freeze({ mapKey: "city", x: 166, z: -2, label: "White House signal", color: 0xd5d9de }),
  "across-the-cinders": Object.freeze({ mapKey: "inferno", x: -202, z: 18, label: "Ash Castle cinder gate", color: 0xff542e }),
  "crown-of-steel": Object.freeze({ mapKey: "city", x: 178, z: -90, label: "Crown of Steel command ruin", color: 0xb7c4d8 }),
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
  const safe = profile || questBeaconProfile({ questId: "first-watch", mapKey: "inferno" });
  const time = Math.max(0, Number(elapsed) || 0);
  const pulse = .98 + Math.sin(time * 2.4) * .14;
  return Object.freeze({
    scale: Number(pulse.toFixed(4)),
    opacity: Number((.72 + Math.sin(time * 3.1) * .2).toFixed(4)),
    rotation: Number(((time * .8) % (Math.PI * 2)).toFixed(4)),
    color: safe.color,
  });
}
