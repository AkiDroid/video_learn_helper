const test = require("node:test");
const assert = require("node:assert/strict");

const { parseDotEnv } = require("../src/env");

test("parseDotEnv parses simple key value pairs", () => {
  const result = parseDotEnv(`
# comment
DEEPSEEK_API_KEY=test-key
DEEPSEEK_MODEL=deepseek-chat
`);

  assert.deepEqual(result, {
    DEEPSEEK_API_KEY: "test-key",
    DEEPSEEK_MODEL: "deepseek-chat",
  });
});

test("parseDotEnv supports export, quotes and inline comments", () => {
  const result = parseDotEnv(`
export DEEPSEEK_BASE_URL="https://api.deepseek.com"
LLM_API_KEY=abc123 # trailing comment
`);

  assert.deepEqual(result, {
    DEEPSEEK_BASE_URL: "https://api.deepseek.com",
    LLM_API_KEY: "abc123",
  });
});
