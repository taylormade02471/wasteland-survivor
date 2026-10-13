export function summarizeRenderCoverage({ characterCount = 0, enemyCount = 0, weaponCount = 0, terrainState = "pending", terrainDetailCount = 0 } = {}) {
  const characters = Math.max(0, Number(characterCount) || 0);
  const enemies = Math.max(0, Number(enemyCount) || 0);
  const weapons = Math.max(0, Number(weaponCount) || 0);
  const terrain = String(terrainState || "pending");
  const terrainDetails = Math.max(0, Number(terrainDetailCount) || 0);
  return Object.freeze({
    characters,
    enemies,
    weapons,
    terrain,
    terrainDetails,
    complete: characters > 0 && enemies > 0 && weapons > 0 && terrain === "authored" && terrainDetails > 0,
  });
}
