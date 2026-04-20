const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCueChunks } = require("../src/chunker");

test("buildCueChunks splits by configured max chars", () => {
  const cues = [
    { textLines: ["hello world"], serializedCue: "1\n00:00:00,000 --> 00:00:01,000\nhello world" },
    { textLines: ["a".repeat(50)], serializedCue: `2\n00:00:01,000 --> 00:00:02,000\n${"a".repeat(50)}` },
    { textLines: ["b".repeat(50)], serializedCue: `3\n00:00:02,000 --> 00:00:03,000\n${"b".repeat(50)}` },
  ];

  const chunks = buildCueChunks(cues, 120);

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 1);
  assert.equal(chunks[1].length, 1);
  assert.equal(chunks[2].length, 1);
});
