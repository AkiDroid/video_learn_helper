(() => {
  const DEFAULT_SHORTCUT = {
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: true,
    code: "KeyS",
  };

  const DEFAULT_SETTINGS = {
    filenamePrefix: "",
    nextIndex: 1,
    shortcut: DEFAULT_SHORTCUT,
  };

  const MODIFIER_CODES = new Set([
    "AltLeft",
    "AltRight",
    "ControlLeft",
    "ControlRight",
    "MetaLeft",
    "MetaRight",
    "ShiftLeft",
    "ShiftRight",
  ]);

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatIndex(index) {
    return String(Math.max(1, Number(index) || 1)).padStart(2, "0");
  }

  function normalizeFilenamePrefix(prefix) {
    if (typeof prefix !== "string") {
      return "";
    }
    return prefix.trim().replace(/[\\/:*?"<>|]+/g, "-");
  }

  function formatFilename(index, prefix = "") {
    const filename = `${formatIndex(index)}.png`;
    const normalizedPrefix = normalizeFilenamePrefix(prefix);
    return normalizedPrefix ? `${normalizedPrefix}_${filename}` : filename;
  }

  async function getSettings() {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    return normalizeSettings(stored);
  }

  async function setSettings(patch) {
    const current = await getSettings();
    const next = normalizeSettings({ ...current, ...patch });
    const normalizedPatch = {};

    for (const key of Object.keys(patch || {})) {
      if (Object.prototype.hasOwnProperty.call(next, key)) {
        normalizedPatch[key] = next[key];
      }
    }

    await chrome.storage.local.set(normalizedPatch);
    return next;
  }

  function normalizeSettings(raw) {
    return {
      filenamePrefix: normalizeFilenamePrefix(raw?.filenamePrefix),
      nextIndex: Math.max(1, Number(raw?.nextIndex) || DEFAULT_SETTINGS.nextIndex),
      shortcut: normalizeShortcut(raw?.shortcut),
    };
  }

  function normalizeShortcut(shortcut) {
    const base = shortcut || DEFAULT_SHORTCUT;
    return {
      altKey: Boolean(base.altKey),
      ctrlKey: Boolean(base.ctrlKey),
      metaKey: Boolean(base.metaKey),
      shiftKey: Boolean(base.shiftKey),
      code: normalizeCode(base.code) || DEFAULT_SHORTCUT.code,
    };
  }

  function normalizeCode(code) {
    if (typeof code !== "string" || !code.trim()) {
      return "";
    }
    return code.trim();
  }

  function isModifierCode(code) {
    return MODIFIER_CODES.has(code);
  }

  function hasModifier(shortcut) {
    return Boolean(
      shortcut?.altKey || shortcut?.ctrlKey || shortcut?.metaKey || shortcut?.shiftKey
    );
  }

  function isValidShortcut(shortcut) {
    return Boolean(shortcut?.code) && !isModifierCode(shortcut.code) && hasModifier(shortcut);
  }

  function eventToShortcut(event) {
    return normalizeShortcut({
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      code: event.code,
    });
  }

  function shortcutMatchesEvent(shortcut, event) {
    const normalized = normalizeShortcut(shortcut);
    return (
      normalized.code === event.code &&
      normalized.altKey === event.altKey &&
      normalized.ctrlKey === event.ctrlKey &&
      normalized.metaKey === event.metaKey &&
      normalized.shiftKey === event.shiftKey
    );
  }

  function shortcutToString(shortcut) {
    const normalized = normalizeShortcut(shortcut);
    const parts = [];

    if (normalized.ctrlKey) {
      parts.push("Ctrl");
    }
    if (normalized.metaKey) {
      parts.push("Cmd");
    }
    if (normalized.altKey) {
      parts.push("Alt");
    }
    if (normalized.shiftKey) {
      parts.push("Shift");
    }
    parts.push(codeToLabel(normalized.code));

    return parts.filter(Boolean).join(" + ");
  }

  function codeToLabel(code) {
    if (!code) {
      return "";
    }
    if (code.startsWith("Key")) {
      return code.slice(3);
    }
    if (code.startsWith("Digit")) {
      return code.slice(5);
    }
    const labels = {
      Backquote: "`",
      Backslash: "\\",
      BracketLeft: "[",
      BracketRight: "]",
      Comma: ",",
      Equal: "=",
      IntlBackslash: "\\",
      Minus: "-",
      Period: ".",
      Quote: "'",
      Semicolon: ";",
      Slash: "/",
      Space: "Space",
      ArrowUp: "Up",
      ArrowDown: "Down",
      ArrowLeft: "Left",
      ArrowRight: "Right",
      Escape: "Esc",
    };
    return labels[code] || code;
  }

  globalThis.VideoShotCommon = {
    DEFAULT_SETTINGS,
    DEFAULT_SHORTCUT,
    clamp,
    codeToLabel,
    eventToShortcut,
    formatFilename,
    formatIndex,
    getSettings,
    hasModifier,
    isModifierCode,
    isValidShortcut,
    normalizeFilenamePrefix,
    normalizeSettings,
    normalizeShortcut,
    setSettings,
    shortcutMatchesEvent,
    shortcutToString,
  };
})();
