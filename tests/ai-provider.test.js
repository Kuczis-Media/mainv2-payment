'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manager = require('../netlify/ai-provider-manager.js');
const router = require('../netlify/ai-router.js');
const { geminiAdapter, openAiAdapter } = require('../netlify/ai-providers.js');
const adminAi = require('../netlify/functions/admin-ai.js');

class MemoryStore {
  constructor() { this.entries = new Map(); this.revision = 0; }
  async getWithMetadata(key) {
    const entry = this.entries.get(key);
    return entry ? { data: entry.data, etag: entry.etag, metadata: entry.metadata || {} } : null;
  }
  async get(key) { return this.entries.get(key)?.data ?? null; }
  async set(key, data, options = {}) {
    const current = this.entries.get(key);
    if (options.onlyIfNew && current) return { modified: false };
    if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
    this.revision += 1;
    this.entries.set(key, { data, etag: `etag-${this.revision}`, metadata: options.metadata || {} });
    return { modified: true, etag: `etag-${this.revision}` };
  }
  async delete(key) { this.entries.delete(key); }
  async list(options = {}) {
    return {
      blobs: Array.from(this.entries.keys())
        .filter((key) => key.startsWith(options.prefix || ''))
        .sort()
        .map((key) => ({ key }))
    };
  }
}

function freshStores() { return { metadata: new MemoryStore(), secrets: new MemoryStore() }; }

test.afterEach(() => manager._test.resetStoreFactory());

