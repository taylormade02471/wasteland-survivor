import { CHARACTER_ARCHETYPE_IDS, getCharacterArchetype } from "./character-models.mjs";

export const SUPPORTED_FREE_FOR_ALL_ROOM_SIZES = Object.freeze([4, 6]);

const BOT_CALLSIGNS = Object.freeze([
  "Dust Echo",
  "Iron Mesa",
  "Signal Jack",
  "Cinder Vale",
  "Relay Fox",
  "Triage Blue",
]);

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function stableHash(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableToken(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "room";
}

function seededOrder(values, seed) {
  return values
    .map((value, index) => ({ value, index, rank: stableHash(`${seed}:${value}:${index}`) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.value);
}

function normalizeHumanSlot(slot, index) {
  assert(slot && typeof slot === "object" && !Array.isArray(slot), `humans[${index}] must be an object`);
  assert(slot.type === "human", `humans[${index}].type must be human`);
  assert(typeof slot.id === "string" && slot.id.trim(), `humans[${index}].id is required`);
  if (slot.preferredArchetype != null) {
    assert(CHARACTER_ARCHETYPE_IDS.includes(slot.preferredArchetype), `humans[${index}].preferredArchetype is invalid`);
  }
  return {
    id: slot.id.trim(),
    type: "human",
    playerTag: typeof slot.playerTag === "string" ? slot.playerTag.trim() : "",
    displayName: typeof slot.displayName === "string" && slot.displayName.trim() ? slot.displayName.trim() : `Player ${index + 1}`,
    preferredArchetype: slot.preferredArchetype || null,
  };
}

function normalizeInput({ roomSize, seed, humans }) {
  assert(SUPPORTED_FREE_FOR_ALL_ROOM_SIZES.includes(roomSize), "roomSize must be 4 or 6 for free-for-all character rosters");
  assert(typeof seed === "string" && seed.trim(), "seed is required for deterministic roster assignment");
  assert(Array.isArray(humans), "humans must be an array of normalized human slot records");
  assert(humans.length <= roomSize, "too many humans for requested roomSize");

  const normalizedHumans = humans.map(normalizeHumanSlot);
  const ids = new Set();
  for (const human of normalizedHumans) {
    assert(!ids.has(human.id), `duplicate human id: ${human.id}`);
    ids.add(human.id);
  }
  return { roomSize, seed: seed.trim(), humans: normalizedHumans };
}

function assignArchetypes(roomSize, seed, humans) {
  const available = seededOrder(CHARACTER_ARCHETYPE_IDS, seed);
  const assigned = [];
  const used = new Set();

  for (const human of humans) {
    // Duplicate human preferences are resolved by input order: first valid claimant keeps it,
    // later claimants receive the earliest seeded remaining archetype.
    const preferred = human.preferredArchetype;
    const archetypeId = preferred && !used.has(preferred)
      ? preferred
      : available.find((candidate) => !used.has(candidate));
    used.add(archetypeId);
    assigned.push(archetypeId);
  }

  while (assigned.length < roomSize) {
    const archetypeId = available.find((candidate) => !used.has(candidate));
    used.add(archetypeId);
    assigned.push(archetypeId);
  }

  return assigned;
}

function createSlot({ slotIndex, id, type, playerTag = "", displayName, archetypeId }) {
  const archetype = getCharacterArchetype(archetypeId);
  return {
    slotIndex,
    id,
    type,
    playerTag,
    displayName,
    archetypeId,
    classId: archetype.classId,
    callsign: type === "bot" ? displayName : "",
    isBot: type === "bot",
  };
}

function createBotSlot({ seed, slotIndex, archetypeId, existingIds }) {
  const baseId = `bot-${stableToken(seed)}-${String(slotIndex + 1).padStart(2, "0")}`;
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  existingIds.add(id);
  const callsign = BOT_CALLSIGNS[stableHash(`${seed}:${slotIndex}:callsign`) % BOT_CALLSIGNS.length];
  return createSlot({ slotIndex, id, type: "bot", displayName: callsign, archetypeId });
}

export function createFreeForAllCharacterRoster(options = {}) {
  const { roomSize, seed, humans } = normalizeInput(options);
  const archetypes = assignArchetypes(roomSize, seed, humans);
  const existingIds = new Set(humans.map((human) => human.id));
  const slots = [];

  for (let index = 0; index < humans.length; index += 1) {
    const human = humans[index];
    slots.push(createSlot({
      slotIndex: index,
      id: human.id,
      type: "human",
      playerTag: human.playerTag,
      displayName: human.displayName,
      archetypeId: archetypes[index],
    }));
  }

  for (let index = humans.length; index < roomSize; index += 1) {
    slots.push(createBotSlot({ seed, slotIndex: index, archetypeId: archetypes[index], existingIds }));
  }

  return {
    mode: "free-for-all",
    roomSize,
    seed,
    slots,
  };
}
