const EVENT_TYPES = new Set(["elimination", "boss-defeat", "objective-capture", "match-victory"]);

const EVENT_PRESENTATION = Object.freeze({
  elimination: Object.freeze({ label: "Elimination", priority: 20 }),
  "boss-defeat": Object.freeze({ label: "Boss defeated", priority: 80 }),
  "objective-capture": Object.freeze({ label: "Objective captured", priority: 60 }),
  "match-victory": Object.freeze({ label: "Victory", priority: 100 }),
});

function finiteTime(value) {
  const time = Number(value);
  return Number.isFinite(time) && time >= 0 ? time : 0;
}

export function normalizeHighlightEvent(event = {}, index = 0) {
  const type = EVENT_TYPES.has(event?.type) ? event.type : "event";
  const id = typeof event?.id === "string" && event.id ? event.id : `event-${index}`;
  const normalized = { id, type, atMs: finiteTime(event?.atMs) };
  if (typeof event?.targetId === "string" && event.targetId) normalized.targetId = event.targetId;
  if (typeof event?.objective === "string" && event.objective) normalized.objective = event.objective;
  return Object.freeze(normalized);
}

function present(event) {
  const details = EVENT_PRESENTATION[event.type];
  return Object.freeze({ ...event, ...(details || {}) });
}

export function detectHighlights(events = [], { multiEliminationWindowMs = 2000 } = {}) {
  const normalized = (Array.isArray(events) ? events : []).map(normalizeHighlightEvent);
  const windowMs = Math.max(0, Number(multiEliminationWindowMs) || 0);
  const result = [];
  let index = 0;

  while (index < normalized.length) {
    const first = normalized[index];
    if (first.type !== "elimination") {
      result.push(present(first));
      index++;
      continue;
    }

    const group = [first];
    while (index + group.length < normalized.length) {
      const next = normalized[index + group.length];
      const previous = group.at(-1);
      if (next.type !== "elimination" || next.atMs - previous.atMs > windowMs) break;
      group.push(next);
    }
    if (group.length > 1) {
      result.push(Object.freeze({
        id: `multi-${group[0].id}`,
        type: "multi-elimination",
        atMs: group.at(-1).atMs,
        eventIds: Object.freeze(group.map(event => event.id)),
        label: "Multi-elimination",
        priority: 70,
      }));
    } else {
      result.push(present(first));
    }
    index += group.length;
  }

  return Object.freeze(result);
}
