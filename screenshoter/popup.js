(() => {
  const {
    eventToShortcut,
    formatFilename,
    getSettings,
    isModifierCode,
    isValidShortcut,
    setSettings,
    shortcutToString,
  } = globalThis.VideoShotCommon;

  const currentFilename = document.getElementById("current-filename");
  const shortcutText = document.getElementById("shortcut-text");
  const shortcutTip = document.getElementById("shortcut-tip");
  const status = document.getElementById("status");
  const resetIndexButton = document.getElementById("reset-index");
  const recordShortcutButton = document.getElementById("record-shortcut");
  const captureNowButton = document.getElementById("capture-now");

  let settings = null;
  let recording = false;

  init().catch((error) => {
    setStatus(error.message || "初始化失败", "error");
  });

  async function init() {
    settings = await getSettings();
    render();

    resetIndexButton.addEventListener("click", resetIndex);
    recordShortcutButton.addEventListener("click", toggleRecording);
    captureNowButton.addEventListener("click", captureNow);
    window.addEventListener("keydown", onRecordKeydown, true);
    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  async function resetIndex() {
    settings = await setSettings({ nextIndex: 1 });
    render();
    setStatus("文件名已重置为 01.png", "success");
  }

  function toggleRecording() {
    recording = !recording;
    recordShortcutButton.textContent = recording ? "按下新快捷键" : "录制快捷键";
    shortcutTip.textContent = recording
      ? "现在按下你想使用的组合键。"
      : "建议至少带一个修饰键，避免误触。";
    shortcutTip.dataset.kind = recording ? "info" : "";
  }

  async function onRecordKeydown(event) {
    if (!recording) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (isModifierCode(event.code)) {
      return;
    }

    const shortcut = eventToShortcut(event);
    if (!isValidShortcut(shortcut)) {
      setStatus("快捷键至少需要一个修饰键，例如 Alt + Shift + S", "error");
      return;
    }

    settings = await setSettings({ shortcut });
    recording = false;
    render();
    recordShortcutButton.textContent = "录制快捷键";
    shortcutTip.textContent = "建议至少带一个修饰键，避免误触。";
    setStatus(`快捷键已更新为 ${shortcutToString(shortcut)}`, "success");
  }

  async function captureNow() {
    setStatus("正在尝试截图...", "info");
    const result = await chrome.runtime.sendMessage({
      type: "TRIGGER_CAPTURE_ON_ACTIVE_TAB",
    });

    if (result?.ok) {
      settings = await getSettings();
      render();
      setStatus(`已保存 ${result.filename}`, "success");
      return;
    }

    setStatus(result?.error || "截图失败", "error");
  }

  async function onStorageChanged(changes, areaName) {
    if (areaName !== "local") {
      return;
    }
    if (changes.nextIndex || changes.shortcut) {
      settings = await getSettings();
      render();
    }
  }

  function render() {
    if (!settings) {
      return;
    }
    currentFilename.textContent = formatFilename(settings.nextIndex);
    shortcutText.textContent = shortcutToString(settings.shortcut);
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind || "";
  }
})();
