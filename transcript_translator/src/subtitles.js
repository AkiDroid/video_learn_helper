const path = require("path");

function parseSubtitleFile(content, inputPath) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const normalized = content.replace(/\r\n/g, "\n");
  const extension = path.extname(inputPath).toLowerCase();
  const format = normalized.startsWith("WEBVTT") || extension === ".vtt" ? "vtt" : "srt";
  const rawBlocks = normalized.split(/\n{2,}/);
  const items = rawBlocks.map((block, blockIndex) => parseBlock(block, blockIndex));

  return {
    eol,
    format,
    items,
  };
}

function serializeSubtitleFile(document) {
  const blocks = document.items.map((item) => {
    if (item.type === "raw") {
      return item.lines.join("\n");
    }

    return [...item.prefixLines, item.timingLine, ...item.textLines].join("\n");
  });

  return `${blocks.join("\n\n")}${document.eol}`;
}

function extractTranslatableCues(document) {
  return document.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === "cue" && item.textLines.some((line) => line.trim().length > 0))
    .map(({ item, index }) => ({
      chunkId: String(index + 1),
      itemIndex: index,
      prefixLines: [...item.prefixLines],
      timingLine: item.timingLine,
      lineCount: item.textLines.length,
      textLines: [...item.textLines],
      serializedCue: serializeCue(item),
    }));
}

function applyTranslations(document, translatedCues) {
  const translatedByIndex = new Map(translatedCues.map((cue) => [cue.itemIndex, cue]));

  document.items.forEach((item, index) => {
    if (item.type !== "cue") {
      return;
    }

    const translatedCue = translatedByIndex.get(index);
    if (translatedCue) {
      item.textLines = translatedCue.textLines;
    }
  });
}

function parseBlock(block, blockIndex) {
  const lines = block.split("\n");
  const timingIndex = lines.findIndex((line) => line.includes("-->"));

  if (timingIndex === -1) {
    return {
      type: "raw",
      blockIndex,
      lines,
    };
  }

  return {
    type: "cue",
    blockIndex,
    prefixLines: lines.slice(0, timingIndex),
    timingLine: lines[timingIndex],
    textLines: lines.slice(timingIndex + 1),
  };
}

function serializeCue(cue) {
  return [...cue.prefixLines, cue.timingLine, ...cue.textLines].join("\n");
}

module.exports = {
  applyTranslations,
  extractTranslatableCues,
  parseSubtitleFile,
  serializeCue,
  serializeSubtitleFile,
};
