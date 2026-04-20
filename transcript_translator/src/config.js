const path = require("path");

const {
  DEFAULT_MAX_CHARS_PER_CHUNK,
  DEFAULT_MAX_CONCURRENT_REQUESTS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} = require("./constants");
const { getProviderDefinition } = require("./providers");

function printHelp() {
  const lines = [
    "Usage:",
    "  node index.js <subtitle-file> [options]",
    "",
    "Options:",
    "  --provider <name>             API provider, default: deepseek",
    "  --model <model>               Model id, default: deepseek-chat",
    "  --api-key <key>               API key, or use provider env vars",
    "  --base-url <url>              Override provider base URL",
    "  --max-chars-per-chunk <num>   Max subtitle payload chars per request",
    "  --concurrency <num>           Max concurrent translation requests",
    "  --timeout-ms <num>            Request timeout in milliseconds",
    "  --help                        Show this help message",
    "",
    ".env / env vars:",
    "  DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL",
    "",
    "Examples:",
    "  node index.js ./sample.srt",
    "  node index.js ./sample.vtt --model deepseek-reasoner",
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

function parseCliArgs(argv) {
  const options = {
    provider: process.env.TRANSLATOR_PROVIDER || process.env.LLM_PROVIDER || "deepseek",
    model: undefined,
    apiKey: undefined,
    baseUrl: undefined,
    maxCharsPerChunk: DEFAULT_MAX_CHARS_PER_CHUNK,
    concurrency:
      toOptionalPositiveInteger(process.env.TRANSLATOR_CONCURRENCY) ||
      toOptionalPositiveInteger(process.env.LLM_CONCURRENCY) ||
      DEFAULT_MAX_CONCURRENT_REQUESTS,
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  };

  let inputPath;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const next = argv[index + 1];
      if (next == null) {
        throw new Error(`Missing value for option ${arg}`);
      }

      if (arg === "--provider") {
        options.provider = next;
      } else if (arg === "--model") {
        options.model = next;
      } else if (arg === "--api-key") {
        options.apiKey = next;
      } else if (arg === "--base-url") {
        options.baseUrl = next;
      } else if (arg === "--max-chars-per-chunk") {
        options.maxCharsPerChunk = toPositiveInteger(next, arg);
      } else if (arg === "--concurrency") {
        options.concurrency = toPositiveInteger(next, arg);
      } else if (arg === "--timeout-ms") {
        options.timeoutMs = toPositiveInteger(next, arg);
      } else {
        throw new Error(`Unknown option: ${arg}`);
      }

      index += 1;
      continue;
    }

    if (inputPath == null) {
      inputPath = arg;
      continue;
    }

    throw new Error(`Unexpected extra argument: ${arg}`);
  }

  return {
    ...options,
    inputPath,
  };
}

function buildRuntimeConfig(cliOptions) {
  const providerDefinition = getProviderDefinition(cliOptions.provider);
  const apiKey =
    cliOptions.apiKey ||
    firstDefined(providerDefinition.apiKeyEnvNames.map((name) => process.env[name])) ||
    process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${providerDefinition.name}". Set ${providerDefinition.apiKeyEnvNames.join(
        " or ",
      )} in transcript_translator/.env or your shell environment.`,
    );
  }

  const baseUrl =
    cliOptions.baseUrl ||
    firstDefined(providerDefinition.baseUrlEnvNames.map((name) => process.env[name])) ||
    providerDefinition.defaultBaseUrl;

  const model =
    cliOptions.model ||
    firstDefined(providerDefinition.modelEnvNames.map((name) => process.env[name])) ||
    providerDefinition.defaultModel;

  return {
    inputPath: path.resolve(cliOptions.inputPath),
    providerName: providerDefinition.name,
    providerDefinition,
    apiKey,
    baseUrl,
    model,
    concurrency: cliOptions.concurrency,
    maxCharsPerChunk: cliOptions.maxCharsPerChunk,
    timeoutMs: cliOptions.timeoutMs,
  };
}

function buildOutputPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.cn${parsed.ext}`);
}

function toPositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return parsed;
}

function toOptionalPositiveInteger(value) {
  if (value == null || String(value).trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function firstDefined(values) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}

module.exports = {
  buildOutputPath,
  buildRuntimeConfig,
  parseCliArgs,
  printHelp,
  toOptionalPositiveInteger,
};
