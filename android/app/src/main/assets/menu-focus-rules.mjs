const DIRECTIONS = new Set(["up", "down", "left", "right"]);

function isAvailable(item) {
  return Boolean(item) && item.enabled !== false && item.hidden !== true;
}

function availableIndexes(items) {
  return items.map((item, index) => isAvailable(item) ? index : -1).filter(index => index >= 0);
}

function normalizeOptions(options = {}) {
  return {
    columns: Math.max(1, Math.floor(Number(options.columns) || 1)),
    wrap: options.wrap !== false,
    repeatDelay: Math.max(0, Number(options.repeatDelay) || 350),
    repeatInterval: Math.max(1, Number(options.repeatInterval) || 100),
  };
}

function normalizeState(state, items, options) {
  const available = availableIndexes(items);
  if (!available.length) return { ...state, index: -1 };
  return available.includes(state.index) ? state : { ...state, index: available[0] };
}

function wrappedIndex(available, index, direction) {
  if (!available.length) return -1;
  if (direction > 0) return available[0];
  return available[available.length - 1];
}

function nextIndex(state, items, direction, options) {
  const available = availableIndexes(items);
  if (!available.length) return -1;
  const currentPosition = available.indexOf(state.index);
  const current = currentPosition < 0 ? available[0] : state.index;
  if (direction === "left" || direction === "right") {
    const delta = direction === "left" ? -1 : 1;
    const rowStart = Math.floor(current / options.columns) * options.columns;
    const rowEnd = Math.min(items.length - 1, rowStart + options.columns - 1);
    for (let candidate = current + delta; candidate >= rowStart && candidate <= rowEnd; candidate += delta) {
      if (available.includes(candidate)) return candidate;
    }
    if (!options.wrap) return current;
    const wrappedStart = delta > 0 ? rowStart : rowEnd;
    const wrappedEnd = delta > 0 ? rowEnd : rowStart;
    for (let candidate = wrappedStart; delta > 0 ? candidate <= wrappedEnd : candidate >= wrappedEnd; candidate += delta) {
      if (available.includes(candidate)) return candidate;
    }
    return current;
  }
  const delta = direction === "up" || direction === "left" ? -1 : 1;
  const stride = options.columns;
  const target = current + delta * stride;
  if (available.includes(target)) return target;

  // Keep moving in the requested direction so disabled/hidden cells are skipped.
  for (let candidate = target; candidate >= 0 && candidate < items.length; candidate += delta * stride) {
    if (available.includes(candidate)) return candidate;
  }
  return options.wrap ? wrappedIndex(available, target, delta) : current;
}

export function createMenuFocusState(items = [], options = {}) {
  const normalized = normalizeOptions(options);
  const available = availableIndexes(items);
  return {
    index: available[0] ?? -1,
    lastDirectionAt: -Infinity,
    heldDirection: null,
    nextRepeatAt: Infinity,
    ...normalized,
  };
}

export function reduceMenuFocus(previousState, event = {}, items = [], options = {}) {
  const state = normalizeState(previousState, items, { ...previousState, ...options });
  const config = normalizeOptions({ ...state, ...options });
  if (event.type === "direction" && DIRECTIONS.has(event.direction)) {
    const at = Number.isFinite(event.at) ? event.at : 0;
    if (at < state.lastDirectionAt) return { ...state, ...config };
    const sameDirection = state.heldDirection === event.direction;
    const allowed = !sameDirection || at >= state.nextRepeatAt;
    if (!allowed) return { ...state, ...config };
    const index = nextIndex(state, items, event.direction, config);
    const firstPress = !sameDirection;
    return {
      ...state,
      ...config,
      index,
      heldDirection: event.direction,
      lastDirectionAt: at,
      nextRepeatAt: at + (firstPress ? config.repeatDelay : config.repeatInterval),
      intent: null,
    };
  }
  if (event.type === "release" || event.type === "direction-end") {
    return { ...state, ...config, heldDirection: null, nextRepeatAt: Infinity, intent: null };
  }
  if (event.type === "activate" || (event.type === "select" && ["a", "A", "Enter", " "].includes(event.key))) {
    const item = items[state.index];
    return { ...state, ...config, intent: item && isAvailable(item) ? { type: "activate", id: item.id } : null };
  }
  if (event.type === "back" || (event.type === "select" && ["b", "B", "Escape", "Backspace"].includes(event.key))) {
    return { ...state, ...config, intent: { type: "back" } };
  }
  return { ...state, ...config, intent: null };
}
