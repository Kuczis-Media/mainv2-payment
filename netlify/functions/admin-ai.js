'use strict';

const {
  json,
  mutationGuard,
  parseJsonBody,
  requireAdmin,
  responseForFailure
} = require('../admin-common.js');
const manager = require('../ai-provider-manager.js');
const router = require('../ai-router.js');
const { normalizeError } = require('../ai-providers.js');

const MUTATING_ACTIONS = new Set([
  'save-config', 'set-secret', 'remove-secret', 'set-default',
  'set-module', 'test-connection'
]);
const PROVIDER_CONNECTION_ERRORS = new Set([
  'AI_INVALID_KEY', 'AI_MODEL_UNAVAILABLE', 'AI_RATE_LIMITED', 'AI_PROVIDER_ERROR'
]);

exports.handler = async (event = {}, context = {}) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'GET, POST, DELETE, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin' }, body: '' };
  }
  if (!['GET', 'POST', 'DELETE'].includes(method)) {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, POST, DELETE, OPTIONS' });
  }
  const auth = await requireAdmin(event, context);
  if (!auth.ok) return responseForFailure(auth);

  let body = null;
  if (method !== 'GET') {
    const guard = mutationGuard(event, { maxBodyBytes: 12_000 });
    if (!guard.ok) return responseForFailure(guard);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) return responseForFailure(parsed);
    body = parsed.value;
  }

  let stores;
  try { stores = manager.getAiStores(); } catch (error) { return errorResponse(error); }

  try {
    if (method === 'GET') {
      const view = String(event.queryStringParameters && event.queryStringParameters.view || 'settings');
      if (view === 'audit') return json({ audit: await manager.listAudit(stores.metadata, 50) });
      if (view !== 'settings') throw apiError('INVALID_VIEW', 400);
      const { settings } = await manager.readSettings(stores.metadata);
      return json({
        ...manager.publicSettings(settings),
        legacyEnvironment: {
          gemini: Boolean(process.env.GEMINI_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY)
        }
      });
    }
    if (method === 'DELETE') {
      assertOnlyFields(body, ['aiConfigId']);
      const settings = await manager.deleteConfig(stores, requiredId(body.aiConfigId), auth.userId);
      return json(manager.publicSettings(settings));
    }

    const action = typeof body.action === 'string' ? body.action : '';
    if (![...MUTATING_ACTIONS, 'list-models'].includes(action)) throw apiError('INVALID_AI_ACTION', 400);

    if (action === 'save-config') {
      assertOnlyFields(body, ['action', 'config']);
      const settings = await manager.saveConfig(stores, body.config, auth.userId);
      return json(manager.publicSettings(settings));
    }
    if (action === 'set-secret') {
      assertOnlyFields(body, ['action', 'aiConfigId', 'secret']);
      const settings = await manager.setConfigSecret(stores, requiredId(body.aiConfigId), body.secret, auth.userId);
      return json(manager.publicSettings(settings));
    }
    if (action === 'remove-secret') {
      assertOnlyFields(body, ['action', 'aiConfigId']);
      const settings = await manager.removeConfigSecret(stores, requiredId(body.aiConfigId), auth.userId);
      return json(manager.publicSettings(settings));
    }
    if (action === 'set-default') {
      assertOnlyFields(body, ['action', 'aiConfigId']);
      const settings = await manager.setDefaultConfig(stores, requiredId(body.aiConfigId), auth.userId);
      return json(manager.publicSettings(settings));
    }
    if (action === 'set-module') {
      assertOnlyFields(body, ['action', 'module', 'aiConfigId']);
      const aiConfigId = body.aiConfigId == null || body.aiConfigId === '' ? null : requiredId(body.aiConfigId);
      const settings = await manager.setModuleAssignment(stores, String(body.module || ''), aiConfigId, auth.userId);
      return json(manager.publicSettings(settings));
    }

    assertOnlyFields(body, ['action', 'aiConfigId']);
    const aiConfigId = requiredId(body.aiConfigId);
    const { settings } = await manager.readSettings(stores.metadata);
    const config = settings.configs.find((item) => item.aiConfigId === aiConfigId);
    if (!config) throw apiError('AI_CONFIG_NOT_FOUND', 404);
    if (action === 'list-models') {
      const operation = await router.runProviderOperation({
        userId: auth.userId,
        aiConfigId,
        operation: 'listModels'
      });
      return json({ models: operation.result, provider: operation.config.provider });
    }

    try {
      await router.runProviderOperation({
        userId: auth.userId,
        aiConfigId,
        operation: 'testConnection'
      });
      const next = await manager.updateConnectionStatus(stores, aiConfigId, 'ok', auth.userId);
      await manager.appendAudit(stores.metadata, { adminId: auth.userId, action: 'ai.connection.tested', aiConfigId, previousValue: config.connectionStatus, newValue: 'ok' });
      return json({ ...manager.publicSettings(next), test: { status: 'ok' } });
    } catch (error) {
      if (!PROVIDER_CONNECTION_ERRORS.has(error && error.code)) throw error;
      const normalized = normalizeError(error);
      const next = await manager.updateConnectionStatus(stores, aiConfigId, normalized.status, auth.userId);
      await manager.appendAudit(stores.metadata, { adminId: auth.userId, action: 'ai.connection.tested', aiConfigId, previousValue: config.connectionStatus, newValue: normalized.status });
      return json({ ...manager.publicSettings(next), error: normalized.code, test: normalized }, normalized.status === 'rate_limited' ? 429 : 400);
    }
  } catch (error) {
    return errorResponse(error);
  }
};

function requiredId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(id)) throw apiError('INVALID_AI_CONFIG_ID', 400);
  return id;
}

function assertOnlyFields(value, allowed) {
  const set = new Set(allowed);
  if (!value || Object.keys(value).some((key) => !set.has(key))) throw apiError('UNEXPECTED_FIELDS', 400);
}

function errorResponse(error) {
  const code = error && typeof error.code === 'string' ? error.code : 'AI_STORAGE_UNAVAILABLE';
  const status = Number.isInteger(error && error.status) ? error.status : 503;
  return json({ error: code }, status);
}

function apiError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

exports._test = {
  assertOnlyFields,
  isProviderConnectionError(error) { return PROVIDER_CONNECTION_ERRORS.has(error && error.code); },
  requiredId
};
