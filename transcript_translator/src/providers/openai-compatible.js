const { DEFAULT_MAX_OUTPUT_TOKENS } = require("../constants");

class OpenAICompatibleProvider {
  constructor({ apiKey, baseUrl, timeoutMs }) {
    this.apiKey = apiKey;
    this.baseUrl = trimTrailingSlash(baseUrl);
    this.timeoutMs = timeoutMs;
  }

  async createJsonCompletion({ model, systemPrompt, userPrompt, maxTokens = DEFAULT_MAX_OUTPUT_TOKENS }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_object",
          },
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        throw new Error(`API request failed with ${response.status}: ${rawText}`);
      }

      const payload = JSON.parse(rawText);
      const message = payload?.choices?.[0]?.message?.content;

      if (typeof message !== "string" || message.trim().length === 0) {
        throw new Error("API returned an empty translation payload");
      }

      return JSON.parse(message);
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error(`API request timed out after ${this.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

module.exports = {
  OpenAICompatibleProvider,
};