test('administrator UI exposes the AI manager without persisting keys in browser storage', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');
  assert.match(html, /data-admin-tab=["']ai["']/);
  assert.match(html, /data-admin-panel=["']ai["']/);
  assert.match(html, /id=["']admin-ai-secret["'][^>]*type=["']password["']/);
  assert.match(html, /<form id=["']admin-ai-config-form["'][\s\S]*id=["']admin-ai-secret["'][\s\S]*<\/form>/);
  assert.match(html, /3\. Zapisz konfigurację i klucz/);
  assert.match(script, /\/\.netlify\/functions\/admin-ai/);
  assert.match(script, /const pendingSecret = elements\.adminAiSecret\.value\.trim\(\)/);
  assert.match(script, /action: 'set-secret', aiConfigId: selectedId, secret: pendingSecret/);
  assert.doesNotMatch(script, /(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:adminAiSecret|ai-secret)/);
});

test('AI configuration keeps metadata and secret in separate stores and never returns the key', async () => {
  const stores = freshStores();
  let settings = await manager.saveConfig(stores, {
    name: 'Główny Gemini', provider: 'gemini', model: 'gemini-2.5-flash', description: 'Chat'
  }, 'admin-1');
  const id = settings.configs[0].aiConfigId;
  settings = await manager.setConfigSecret(stores, id, 'very-secret-gemini-key', 'admin-1');

  assert.equal(settings.configs[0].secretConfigured, true);
  assert.equal(settings.configs[0].secretHint, '-key');
  assert.equal(JSON.stringify(manager.publicSettings(settings)).includes('very-secret'), false);
  assert.equal(await manager.readSecret(stores.secrets, id), 'very-secret-gemini-key');
  assert.equal(stores.metadata.entries.get('settings.json').data.includes('very-secret'), false);
  assert.equal(Array.from(stores.metadata.entries.values()).some((entry) => entry.data.includes('very-secret-gemini-key')), false);
  const audit = await manager.listAudit(stores.metadata);
  assert.equal(audit.some((entry) => entry.action === 'ai.secret.changed'), true);
  assert.equal(JSON.stringify(audit).includes('very-secret-gemini-key'), false);
});

test('AI key can be replaced and removed without leaving it in public metadata', async () => {
  const stores = freshStores();
  let settings = await manager.saveConfig(stores, { name: 'OpenAI', provider: 'openai', model: 'gpt-4.1-mini' }, 'admin');
  const id = settings.configs[0].aiConfigId;
  await manager.setConfigSecret(stores, id, 'first-secret-key-1234', 'admin');
  settings = await manager.setConfigSecret(stores, id, 'second-secret-key-9876', 'admin');
  assert.equal(await manager.readSecret(stores.secrets, id), 'second-secret-key-9876');
  assert.equal(settings.configs[0].secretHint, '9876');
  settings = await manager.removeConfigSecret(stores, id, 'admin');
  assert.equal(await manager.readSecret(stores.secrets, id), '');
  assert.equal(settings.configs[0].secretConfigured, false);
});

test('default and per-module AI routing use stable config IDs', async () => {
  const stores = freshStores();
  let settings = await manager.saveConfig(stores, { name: 'Gemini', provider: 'gemini', model: 'gemini-custom' }, 'admin');
  const geminiId = settings.configs[0].aiConfigId;
  settings = await manager.saveConfig(stores, { name: 'OpenAI', provider: 'openai', model: 'gpt-custom' }, 'admin');
  const openAiId = settings.configs.find((item) => item.provider === 'openai').aiConfigId;
  await manager.setConfigSecret(stores, geminiId, 'gemini-secret-key', 'admin');
  await manager.setConfigSecret(stores, openAiId, 'openai-secret-key', 'admin');
  await manager.setDefaultConfig(stores, openAiId, 'admin');
  await manager.setModuleAssignment(stores, 'chat', geminiId, 'admin');
  await manager.setModuleAssignment(stores, 'other', geminiId, 'admin');

  const chat = await router.resolveConfig('chat', { getStores: () => stores });
  const grader = await router.resolveConfig('aiGrader', { getStores: () => stores });
  const futureModule = await router.resolveConfig('futureTutor', { getStores: () => stores });
  assert.equal(chat.aiConfigId, geminiId);
  assert.equal(chat.apiKey, 'gemini-secret-key');
  assert.equal(grader.aiConfigId, openAiId);
  assert.equal(futureModule.aiConfigId, geminiId);
});

test('router preserves legacy Gemini ENV fallback when panel storage is unavailable', async (t) => {
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenAi = process.env.OPENAI_API_KEY;
  t.after(() => {
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalGemini;
    if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenAi;
  });
  process.env.GEMINI_API_KEY = 'legacy-key';
  process.env.OPENAI_API_KEY = 'other-key';
  const config = await router.resolveConfig('chat', { getStores: () => { throw new Error('offline'); } });
  assert.equal(config.provider, 'gemini');
  assert.equal(config.model, 'gemini-2.5-flash');
  assert.equal(config.apiKey, 'legacy-key');
});

test('OpenAI from ENV can be assigned to chat even when panel configurations exist', async (t) => {
  const stores = freshStores();
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenAi = process.env.OPENAI_API_KEY;
  const originalOpenAiModel = process.env.OPENAI_MODEL;
  t.after(() => {
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalGemini;
    if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenAi;
    if (originalOpenAiModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = originalOpenAiModel;
  });
  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_API_KEY = 'openai-env-secret';
  process.env.OPENAI_MODEL = 'gpt-env-model';
  await manager.saveConfig(stores, { name: 'Panel Gemini', provider: 'gemini', model: 'gemini-panel' }, 'admin');
  await manager.setModuleAssignment(stores, 'chat', 'env-openai', 'admin');

  const { settings } = await manager.readSettings(stores.metadata);
  const config = await router.resolveConfig('chat', { getStores: () => stores });
  const publicEnv = router.environmentConfigs();
  assert.equal(settings.moduleAssignments.chat, 'env-openai');
  assert.equal(config.aiConfigId, 'env-openai');
  assert.equal(config.model, 'gpt-env-model');
  assert.equal(config.apiKey, 'openai-env-secret');
  assert.equal(publicEnv[0].aiConfigId, 'env-openai');
  assert.equal(JSON.stringify(publicEnv).includes('openai-env-secret'), false);
});

test('OpenAI and Gemini adapters normalize responses without exposing keys in URLs', async () => {
  const requested = [];
  const openAi = await openAiAdapter.sendRequest({ model: 'gpt-test', apiKey: 'openai-secret' }, {
    system: 'System', messages: [{ role: 'user', content: 'Hej' }], attachments: [], temperature: 0.2, maxOutputTokens: 100
  }, { fetchImpl: async (url, options) => {
    requested.push({ url: String(url), options });
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'OpenAI OK' }] }], usage: { total_tokens: 7 } }), { status: 200 });
  }});
  const gemini = await geminiAdapter.sendRequest({ model: 'gemini-test', apiKey: 'gemini-secret' }, {
    system: '', messages: [{ role: 'user', content: 'Hej' }], attachments: [], temperature: 0.2, maxOutputTokens: 100
  }, { fetchImpl: async (url, options) => {
    requested.push({ url: String(url), options });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini OK' }] } }] }), { status: 200 });
  }});
  assert.equal(openAi.text, 'OpenAI OK');
  assert.equal(gemini.text, 'Gemini OK');
  assert.equal(requested.some((entry) => /openai-secret|gemini-secret/.test(entry.url)), false);
  assert.equal(requested[0].options.headers.Authorization, 'Bearer openai-secret');
  assert.equal(requested[1].options.headers['x-goog-api-key'], 'gemini-secret');
});

test('non-admin user cannot read AI configuration endpoint', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    id: 'user-1', app_metadata: { roles: ['active'], session_id: 's1' }
  }), { status: 200 });
  const response = await adminAi.handler({
    httpMethod: 'GET',
    headers: { authorization: 'Bearer token' },
    clientContext: {
      user: { id: 'user-1', app_metadata: { roles: ['active'], session_id: 's1' } },
      identity: { url: 'https://example.netlify.app/.netlify/identity' }
    }
  });
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).error, 'ADMIN_REQUIRED');
});

