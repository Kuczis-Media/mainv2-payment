'use strict';

const manager = require('./ai-provider-manager.js');
const { getAdapter } = require('./ai-providers.js');

const LEGACY_DEFAULTS = Object.freeze({
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini'
});

async function resolveConfig(moduleName = 'chat', options = {}) {
  const storesFactory = options.getStores || manager.getAiStores;
  try {
    const stores = storesFactory();
    const { settings } = await manager.readSettings(stores.metadata);
    const assignedId = settings.moduleAssignments[moduleName];
    const candidates = [
      settings.configs.find((item) => item.aiConfigId === assignedId),
      settings.configs.find((item) => item.isDefault)
    ].filter((item, index, list) => item && list.findIndex((other) => other.aiConfigId === item.aiConfigId) === index);
    for (const config of candidates) {
      if (!config.secretConfigured) continue;
      const apiKey = await manager.readSecret(stores.secrets, config.aiConfigId);
      if (apiKey) return { ...config, apiKey, source: 'panel' };
    }
  } catch {
    // A missing or temporarily unavailable Blob store must not break an
    // existing deployment that still uses legacy Function environment keys.
  }
  return legacyEnvironmentConfig();
}

function legacyEnvironmentConfig() {
  const geminiKey = cleanEnv('GEMINI_API_KEY');
  if (geminiKey) return {
    aiConfigId: null,
    name: 'Gemini (ENV)',
    provider: 'gemini',
    model: cleanEnv('GEMINI_MODEL') || LEGACY_DEFAULTS.gemini,
    apiKey: geminiKey,
    source: 'env'
  };
  const openAiKey = cleanEnv('OPENAI_API_KEY');
  if (openAiKey) return {
    aiConfigId: null,
    name: 'OpenAI (ENV)',
    provider: 'openai',
    model: cleanEnv('OPENAI_MODEL') || LEGACY_DEFAULTS.openai,
    apiKey: openAiKey,
    source: 'env'
  };
  return null;
}

async function sendRequest(input, options = {}) {
  const policy = await applyPolicy({ module: input.module || 'chat', userId: input.userId || null });
  if (!policy.ok) throw routerError(policy.code || 'AI_POLICY_REJECTED', 429);
  const config = await resolveConfig(input.module || 'chat', options);
  if (!config) throw routerError('AI_NOT_CONFIGURED', 503);
  const adapter = getAdapter(config.provider);
  const response = await adapter.sendRequest(config, {
    system: typeof input.system === 'string' ? input.system : '',
    messages: Array.isArray(input.messages) ? input.messages : [],
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    temperature: Number.isFinite(input.temperature) ? input.temperature : 0.2,
    maxOutputTokens: Number.isSafeInteger(input.maxOutputTokens) ? input.maxOutputTokens : 4096
  }, options);
  return {
    text: response.text,
    usage: response.usage || null,
    provider: config.provider,
    model: config.model,
    aiConfigId: config.aiConfigId,
    source: config.source
  };
}

async function applyPolicy() {
  // Central extension point for future request/token/user/module/cost limits.
  return { ok: true };
}

function cleanEnv(name) {
  return typeof process.env[name] === 'string' ? process.env[name].trim() : '';
}

function routerError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

module.exports = { applyPolicy, legacyEnvironmentConfig, resolveConfig, sendRequest, _test: { LEGACY_DEFAULTS } };
