(() => {
  const {
    clamp,
    getSettings,
    shortcutMatchesEvent,
  } = globalThis.VideoShotCommon;

  const OFFSET_REQUEST = "VIDEO_SCREENSHOTER_OFFSET_REQUEST";
  const OFFSET_RESPONSE = "VIDEO_SCREENSHOTER_OFFSET_RESPONSE";
  const TOAST_ID = "video-screenshoter-toast-root";

  let settings = null;
  let captureInFlight = false;
  const pendingOffsetRequests = new Map();

  init().catch((error) => {
    console.error("[video-screenshoter]", error);
  });

  async function init() {
    settings = await getSettings();
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("message", onWindowMessage, false);
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== "local") {
      return;
    }
    if (changes.nextIndex || changes.shortcut) {
      getSettings()
        .then((nextSettings) => {
          settings = nextSettings;
        })
        .catch((error) => console.error("[video-screenshoter]", error));
    }
  }

  async function onKeyDown(event) {
    if (captureInFlight || event.repeat || !settings) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }
    if (!shortcutMatchesEvent(settings.shortcut, event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const result = await chrome.runtime.sendMessage({
      type: "TRIGGER_CAPTURE_ANY_FRAME",
    });
    if (!result?.ok) {
      showToast(result?.error || "截图失败", "error");
    }
  }

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (message?.type === "TRIGGER_CAPTURE") {
      triggerCapture()
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({ ok: false, error: error.message || "Screenshot failed" })
        );
      return true;
    }

    if (message?.type === "COLLECT_VIDEO_CANDIDATE") {
      const candidate = findBestVideoCandidate();
      sendResponse({
        ok: true,
        hasCandidate: Boolean(candidate),
        score: candidate?.score || 0,
      });
      return false;
    }

    return false;
  }

  function onWindowMessage(event) {
    const message = event.data;
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === OFFSET_REQUEST) {
      handleOffsetRequest(event);
      return;
    }

    if (message.type === OFFSET_RESPONSE) {
      const pending = pendingOffsetRequests.get(message.requestId);
      if (!pending) {
        return;
      }
      pendingOffsetRequests.delete(message.requestId);
      pending.resolve({
        rect: message.rect,
        viewportWidth: message.viewportWidth,
        viewportHeight: message.viewportHeight,
      });
    }
  }

  async function triggerCapture() {
    if (captureInFlight) {
      return { ok: false, error: "Screenshot already running" };
    }

    captureInFlight = true;
    showToast("正在截图...", "info");

    try {
      const candidate = findBestVideoCandidate();
      if (!candidate?.video) {
        throw new Error("当前页面没有找到可用的 video 元素");
      }
      const video = candidate.video;

      const snapshot = describeVideo(video);

      try {
        const dataUrl = await captureDirectFrame(video);
        const saved = await chrome.runtime.sendMessage({
          type: "SAVE_CAPTURE_DATA_URL",
          dataUrl,
        });

        if (!saved?.ok) {
          throw new Error(saved?.error || "保存截图失败");
        }

        showToast(`已保存 ${saved.filename}`, "success");
        return saved;
      } catch (directError) {
        console.warn("[video-screenshoter] direct capture failed:", directError);
      }

      const translated = await translateRectToTop(snapshot.renderRect);
      const viewportWidth = translated.viewportWidth;
      const viewportHeight = translated.viewportHeight;
      const clippedRect = clipRectToViewport(translated.rect, viewportWidth, viewportHeight);

      if (!clippedRect || clippedRect.width < 2 || clippedRect.height < 2) {
        throw new Error("视频没有完整显示在当前视口中，请先把视频切到可见区域或全屏");
      }

      const captureResponse = await chrome.runtime.sendMessage({
        type: "CAPTURE_VISIBLE_TAB",
      });

      if (!captureResponse?.ok || !captureResponse?.dataUrl) {
        throw new Error(captureResponse?.error || "获取标签页截图失败");
      }

      const fallbackDataUrl = await cropTabCaptureToVideo(
        captureResponse.dataUrl,
        clippedRect,
        snapshot.sourceWidth,
        snapshot.sourceHeight,
        viewportWidth,
        viewportHeight
      );

      const saved = await chrome.runtime.sendMessage({
        type: "SAVE_CAPTURE_DATA_URL",
        dataUrl: fallbackDataUrl,
      });

      if (!saved?.ok) {
        throw new Error(saved?.error || "保存截图失败");
      }

      showToast(`已保存 ${saved.filename}（兼容模式）`, "success");
      return saved;
    } catch (error) {
      showToast(error.message || "截图失败", "error");
      return { ok: false, error: error.message || "Screenshot failed" };
    } finally {
      captureInFlight = false;
    }
  }

  function findBestVideoCandidate() {
    const videos = collectVideoElements(document);
    const candidates = videos
      .map((video) => ({ video, score: scoreVideo(video) }))
      .filter((entry) => entry.score > 0);

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => right.score - left.score);
    return candidates[0];
  }

  function collectVideoElements(root) {
    const videos = [];
    const visited = new Set();

    function walk(node) {
      if (!node || visited.has(node)) {
        return;
      }
      visited.add(node);

      if (node instanceof HTMLVideoElement) {
        videos.push(node);
      }

      if (node instanceof Element && node.shadowRoot) {
        walk(node.shadowRoot);
      }

      const children = node.children || node.childNodes;
      if (!children) {
        return;
      }

      for (const child of children) {
        walk(child);
      }
    }

    walk(root);
    return videos;
  }

  function scoreVideo(video) {
    if (!(video instanceof HTMLVideoElement)) {
      return 0;
    }
    if (!video.isConnected || video.readyState < 1 || video.videoWidth < 2 || video.videoHeight < 2) {
      return 0;
    }

    const style = window.getComputedStyle(video);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") === 0) {
      return 0;
    }

    const rect = video.getBoundingClientRect();
    const visibleWidth = clamp(Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0), 0, rect.width);
    const visibleHeight = clamp(Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0), 0, rect.height);
    const visibleArea = visibleWidth * visibleHeight;
    const fullArea = Math.max(rect.width * rect.height, 1);
    const visibilityRatio = visibleArea / fullArea;

    if (visibleArea < 16) {
      return 0;
    }

    let score = visibleArea;
    if (!video.paused && !video.ended) {
      score += 5_000_000;
    }
    if (document.fullscreenElement && document.fullscreenElement.contains(video)) {
      score += 10_000_000;
    }
    score += visibilityRatio * 100_000;
    return score;
  }

  function describeVideo(video) {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const renderRect = getRenderedVideoRect(video);

    return {
      sourceWidth,
      sourceHeight,
      renderRect,
    };
  }

  function getRenderedVideoRect(video) {
    const rect = video.getBoundingClientRect();
    const sourceWidth = Math.max(video.videoWidth, 1);
    const sourceHeight = Math.max(video.videoHeight, 1);
    const style = window.getComputedStyle(video);
    const fit = style.objectFit || "contain";
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    if (!containerWidth || !containerHeight) {
      return rectToPlainObject(rect);
    }

    const sourceRatio = sourceWidth / sourceHeight;
    const containerRatio = containerWidth / containerHeight;

    if (fit === "fill") {
      return rectToPlainObject(rect);
    }

    if (fit === "none") {
      return {
        left: rect.left,
        top: rect.top,
        width: Math.min(containerWidth, sourceWidth),
        height: Math.min(containerHeight, sourceHeight),
        right: rect.left + Math.min(containerWidth, sourceWidth),
        bottom: rect.top + Math.min(containerHeight, sourceHeight),
      };
    }

    const useContain = fit === "contain" || fit === "scale-down" || fit === "";
    if (!useContain) {
      return rectToPlainObject(rect);
    }

    let width = containerWidth;
    let height = containerHeight;

    if (containerRatio > sourceRatio) {
      height = containerHeight;
      width = height * sourceRatio;
    } else {
      width = containerWidth;
      height = width / sourceRatio;
    }

    const left = rect.left + (containerWidth - width) / 2;
    const top = rect.top + (containerHeight - height) / 2;

    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    };
  }

  async function captureDirectFrame(video) {
    const viaCaptureStream = await tryCaptureViaStream(video);
    if (viaCaptureStream) {
      return viaCaptureStream;
    }
    return captureViaCanvas(video);
  }

  async function tryCaptureViaStream(video) {
    if (typeof video.captureStream !== "function" || typeof ImageCapture === "undefined") {
      return null;
    }

    let stream = null;
    let bitmap = null;

    try {
      stream = video.captureStream();
      const [track] = stream.getVideoTracks();
      if (!track) {
        return null;
      }

      const imageCapture = new ImageCapture(track);
      bitmap = await imageCapture.grabFrame();
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error("无法创建 Canvas 上下文");
      }
      context.drawImage(bitmap, 0, 0);
      return await canvasToDataUrl(canvas);
    } catch (error) {
      return null;
    } finally {
      bitmap?.close?.();
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    }
  }

  async function captureViaCanvas(video) {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("无法创建 Canvas 上下文");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvasToDataUrl(canvas);
  }

  async function canvasToDataUrl(canvas) {
    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob((nextBlob) => {
          if (!nextBlob) {
            reject(new Error("无法导出图片"));
            return;
          }
          resolve(nextBlob);
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    });

    return blobToDataUrl(blob);
  }

  async function cropTabCaptureToVideo(
    tabCaptureDataUrl,
    cropRect,
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight
  ) {
    const image = await loadImage(tabCaptureDataUrl);
    const scaleX = image.naturalWidth / viewportWidth;
    const scaleY = image.naturalHeight / viewportHeight;
    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("无法创建 Canvas 上下文");
    }

    context.drawImage(
      image,
      cropRect.left * scaleX,
      cropRect.top * scaleY,
      cropRect.width * scaleX,
      cropRect.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return canvasToDataUrl(canvas);
  }

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
      reader.readAsDataURL(blob);
    });
  }

  async function loadImage(dataUrl) {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("加载截图失败"));
      image.src = dataUrl;
    });
  }

  function clipRectToViewport(rect, viewportWidth, viewportHeight) {
    const left = clamp(rect.left, 0, viewportWidth);
    const top = clamp(rect.top, 0, viewportHeight);
    const right = clamp(rect.right, 0, viewportWidth);
    const bottom = clamp(rect.bottom, 0, viewportHeight);

    if (right <= left || bottom <= top) {
      return null;
    }

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  async function translateRectToTop(localRect) {
    if (window === window.top) {
      return {
        rect: localRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pendingOffsetRequests.delete(requestId);
        reject(new Error("无法定位 iframe 中的视频位置"));
      }, 1500);

      pendingOffsetRequests.set(requestId, {
        resolve: (payload) => {
          window.clearTimeout(timeout);
          resolve(payload);
        },
      });
    });

    window.parent.postMessage(
      {
        type: OFFSET_REQUEST,
        requestId,
        rect: localRect,
      },
      "*"
    );

    return responsePromise;
  }

  function handleOffsetRequest(event) {
    const message = event.data;
    const childFrame = findIframeForWindow(event.source);

    if (!childFrame) {
      return;
    }

    const frameRect = childFrame.getBoundingClientRect();
    const translatedRect = {
      left: frameRect.left + message.rect.left,
      top: frameRect.top + message.rect.top,
      width: message.rect.width,
      height: message.rect.height,
      right: frameRect.left + message.rect.right,
      bottom: frameRect.top + message.rect.bottom,
    };

    if (window === window.top) {
      event.source?.postMessage(
        {
          type: OFFSET_RESPONSE,
          requestId: message.requestId,
          rect: translatedRect,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
        "*"
      );
      return;
    }

    const requestId = message.requestId;
    const relayHandler = (relayEvent) => {
      const relayMessage = relayEvent.data;
      if (!relayMessage || relayMessage.type !== OFFSET_RESPONSE || relayMessage.requestId !== requestId) {
        return;
      }

      window.removeEventListener("message", relayHandler, false);
      event.source?.postMessage(
        {
          type: OFFSET_RESPONSE,
          requestId,
          rect: relayMessage.rect,
          viewportWidth: relayMessage.viewportWidth,
          viewportHeight: relayMessage.viewportHeight,
        },
        "*"
      );
    };

    window.addEventListener("message", relayHandler, false);
    window.parent.postMessage(
      {
        type: OFFSET_REQUEST,
        requestId,
        rect: translatedRect,
      },
      "*"
    );
  }

  function findIframeForWindow(targetWindow) {
    const frames = Array.from(document.querySelectorAll("iframe, frame"));
    return (
      frames.find((frame) => {
        try {
          return frame.contentWindow === targetWindow;
        } catch (_error) {
          return false;
        }
      }) || null
    );
  }

  function rectToPlainObject(rect) {
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(
      target.closest(
        "input, textarea, select, [contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only']"
      )
    );
  }

  function showToast(message, kind) {
    const root = getToastRoot();
    if (!root) {
      return;
    }

    root.textContent = message;
    root.dataset.kind = kind;
    root.classList.add("is-visible");
    window.clearTimeout(showToast.hideTimer);
    showToast.hideTimer = window.setTimeout(() => {
      root.classList.remove("is-visible");
    }, 2200);
  }

  function getToastRoot() {
    let host = document.getElementById(TOAST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = TOAST_ID;
      host.style.all = "initial";
      host.style.position = "fixed";
      host.style.top = "24px";
      host.style.right = "24px";
      host.style.zIndex = "2147483647";
      document.documentElement.appendChild(host);

      const shadowRoot = host.attachShadow({ mode: "open" });
      shadowRoot.innerHTML = `
        <style>
          .toast {
            box-sizing: border-box;
            max-width: min(420px, calc(100vw - 32px));
            padding: 12px 16px;
            border-radius: 14px;
            color: #f8fafc;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(148, 163, 184, 0.28);
            font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity 160ms ease, transform 160ms ease;
            backdrop-filter: blur(10px);
          }
          .toast[data-kind="success"] {
            background: rgba(15, 118, 110, 0.92);
          }
          .toast[data-kind="error"] {
            background: rgba(153, 27, 27, 0.94);
          }
          .toast.is-visible {
            opacity: 1;
            transform: translateY(0);
          }
        </style>
        <div class="toast" data-kind="info"></div>
      `;
      return shadowRoot.querySelector(".toast");
    }

    return host.shadowRoot?.querySelector(".toast") || null;
  }
})();
