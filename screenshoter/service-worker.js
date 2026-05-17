importScripts("common.js");

const { formatFilename, getSettings, setSettings } = globalThis.VideoShotCommon;

let saveQueue = Promise.resolve();
const pendingFilenamePrefixes = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  const current = await getSettings();
  await chrome.storage.local.set(current);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error("[video-screenshoter]", error);
      sendResponse({ ok: false, error: error.message || "Unknown error" });
    });

  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "CAPTURE_VISIBLE_TAB":
      return captureVisibleTab();
    case "SAVE_CAPTURE_DATA_URL":
      return enqueueSave(message?.dataUrl, message?.filenamePrefix, sender?.tab?.id);
    case "TRIGGER_CAPTURE_ON_ACTIVE_TAB":
      return triggerCaptureOnActiveTab(message?.filenamePrefix);
    case "TRIGGER_CAPTURE_ANY_FRAME":
      return triggerCaptureAcrossFrames(sender?.tab?.id, message?.filenamePrefix);
    case "PING":
      return { ok: true, frameId: sender?.frameId ?? 0 };
    default:
      return { ok: false, error: "Unsupported message type" };
  }
}

async function captureVisibleTab() {
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
    format: "png",
  });
  return { ok: true, dataUrl };
}

function enqueueSave(dataUrl, explicitFilenamePrefix, tabId) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return Promise.resolve({ ok: false, error: "Invalid image data" });
  }

  const currentTask = saveQueue.then(async () => {
    const settings = await getSettings();
    const pendingFilenamePrefix = getPendingFilenamePrefix(tabId);
    const filenamePrefix =
      typeof explicitFilenamePrefix === "string"
        ? explicitFilenamePrefix
        : pendingFilenamePrefix ?? settings.filenamePrefix;
    const filename = formatFilename(settings.nextIndex, filenamePrefix);

    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false,
      conflictAction: "overwrite"
    });

    await setSettings({ nextIndex: settings.nextIndex + 1 });
    return { ok: true, filename };
  });

  saveQueue = currentTask.catch(() => {});
  return currentTask;
}

async function triggerCaptureOnActiveTab(filenamePrefix) {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    return { ok: false, error: "No active tab found" };
  }

  return triggerCaptureAcrossFrames(activeTab.id, filenamePrefix);
}

async function triggerCaptureAcrossFrames(tabId, filenamePrefix) {
  if (!tabId) {
    return { ok: false, error: "No tab found" };
  }

  setPendingFilenamePrefix(tabId, filenamePrefix);

  const frameIds = await getFrameIds(tabId);
  let bestFrameId = null;
  let bestScore = 0;

  for (const frameId of frameIds) {
    try {
      const response = await chrome.tabs.sendMessage(
        tabId,
        { type: "COLLECT_VIDEO_CANDIDATE" },
        { frameId }
      );

      if (response?.ok && response.hasCandidate && response.score > bestScore) {
        bestScore = response.score;
        bestFrameId = frameId;
      }
    } catch (_error) {
    }
  }

  if (bestFrameId === null) {
    return { ok: false, error: "当前页面没有找到可用的 video 元素" };
  }

  try {
    const response = await chrome.tabs.sendMessage(
      tabId,
      { type: "TRIGGER_CAPTURE", filenamePrefix },
      { frameId: bestFrameId }
    );
    return response || { ok: false, error: "No response from target frame" };
  } catch (_error) {
    return { ok: false, error: "目标视频所在 frame 无法响应截图请求" };
  }
}

async function getFrameIds(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    return frames.map((frame) => frame.frameId);
  } catch (_error) {
    return [0];
  }
}

function setPendingFilenamePrefix(tabId, filenamePrefix) {
  if (!tabId || typeof filenamePrefix !== "string") {
    return;
  }
  pendingFilenamePrefixes.set(tabId, filenamePrefix);
}

function getPendingFilenamePrefix(tabId) {
  if (!tabId || !pendingFilenamePrefixes.has(tabId)) {
    return null;
  }
  const filenamePrefix = pendingFilenamePrefixes.get(tabId);
  pendingFilenamePrefixes.delete(tabId);
  return filenamePrefix;
}
