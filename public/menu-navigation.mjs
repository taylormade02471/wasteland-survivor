const INPUTS = new Set(["controller", "keyboard", "mouse", "touch"]);
const FORWARD_DIRECTIONS = new Set(["next", "right", "down"]);
const BACKWARD_DIRECTIONS = new Set(["previous", "left", "up"]);
const PREVIOUS_KEYS = new Set(["arrowup", "arrowleft"]);
const NEXT_KEYS = new Set(["arrowdown", "arrowright"]);
const ACTIVATE_KEYS = new Set(["enter", " "]);

function normalizeCommands(commandIds) {
  const seen = new Set();

  return (Array.isArray(commandIds) ? commandIds : []).flatMap(command => {
    const id = typeof command === "string" ? command : command?.id;
    if (typeof id !== "string" || !id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, disabled: Boolean(command?.disabled) }];
  });
}

function inputSource(source) {
  return INPUTS.has(source) ? source : "programmatic";
}

function directionStep(direction) {
  if (FORWARD_DIRECTIONS.has(direction)) return 1;
  if (BACKWARD_DIRECTIONS.has(direction)) return -1;
  return 0;
}

export function resolveMenuKeyAction(key, context = {}) {
  const { navigationFocused = false, nativeControlFocused = false } = context || {};
  if (!navigationFocused && nativeControlFocused) return null;

  const normalizedKey = typeof key === "string" ? key.toLowerCase() : "";
  if (PREVIOUS_KEYS.has(normalizedKey)) return { type: "move", direction: "previous" };
  if (NEXT_KEYS.has(normalizedKey)) return { type: "move", direction: "next" };
  if (ACTIVATE_KEYS.has(normalizedKey)) return { type: "activate" };
  return null;
}

export function isMenuCommandDisabled(command) {
  return Boolean(command?.disabled || command?.closest?.(".hidden"));
}

export function createMenuNavigator(commandIds, initialId) {
  const commands = normalizeCommands(commandIds);
  let activeId = commands.some(command => command.id === initialId && !command.disabled)
    ? initialId
    : commands.find(command => !command.disabled)?.id ?? null;
  let activeInput = "programmatic";

  const current = () => ({ id: activeId, input: activeInput });

  const findCommand = id => commands.find(command => command.id === id);

  return {
    move(direction, source) {
      const step = directionStep(direction);
      const currentIndex = commands.findIndex(command => command.id === activeId);

      if (step) {
        for (let offset = 1; offset <= commands.length; offset += 1) {
          const index = (currentIndex + step * offset + commands.length) % commands.length;
          const command = commands[index];
          if (!command.disabled) {
            activeId = command.id;
            break;
          }
        }
      }

      activeInput = inputSource(source);
      return current();
    },

    focus(id, source) {
      const command = findCommand(id);
      if (command && !command.disabled) activeId = command.id;
      activeInput = inputSource(source);
      return current();
    },

    activate() {
      const command = findCommand(activeId);
      return command && !command.disabled ? { id: command.id, input: activeInput } : null;
    },

    current,
  };
}
