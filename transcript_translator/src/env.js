const fs = require("fs/promises");

async function loadDotEnvFile(filePath) {
  let content;

  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  const entries = parseDotEnv(content);
  for (const [key, value] of Object.entries(entries)) {
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function parseDotEnv(content) {
  const entries = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const exportPrefix = line.startsWith("export ") ? "export " : "";
    const pair = exportPrefix ? line.slice(exportPrefix.length).trim() : line;
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const rawValue = pair.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    entries[key] = normalizeEnvValue(rawValue);
  }

  return entries;
}

function normalizeEnvValue(rawValue) {
  if (!rawValue) {
    return "";
  }

  const quote = rawValue[0];
  if ((quote === '"' || quote === "'") && rawValue.endsWith(quote)) {
    return rawValue.slice(1, -1);
  }

  const commentIndex = rawValue.indexOf(" #");
  if (commentIndex !== -1) {
    return rawValue.slice(0, commentIndex).trim();
  }

  return rawValue;
}

module.exports = {
  loadDotEnvFile,
  parseDotEnv,
};
