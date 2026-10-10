const UPGRADE_PHASES = new Set(["loadout", "prep"]);

function nonNegativeInteger(value, fallback = 0) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function resolveShieldUpgrade({
  phase,
  scrap = 0,
  shieldLevel = 0,
  baseArmor = 0,
  maxLevel = 10,
  armorPerLevel = 30,
} = {}) {
  const currentScrap = nonNegativeInteger(scrap);
  const currentLevel = nonNegativeInteger(shieldLevel);
  const limit = Math.max(1, nonNegativeInteger(maxLevel, 10));
  const classArmor = nonNegativeInteger(baseArmor);
  const armorStep = Math.max(1, nonNegativeInteger(armorPerLevel, 30));
  const price = 24 + currentLevel * 8;

  if (!UPGRADE_PHASES.has(phase)) {
    return Object.freeze({ applied: false, reason: "wrong-phase", price, message: "Armor upgrades are available in the loadout room or at a supply station." });
  }
  if (currentLevel >= limit) {
    return Object.freeze({ applied: false, reason: "max-level", price, message: "Armor is already at maximum level." });
  }
  if (currentScrap < price) {
    return Object.freeze({ applied: false, reason: "insufficient-scrap", price, message: `Need ${price - currentScrap} more scrap for this armor upgrade.` });
  }

  const nextLevel = currentLevel + 1;
  return Object.freeze({
    applied: true,
    reason: "upgraded",
    price,
    nextScrap: currentScrap - price,
    nextLevel,
    shieldMax: classArmor + nextLevel * armorStep,
    message: `Armor upgraded to level ${nextLevel}. Shield capacity is now ${classArmor + nextLevel * armorStep}.`,
  });
}
