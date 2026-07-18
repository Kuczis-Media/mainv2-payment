'use strict';

const {
  json,
  mutationGuard,
  parseJsonBody,
  requireAdmin,
  responseForFailure
} = require('../admin-common.js');
const {
  defaultPriceConfig,
  getPaymentStore,
  paymentStoreConfig,
  publicPriceConfig,
  readPriceConfig,
  stripeEnvironment,
  writePriceConfig
} = require('../payment-common.js');

exports.handler = async (event = {}, context = {}) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        Allow: 'GET, PUT, OPTIONS',
        'Cache-Control': 'no-store',
        Vary: 'Origin'
      },
      body: ''
    };
  }
  if (!['GET', 'PUT'].includes(method)) {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, PUT, OPTIONS' });
  }

  const adminView = method === 'PUT' ||
    String(event.queryStringParameters && event.queryStringParameters.admin || '') === '1';
  let auth = null;
  if (adminView) {
    auth = await requireAdmin(event, context);
    if (!auth.ok) return responseForFailure(auth);
  }

  if (method === 'PUT') {
    const guard = mutationGuard(event, { maxBodyBytes: 8_192 });
    if (!guard.ok) return responseForFailure(guard);
  }

  const environment = stripeEnvironment();
  let store;
  try {
    store = getPaymentStore();
  } catch (error) {
    if (method === 'GET' && !adminView) {
      return json(publicPriceConfig(defaultPriceConfig(), {
        checkoutAvailable: false,
        testMode: environment.testMode
      }));
    }
    return json({ error: error.code || 'PAYMENT_STORAGE_UNAVAILABLE' }, error.status || 503);
  }

  try {
    if (method === 'GET') {
      const current = await readPriceConfig(store);
      return json({
        ...publicPriceConfig(current.config, {
          checkoutAvailable: environment.configured,
          testMode: environment.testMode
        }),
        ...(adminView ? { etag: current.etag, source: current.source } : {})
      });
    }

    const parsed = parseJsonBody(event);
    if (!parsed.ok) return responseForFailure(parsed);
    const validation = validateUpdate(parsed.value);
    if (!validation.ok) return json({ error: validation.code }, validation.status || 400);
    const saved = await writePriceConfig(
      store,
      validation.value.prices,
      validation.value.expectedEtag,
      auth.userId
    );
    return json({
      ...publicPriceConfig(saved.config, {
        checkoutAvailable: environment.configured,
        testMode: environment.testMode
      }),
      etag: saved.etag,
      source: saved.source
    });
  } catch (error) {
    console.error('payment-config failed', safeErrorName(error));
    const code = error && error.code ? error.code : 'PAYMENT_STORAGE_UNAVAILABLE';
    return json({ error: code }, error && error.status ? error.status : 503);
  }
};

function validateUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'INVALID_BODY' };
  }
  if (Object.keys(body).some((key) => !['prices', 'expectedEtag'].includes(key))) {
    return { ok: false, code: 'UNEXPECTED_FIELDS' };
  }
  if (!body.prices || typeof body.prices !== 'object' || Array.isArray(body.prices)) {
    return { ok: false, code: 'INVALID_PRICE' };
  }
  const allowedPlans = new Set(['week', 'month', 'halfyear', 'year']);
  if (
    Object.keys(body.prices).length !== allowedPlans.size ||
    Object.keys(body.prices).some((key) => !allowedPlans.has(key))
  ) {
    return { ok: false, code: 'INVALID_PRICE' };
  }
  const prices = {};
  for (const id of allowedPlans) {
    const amount = body.prices[id];
    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 1_000_000) {
      return { ok: false, code: 'INVALID_PRICE' };
    }
    prices[id] = amount;
  }
  const expectedEtag = body.expectedEtag;
  if (expectedEtag !== null && (
    typeof expectedEtag !== 'string' ||
    !expectedEtag ||
    expectedEtag.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(expectedEtag)
  )) {
    return { ok: false, code: 'INVALID_ETAG' };
  }
  return { ok: true, value: { prices, expectedEtag } };
}

function safeErrorName(error) {
  return error && error.name ? String(error.name) : 'Error';
}

exports._test = {
  validateUpdate,
  paymentStoreConfig
};
