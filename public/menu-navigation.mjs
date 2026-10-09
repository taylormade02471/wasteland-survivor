const INPUTS = new Set(["controller", "keyboard", "mouse", "touch"]);
const FORWARD_DIRECTIONS = new Set(["next", "right", "down"]);
const BACKWARD_DIRECTIONS = new Set(["previous", "left", "up"]);
const PREVIOUS_KEYS = new Set(["arrowup", "arrowleft"]);
const NEXT_KEYS = new Set(["arrowdown", "arrowright"]);
const ACTIVATE_KEYS = new Set(["enter", " "]);

export const LOBBY_CONTROL_ORDER = Object.freeze([
  "lobbyAvatarButton",
  "lobbyProfileReadout",
  "survivalLobbyBtn",
  "teamLobbyBtn",
  "ctf6LobbyBtn",
  "onlineSurvivalBtn",
  "teamSize1Btn",
  "teamSize2Btn",
  "teamSize3Btn",
  "ctf4PlayersLobbyBtn",
  "ctf6PlayersLobbyBtn",
  "dashboardBtn",
  "editProfileBtn",
  "lobbyConnectionsBtn",
  "lobbySettingsBtn",
  "signOutProfileBtn",
  "lobbyGameOptionsSummary",
  "botTeamSize",
  "botDifficulty",
  "storyMapSelect",
  "riskLevel",
  "lobbyBackBtn",
]);

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
  const { navigationFocused = false, nativeControlFocused = false, selectFocused = false } = context || {};
  if (!navigationFocused && nativeControlFocused) return null;
  if (selectFocused) return null;

  const normalizedKey = typeof key === "string" ? key.toLowerCase() : "";
  if (PREVIOUS_KEYS.has(normalizedKey)) return { type: "move", direction: "previous" };
  if (NEXT_KEYS.has(normalizedKey)) return { type: "move", direction: "next" };
  if (ACTIVATE_KEYS.has(normalizedKey)) return { type: "activate" };
  return null;
}

export function isMenuCommandDisabled(command) {
  const descriptor = describeLobbyControl(command);
  return Boolean(descriptor.disabled || !descriptor.visible);
}

export function describeLobbyControl(control) {
  const tagName = typeof control?.tagName === "string" ? control.tagName.toLowerCase() : "";
  const type = tagName === "select" ? "select" : tagName === "summary" ? "summary" : "button";
  const hidden = Boolean(control?.hidden || control?.closest?.(".hidden, [hidden]"));
  const inClosedDetails = Boolean(control?.closest?.("details:not([open])"));
  const visible = Boolean(control?.id) && !hidden && (!inClosedDetails || type === "summary");
  return { id: control?.id || "", type, visible, disabled: Boolean(control?.disabled) };
}

export function visibleLobbyControlDescriptors(controls) {
  return (Array.isArray(controls) ? controls : [])
    .map(describeLobbyControl)
    .filter(control => control.visible);
}

export function resolveLobbyControllerAction(controller = {}, activeControl = {}) {
  if (activeControl?.type === "select") {
    if (controller.dpadLeft) return { type: "select", step: -1 };
    if (controller.dpadRight) return { type: "select", step: 1 };
    if (controller.dpadUp) return { type: "move", direction: "previous" };
    if (controller.dpadDown) return { type: "move", direction: "next" };
  } else {
    if (controller.dpadUp || controller.dpadLeft) return { type: "move", direction: "previous" };
    if (controller.dpadDown || controller.dpadRight) return { type: "move", direction: "next" };
  }
  if (controller.interact) return { type: "activate" };
  return null;
}

export function nextLobbySelectIndex(options, selectedIndex, step) {
  const items = Array.from(options || []);
  const direction = Number(step) < 0 ? -1 : 1;
  const start = Number.isInteger(selectedIndex) && selectedIndex >= 0 ? selectedIndex : 0;
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (start + direction * offset + items.length) % items.length;
    if (!items[index]?.disabled && !items[index]?.hidden) return index;
  }
  return start;
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
