'use strict';

const Stripe = require('stripe');
const {
  authenticateCanonicalUser,
  headerValue,
  json,
  mutationGuard,
  parseJsonBody,
  responseForFailure,
  rolesFrom
} = require('../admin-common.js');
const {
  PLAN_BY_ID,
  getPaymentStore,
  paymentError,
  readPriceConfig,
  stripeEnvironment
} = require('../payment-common.js');

let injectedStripeFactory = null;

exports.handler = async (event = {}, context = {}) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        Allow: 'POST, OPTIONS',
        'Cache-Control': 'no-store',
        Vary: 'Origin'
      },
      body: ''
    };
  }
  if (method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'POST, OPTIONS' });
  }

  const guard = mutationGuard(event, { maxBodyBytes: 2_048 });
  if (!guard.ok) return responseForFailure(guard);
  const auth = await authenticateCanonicalUser(event, context);
  if (!auth.ok) return responseForFailure(auth);
  const parsed = parseJsonBody(event);
  if (!parsed.ok) return responseForFailure(parsed);
  const planId = validatePlanRequest(parsed.value);
  if (!planId) return json({ error: 'INVALID_PLAN' }, 400);

  const environment = stripeEnvironment();
  if (!environment.configured) return json({ error: 'STRIPE_NOT_CONFIGURED' }, 503);

  try {
    const store = getPaymentStore();
    const { config } = await readPriceConfig(store);
    const plan = PLAN_BY_ID.get(planId);
    const amount = config.prices[plan.id];
    const origin = requestOrigin(event);
    if (!origin) return json({ error: 'SAME_ORIGIN_REQUIRED' }, 403);

    const stripe = createStripe(environment.secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'pl',
      payment_method_types: ['card'],
      client_reference_id: auth.userId,
      customer_email: typeof auth.user.email === 'string' ? auth.user.email : undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'pln',
          unit_amount: amount,
          product_data: {
            name: `ChemDisk — dostęp na ${plan.label.toLocaleLowerCase('pl')}`,
            description: plan.durationLabel,
            metadata: {
              plan: plan.id,
              durationDays: String(plan.durationDays)
            }
          }
        }
      }],
      metadata: {
        schema: '1',
        userId: auth.userId,
        plan: plan.id,
        amount: String(amount),
        durationDays: String(plan.durationDays)
      },
      payment_intent_data: {
        metadata: {
          schema: '1',
          userId: auth.userId,
          plan: plan.id,
          amount: String(amount),
          durationDays: String(plan.durationDays)
        }
      },
      success_url: `${origin}/payment-success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${hasCourseAccess(auth.user) ? '/members/?checkout=cancelled' : '/login/?checkout=cancelled'}`,
      submit_type: 'pay'
    });

    if (!session || typeof session.url !== 'string' || !/^https:\/\/checkout\.stripe\.com\//.test(session.url)) {
      throw paymentError('STRIPE_RESPONSE_INVALID', 502);
    }
    return json({ url: session.url, sessionId: session.id }, 201);
  } catch (error) {
    console.error('create-checkout failed', safeStripeError(error));
    return json(
      { error: error && error.code && String(error.code).startsWith('PAYMENT_') ? error.code : 'STRIPE_CHECKOUT_FAILED' },
      error && error.status ? error.status : 502
    );
  }
};

function validatePlanRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '';
  if (Object.keys(body).some((key) => key !== 'plan')) return '';
  const plan = typeof body.plan === 'string' ? body.plan.trim() : '';
  return PLAN_BY_ID.has(plan) ? plan : '';
}

function hasCourseAccess(user) {
  const roles = rolesFrom(user);
  if (roles.includes('admin') || roles.includes('active')) return true;
  const appMetadata = user && user.app_metadata && typeof user.app_metadata === 'object'
    ? user.app_metadata
    : {};
  const timed = appMetadata.timed_access;
  return Boolean(
    timed &&
    PLAN_BY_ID.has(timed.role) &&
    roles.includes(timed.role) &&
    Number.isFinite(Date.parse(timed.expires_at || '')) &&
    Date.parse(timed.expires_at) > Date.now()
  );
}

function requestOrigin(event) {
  const raw = headerValue(event.headers || {}, 'origin');
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

function createStripe(secretKey) {
  if (injectedStripeFactory) return injectedStripeFactory(secretKey);
  return new Stripe(secretKey, {
    maxNetworkRetries: 2,
    timeout: 10_000,
    appInfo: { name: 'ChemDisk', version: '1.0.0' }
  });
}

function safeStripeError(error) {
  if (!error) return 'Error';
  return String(error.type || error.code || error.name || 'Error').slice(0, 120);
}

exports._test = {
  hasCourseAccess,
  requestOrigin,
  validatePlanRequest,
  setStripeFactory(factory) {
    injectedStripeFactory = typeof factory === 'function' ? factory : null;
  }
};
