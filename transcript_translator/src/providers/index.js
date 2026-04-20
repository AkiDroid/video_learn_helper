const PROVIDERS = {
  deepseek: {
    name: "deepseek",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    apiKeyEnvNames: ["DEEPSEEK_API_KEY"],
    baseUrlEnvNames: ["DEEPSEEK_BASE_URL"],
    modelEnvNames: ["DEEPSEEK_MODEL"],
  },
};

function getProviderDefinition(name) {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unsupported provider: ${name}`);
  }

  return provider;
}

module.exports = {
  getProviderDefinition,
};
