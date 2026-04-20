const fs = require("fs/promises");

const { buildCueChunks } = require("./chunker");
const { buildOutputPath } = require("./config");
const { TRANSLATION_SYSTEM_PROMPT } = require("./constants");
const { OpenAICompatibleProvider } = require("./providers/openai-compatible");
const { applyTranslations, extractTranslatableCues, parseSubtitleFile, serializeSubtitleFile } = require("./subtitles");

async function translateSubtitleFile(config) {
  const inputText = await fs.readFile(config.inputPath, "utf8");
  const subtitleDocument = parseSubtitleFile(inputText, config.inputPath);
  const translatableCues = extractTranslatableCues(subtitleDocument);
  const provider = new OpenAICompatibleProvider({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  });

  const chunks = buildCueChunks(translatableCues, config.maxCharsPerChunk);
  const translatedChunks = await mapWithConcurrency(chunks, config.concurrency, async (chunk, index) => {
    process.stderr.write(`Translating chunk ${index + 1}/${chunks.length}...\n`);
    return translateChunk(provider, config.model, chunk);
  });
  const translatedCues = translatedChunks.flat();

  applyTranslations(subtitleDocument, translatedCues);
  const outputPath = buildOutputPath(config.inputPath);
  await fs.writeFile(outputPath, serializeSubtitleFile(subtitleDocument), "utf8");

  return {
    outputPath,
    chunkCount: chunks.length,
    cueCount: translatableCues.length,
  };
}

async function translateChunk(provider, model, cues) {
  const input = {
    items: cues.map((cue) => ({
      id: cue.chunkId,
      prefixLines: cue.prefixLines,
      timingLine: cue.timingLine,
      lineCount: cue.lineCount,
      textLines: cue.textLines,
    })),
  };

  const userPrompt = [
    "Please translate the following subtitle cues to Simplified Chinese and return valid json only.",
    "Each item is one complete parsed subtitle block. Never split one subtitle block across outputs or merge two blocks together.",
    "Keep every id unchanged.",
    "Use timingLine and neighboring textLines as context, but only translate the subtitle text.",
    "The translatedLines array length must match lineCount for each item.",
    "Return json in this format:",
    '{"items":[{"id":"1","translatedLines":["..."]}]}',
    "Input json:",
    JSON.stringify(input),
  ].join("\n");

  const output = await provider.createJsonCompletion({
    model,
    systemPrompt: TRANSLATION_SYSTEM_PROMPT,
    userPrompt,
  });

  const translatedItems = output?.items;
  if (!Array.isArray(translatedItems)) {
    throw new Error("API response is missing items array");
  }

  const translatedById = new Map(
    translatedItems.map((item) => [
      item.id,
      Array.isArray(item.translatedLines) ? item.translatedLines.map((line) => sanitizeLine(line)) : [],
    ]),
  );

  return cues.map((cue) => ({
    itemIndex: cue.itemIndex,
    textLines: rebalanceTranslatedLines(translatedById.get(cue.chunkId), cue.lineCount),
  }));
}

function rebalanceTranslatedLines(lines, expectedCount) {
  const normalized = Array.isArray(lines)
    ? lines.map((line) => sanitizeLine(line)).filter((line) => line.length > 0)
    : [];

  if (expectedCount === 1) {
    return [normalized.join("")];
  }

  if (normalized.length === expectedCount) {
    return normalized;
  }

  const merged = normalized.join("");
  if (!merged) {
    return Array.from({ length: expectedCount }, () => "");
  }

  return splitIntoBalancedLines(merged, expectedCount);
}

function splitIntoBalancedLines(text, count) {
  const lines = [];
  let remainingText = text.trim();
  let remainingCount = count;

  while (remainingCount > 1) {
    const targetLength = Math.max(1, Math.round(remainingText.length / remainingCount));
    const splitPoint = pickSplitPoint(remainingText, targetLength);
    lines.push(remainingText.slice(0, splitPoint).trim());
    remainingText = remainingText.slice(splitPoint).trim();
    remainingCount -= 1;
  }

  lines.push(remainingText);
  return lines;
}

function pickSplitPoint(text, targetLength) {
  const preferredWindow = 8;
  const maxIndex = Math.max(1, Math.min(text.length - 1, targetLength + preferredWindow));
  const minIndex = Math.max(1, targetLength - preferredWindow);

  for (let index = maxIndex; index >= minIndex; index -= 1) {
    if (isNaturalBreak(text[index - 1])) {
      return index;
    }
  }

  return maxIndex;
}

function isNaturalBreak(character) {
  return /[\s,.;:!?，。！？；：、]/.test(character);
}

function sanitizeLine(line) {
  return typeof line === "string" ? line.trim() : "";
}

async function mapWithConcurrency(items, concurrency, worker) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

module.exports = {
  mapWithConcurrency,
  rebalanceTranslatedLines,
  splitIntoBalancedLines,
  translateSubtitleFile,
};
