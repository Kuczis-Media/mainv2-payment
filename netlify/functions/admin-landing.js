'use strict';

const { json, mutationGuard, parseJsonBody, requireAdmin, responseForFailure } = require('../admin-common.js');
const landing = require('../landing-content.js');

exports.handler = async (event = {}, context = {}) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: { Allow: 'GET, PUT, POST, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin' }, body: '' };
  if (!['GET', 'PUT', 'POST'].includes(method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, PUT, POST, OPTIONS' });
  const auth = await requireAdmin(event, context);
  if (!auth.ok) return responseForFailure(auth);
  try {
    const store = landing.getLandingStore();
    if (method === 'GET') return json(await landing.readEditorState(store));
    const guard = mutationGuard(event, { maxBodyBytes: 40_000 });
    if (!guard.ok) return responseForFailure(guard);
    const parsed = parseJsonBody(event);
    if (!parsed.ok) return responseForFailure(parsed);
    const allowed = method === 'PUT' ? ['model'] : ['action', 'model'];
    if (Object.keys(parsed.value).some((key) => !allowed.includes(key))) return json({ error: 'UNEXPECTED_FIELDS' }, 400);
    if (method === 'PUT') return json({ draft: await landing.saveDraft(store, parsed.value.model, auth.userId) });
    if (parsed.value.action !== 'publish') return json({ error: 'INVALID_LANDING_ACTION' }, 400);
    return json({ published: await landing.publish(store, parsed.value.model, auth.userId) });
  } catch (error) {
    return json({ error: error && error.code || 'LANDING_STORAGE_UNAVAILABLE' }, Number.isInteger(error && error.status) ? error.status : 503);
  }
};
