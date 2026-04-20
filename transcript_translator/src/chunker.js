function buildCueChunks(cues, maxCharsPerChunk) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const cue of cues) {
    const cueSize = estimateCueSize(cue);

    if (currentChunk.length > 0 && currentSize + cueSize > maxCharsPerChunk) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(cue);
    currentSize += cueSize;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function estimateCueSize(cue) {
  return cue.serializedCue.length + 64;
}

module.exports = {
  buildCueChunks,
};
