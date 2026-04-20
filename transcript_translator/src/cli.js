const fs = require("fs/promises");
const path = require("path");

const { buildRuntimeConfig, parseCliArgs, printHelp } = require("./config");
const { loadDotEnvFile } = require("./env");
const { translateSubtitleFile } = require("./translator");

async function runCli(argv) {
  await loadDotEnvFile(path.resolve(__dirname, "..", ".env"));
  const options = parseCliArgs(argv);

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.inputPath) {
    printHelp();
    throw new Error("Subtitle file path is required");
  }

  const config = buildRuntimeConfig(options);
  await ensureFileReadable(config.inputPath);
  const result = await translateSubtitleFile(config);

  process.stdout.write(
    [
      `Translated ${result.cueCount} subtitle cues in ${result.chunkCount} chunk(s).`,
      `Saved to: ${result.outputPath}`,
    ].join("\n") + "\n",
  );
}

async function ensureFileReadable(filePath) {
  await fs.access(filePath);
}

module.exports = {
  runCli,
};