test('admin endpoint returns key status but never the stored secret', async (t) => {
  const stores = freshStores();
  let settings = await manager.saveConfig(stores, { name: 'Gemini', provider: 'gemini', model: 'gemini-test' }, 'admin-1');
  await manager.setConfigSecret(stores, settings.configs[0].aiConfigId, 'endpoint-secret-value', 'admin-1');
  manager._test.setStoreFactory(() => stores);
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    id: 'admin-1', app_metadata: { roles: ['admin'], session_id: 's1' }
  }), { status: 200 });
  const response = await adminAi.handler({
    httpMethod: 'GET',
    headers: { authorization: 'Bearer token' },
    clientContext: {
      user: { id: 'admin-1', app_metadata: { roles: ['admin'], session_id: 's1' } },
      identity: { url: 'https://example.netlify.app/.netlify/identity' }
    }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.includes('endpoint-secret-value'), false);
  assert.equal(JSON.parse(response.body).configs[0].secretConfigured, true);
});

test('admin public settings retain ENV configurations after mutations', async (t) => {
  const originalOpenAi = process.env.OPENAI_API_KEY;
  t.after(() => {
    if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenAi;
  });
  process.env.OPENAI_API_KEY = 'never-return-this-env-key';
  const payload = adminAi._test.publicAdminSettings(manager.emptySettings());
  assert.equal(payload.environmentConfigs.some((config) => config.aiConfigId === 'env-openai'), true);
  assert.equal(payload.legacyEnvironment.openai, true);
  assert.equal(JSON.stringify(payload).includes('never-return-this-env-key'), false);
});

test('admin endpoint saves OpenAI ENV as the chat route', async (t) => {
  const stores = freshStores();
  manager._test.setStoreFactory(() => stores);
  const originalOpenAi = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenAi;
  });
  process.env.OPENAI_API_KEY = 'server-only-openai-key';
  global.fetch = async () => new Response(JSON.stringify({
    id: 'admin-1', app_metadata: { roles: ['admin'], session_id: 's1' }
  }), { status: 200 });
  const response = await adminAi.handler({
    httpMethod: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
      origin: 'https://example.netlify.app',
      host: 'example.netlify.app',
      'x-forwarded-proto': 'https'
    },
    body: JSON.stringify({ action: 'set-module', module: 'chat', aiConfigId: 'env-openai' }),
    clientContext: {
      user: { id: 'admin-1', app_metadata: { roles: ['admin'], session_id: 's1' } },
      identity: { url: 'https://example.netlify.app/.netlify/identity' }
    }
  });
  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.moduleAssignments.chat, 'env-openai');
  assert.equal(payload.environmentConfigs.some((config) => config.aiConfigId === 'env-openai'), true);
  assert.equal(response.body.includes('server-only-openai-key'), false);
});

test('server-side connection tests normalize invalid keys and unavailable models', async () => {
  await assert.rejects(
    openAiAdapter.testConnection({ model: 'gpt-test', apiKey: 'bad-key' }, {
      fetchImpl: async () => new Response('{}', { status: 401 })
    }),
    (error) => error.code === 'AI_INVALID_KEY'
  );
  await assert.rejects(
    geminiAdapter.testConnection({ model: 'missing', apiKey: 'valid-looking-key' }, {
      fetchImpl: async () => new Response('{}', { status: 404 })
    }),
    (error) => error.code === 'AI_MODEL_UNAVAILABLE'
  );
});

test('connection testing does not misclassify an internal ChemDisk limit as a provider failure', () => {
  assert.equal(adminAi._test.isProviderConnectionError({ code: 'AI_RATE_LIMITED' }), true);
  assert.equal(adminAi._test.isProviderConnectionError({ code: 'AI_INVALID_KEY' }), true);
  assert.equal(adminAi._test.isProviderConnectionError({ code: 'AI_GLOBAL_DAY_LIMIT_REACHED' }), false);
  assert.equal(adminAi._test.isProviderConnectionError({ code: 'AI_LIMIT_STORAGE_UNAVAILABLE' }), false);
});

test('deleting an AI configuration removes its secret and assignments', async () => {
  const stores = freshStores();
  let settings = await manager.saveConfig(stores, { name: 'Gemini', provider: 'gemini', model: 'gemini-test' }, 'admin');
  const id = settings.configs[0].aiConfigId;
  await manager.setConfigSecret(stores, id, 'secret-for-deletion', 'admin');
  await manager.setModuleAssignment(stores, 'chat', id, 'admin');
  settings = await manager.deleteConfig(stores, id, 'admin');
  assert.equal(settings.configs.length, 0);
  assert.equal(settings.moduleAssignments.chat, null);
  assert.equal(await manager.readSecret(stores.secrets, id), '');
});

test('invalid providers and missing configurations are rejected', async () => {
  const stores = freshStores();
  await assert.rejects(
    manager.saveConfig(stores, { name: 'Unknown', provider: 'other', model: 'model' }, 'admin'),
    (error) => error.code === 'INVALID_AI_CONFIG'
  );
  await assert.rejects(
    manager.setConfigSecret(stores, 'missing', 'valid-secret-value', 'admin'),
    (error) => error.code === 'AI_CONFIG_NOT_FOUND'
  );
});
