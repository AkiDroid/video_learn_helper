const test = require("node:test");
const assert = require("node:assert/strict");

const { buildOutputPath } = require("../src/config");
const { extractTranslatableCues, parseSubtitleFile, serializeSubtitleFile } = require("../src/subtitles");
const { rebalanceTranslatedLines } = require("../src/translator");

test("buildOutputPath inserts .cn before extension", () => {
  const output = buildOutputPath("/tmp/demo/video.en.srt");
  assert.equal(output, "/tmp/demo/video.en.cn.srt");
});

test("parse and serialize srt cues", () => {
  const input = `1
00:00:00,000 --> 00:00:02,000
Hello there.

2
00:00:02,000 --> 00:00:04,000
General
Kenobi.`;

  const document = parseSubtitleFile(input, "/tmp/demo.srt");

  assert.equal(document.items.length, 2);
  assert.equal(document.items[1].type, "cue");
  assert.deepEqual(document.items[1].textLines, ["General", "Kenobi."]);
  assert.match(serializeSubtitleFile(document), /Kenobi\.\n$/);
});

test("rebalanceTranslatedLines keeps requested line count", () => {
  const lines = rebalanceTranslatedLines(["这是一个很长的句子需要重新切分"], 2);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => line.length > 0));
});

test("extractTranslatableCues keeps full parsed subtitle block together", () => {
  const input = `1
00:00:00,000 --> 00:00:02,000
Hello there.

2
00:00:02,000 --> 00:00:04,000
General
Kenobi.`;

  const document = parseSubtitleFile(input, "/tmp/demo.srt");
  const cues = extractTranslatableCues(document);

  assert.equal(cues[0].timingLine, "00:00:00,000 --> 00:00:02,000");
  assert.deepEqual(cues[1].prefixLines, ["2"]);
  assert.match(cues[1].serializedCue, /00:00:02,000 --> 00:00:04,000\nGeneral\nKenobi\./);
});
