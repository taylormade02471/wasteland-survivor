const distance = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0));

export function seededRandom(seed = "nightfall") {
  let state = 2166136261;
  for (const character of String(seed)) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function createChestPositions({ mapRadius = 70, count = 1, minPlayerDistance = 18, minSeparation = 30, random = Math.random } = {}) {
  const positions = [];
  for (let attempts = 0; positions.length < count && attempts < 200; attempts++) {
    const candidate = { id: `chest-${positions.length + 1}`, x: (random() * 2 - 1) * mapRadius, z: (random() * 2 - 1) * mapRadius };
    if (distance(candidate, { x: 0, z: 0 }) < minPlayerDistance) continue;
    if (positions.some(position => distance(candidate, position) < minSeparation)) continue;
    positions.push(candidate);
  }
  while (positions.length < count) {
    const angle = positions.length * Math.PI;
    positions.push({ id: `chest-${positions.length + 1}`, x: Math.cos(angle) * mapRadius * .65, z: Math.sin(angle) * mapRadius * .65 });
  }
  return positions;
}

export function nearestChest(player, chests = []) {
  return chests.reduce((nearest, chest) => !nearest || distance(player, chest) < distance(player, nearest) ? chest : nearest, null);
}

export function canAccessChest(player, chests = [], radius = 4.5) {
  const nearest = nearestChest(player, chests);
  return Boolean(nearest && distance(player, nearest) <= radius);
}
