'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const payments = require('../netlify/payment-common.js');
const paymentConfig = require('../netlify/functions/payment-config.js');
const paymentAdmin = require('../netlify/functions/payment-admin.js');
const createCheckout = require('../netlify/functions/create-checkout.js');

const USER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const NOW = Date.parse('2026-07-17T10:00:00.000Z');

function purchase(id, plan = 'month', amount = 5_000) {
  return {
    id,
    userId: USER_ID,
    plan,
    amount,
    paymentIntent: `pi_${id.replace(/^cs_(?:test_)?/, '')}`
  };
}

test('default Stripe offer contains every timed role and keeps the original four plans enabled', () => {
  const config = payments.defaultPriceConfig();
  assert.deepEqual(config.prices, {
    hour: 500,
    day: 1_500,
    week: 3_000,
    month: 5_000,
    halfyear: 30_000,
    year: 50_000
  });
  assert.deepEqual(
    payments.PLANS.map(({ id, durationDays }) => [id, durationDays]),
    [['hour', 1 / 24], ['day', 1], ['week', 7], ['month', 30], ['halfyear', 182], ['year', 365]]
  );
  assert.deepEqual(config.enabledPlans, ['week', 'month', 'halfyear', 'year']);
  assert.equal(config.paymentsEnabled, true);
  assert.equal(config.stackingEnabled, true);
});

test('an existing four-price configuration migrates without changing its public offer', () => {
  const normalized = payments.normalizePriceConfig({
    version: 1,
    currency: 'pln',
    prices: { week: 3_000, month: 5_000, halfyear: 30_000, year: 50_000 }
  });
  assert.equal(normalized.ok, true);
  assert.equal(normalized.value.prices.hour, 500);
  assert.equal(normalized.value.prices.day, 1_500);
  assert.deepEqual(normalized.value.enabledPlans, ['week', 'month', 'halfyear', 'year']);
  assert.equal(normalized.value.paymentsEnabled, true);
  assert.equal(normalized.value.stackingEnabled, true);
});

test('hour and day purchases grant the exact durations represented in netlify.toml roles', () => {
  const hour = payments.applyPurchase(
    payments.emptyLedger(USER_ID),
    purchase('cs_test_hourpurchase123', 'hour', 500),
    NOW
  );
  assert.equal(Date.parse(hour.ledger.access.expiresAt) - NOW, payments.HOUR_MS);

  const day = payments.applyPurchase(
    payments.emptyLedger(USER_ID),
    purchase('cs_test_daypurchase1234', 'day', 1_500),
    NOW
  );
  assert.equal(Date.parse(day.ledger.access.expiresAt) - NOW, payments.DAY_MS);
});

test('a second purchase extends the existing expiry instead of resetting it', () => {
  const first = payments.applyPurchase(
    payments.emptyLedger(USER_ID),
    purchase('cs_test_firstpayment123'),
    NOW
  );
  const second = payments.applyPurchase(
    first.ledger,
    purchase('cs_test_secondpayment12'),
    NOW + payments.DAY_MS
  );

  assert.equal(first.ledger.access.expiresAt, '2026-08-16T10:00:00.000Z');
  assert.equal(second.ledger.access.expiresAt, '2026-09-15T10:00:00.000Z');
  assert.equal(second.ledger.access.assignedAt, '2026-07-17T10:00:00.000Z');
  assert.equal(second.ledger.events.length, 2);
});

test('replaying the same Checkout Session is idempotent', () => {
  const checkout = purchase('cs_test_idempotent12345', 'week', 3_000);
  const first = payments.applyPurchase(payments.emptyLedger(USER_ID), checkout, NOW);
  const replay = payments.applyPurchase(first.ledger, checkout, NOW + 5_000);

  assert.equal(replay.changed, false);
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.ledger, first.ledger);
});

test('a new purchase after expiry starts from now while a mixed plan stacks exactly once', () => {
  const old = payments.applyPurchase(
    payments.emptyLedger(USER_ID),
    purchase('cs_test_oldweekpayment1', 'week', 3_000),
    NOW - 20 * payments.DAY_MS
  );
  const renewed = payments.applyPurchase(
    old.ledger,
    purchase('cs_test_newyearpayment1', 'year', 50_000),
    NOW
  );
  assert.equal(renewed.ledger.access.role, 'year');
  assert.equal(
    Date.parse(renewed.ledger.access.expiresAt) - NOW,
    365 * payments.DAY_MS
  );
});

test('paid time also stacks on top of a later manually granted Identity window', () => {
  const ledger = payments.emptyLedger(USER_ID);
  const manualExpiry = '2026-08-01T10:00:00.000Z';
  const merged = payments.mergeLedgerAccess(ledger, {
    role: 'week',
    assignedAt: '2026-07-10T10:00:00.000Z',
    expiresAt: manualExpiry
  });
  const paid = payments.applyPurchase(
    merged,
    purchase('cs_test_manualstack1234', 'month', 5_000),
    NOW
  );

  assert.equal(paid.ledger.access.assignedAt, '2026-07-10T10:00:00.000Z');
  assert.equal(
    Date.parse(paid.ledger.access.expiresAt) - Date.parse(manualExpiry),
    30 * payments.DAY_MS
  );
});

test('administrator revocation expires access and records an audit event', () => {
  const paid = payments.applyPurchase(
    payments.emptyLedger(USER_ID),
    purchase('cs_test_revokeexample12'),
    NOW
  );
  const revoked = payments.applyRevocation(paid.ledger, {
    userId: USER_ID,
    actorId: ADMIN_ID,
    reason: 'test'
  }, NOW + payments.DAY_MS);

  assert.equal(revoked.ledger.access.expiresAt, '2026-07-18T10:00:00.000Z');
  assert.equal(revoked.ledger.events.at(-1).type, 'revocation');
  assert.equal(payments.publicAccess(revoked.ledger, NOW + 2 * payments.DAY_MS).active, false);
});

test('Checkout fulfillment validation binds paid session to user, plan, amount and supported currency', () => {
  const valid = payments.validateCheckoutSession({
    id: 'cs_test_checkoutvalid123',
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: USER_ID,
    currency: 'pln',
    amount_total: 5_000,
    created: NOW / 1000,
    payment_intent: 'pi_checkoutvalid123',
    metadata: { userId: USER_ID, plan: 'month', amount: '5000', durationDays: '30' }
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.userId, USER_ID);
  assert.equal(valid.value.currency, 'pln');

  const euro = payments.validateCheckoutSession({
    id: 'cs_test_checkouteuro1234',
    mode: 'payment',
    payment_status: 'paid',
    client_reference_id: USER_ID,
    currency: 'eur',
    amount_total: 5_000,
    metadata: { userId: USER_ID, plan: 'month', amount: '5000', durationDays: '30' }
  });
  assert.equal(euro.ok, true);
  assert.equal(euro.value.currency, 'eur');

  for (const override of [
    { payment_status: 'unpaid' },
    { client_reference_id: ADMIN_ID },
    { currency: 'nzd' },
    { metadata: { userId: USER_ID, plan: 'minute' } }
  ]) {
    const invalid = payments.validateCheckoutSession({
      id: 'cs_test_checkoutvalid123',
      mode: 'payment',
      payment_status: 'paid',
      client_reference_id: USER_ID,
      currency: 'pln',
      amount_total: 5_000,
      metadata: { userId: USER_ID, plan: 'month', amount: '5000', durationDays: '30' },
      ...override
    });
    assert.equal(invalid.ok, false);
  }
});

test('price and admin action inputs are strictly validated', () => {
  const validPrices = {
    hour: 500,
    day: 1_500,
    week: 3_000,
    month: 5_000,
    halfyear: 30_000,
    year: 50_000
  };
  assert.equal(paymentConfig._test.validateUpdate({
    currency: 'eur',
    enabledPlans: ['day', 'month'],
    expectedEtag: null,
    paymentsEnabled: false,
    prices: validPrices,
    stackingEnabled: false
  }).ok, true);
  assert.equal(paymentConfig._test.validateUpdate({
    currency: 'pln',
    enabledPlans: ['week'],
    expectedEtag: null,
    paymentsEnabled: true,
    prices: { ...validPrices, week: 0 },
    stackingEnabled: true
  }).code, 'INVALID_PRICE');
  assert.equal(paymentConfig._test.validateUpdate({
    currency: 'nzd',
    enabledPlans: [],
    expectedEtag: null,
    paymentsEnabled: true,
    prices: validPrices,
    stackingEnabled: true
  }).code, 'INVALID_CURRENCY');
  assert.equal(paymentAdmin._test.validateAction({ action: 'revoke', userId: USER_ID }).ok, true);
  assert.equal(paymentAdmin._test.validateAction({ action: 'refund', userId: USER_ID }).code, 'INVALID_PAYMENT_ACTION');
  assert.equal(createCheckout._test.validatePlanRequest({ plan: 'month' }), 'month');
  assert.equal(createCheckout._test.validatePlanRequest({ plan: 'hour' }), 'hour');
  assert.equal(createCheckout._test.hasTimedOrPermanentAccess({
    app_metadata: { roles: ['month'], timed_access: { role: 'month', expires_at: '2099-01-01T00:00:00.000Z' } }
  }), true);
  assert.equal(createCheckout._test.hasTimedOrPermanentAccess({
    app_metadata: { roles: ['month'], timed_access: { role: 'month', expires_at: '2020-01-01T00:00:00.000Z' } }
  }), false);
  assert.equal(paymentConfig._test.validateUpdate({
    currency: 'pln',
    enabledPlans: ['month'],
    expectedEtag: null,
    paymentsEnabled: 'yes',
    prices: validPrices,
    stackingEnabled: true
  }).code, 'INVALID_PAYMENT_ENABLED_SETTING');
});

test('payment offer has a separate purchase page and admin users remain collapsible', () => {
  const root = path.join(__dirname, '..');
  const home = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const login = fs.readFileSync(path.join(root, 'public', 'login', 'index.html'), 'utf8');
  const members = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const purchasePage = fs.readFileSync(path.join(root, 'public', 'purchase', 'index.html'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');

  assert.match(home, /data-pricing-mode=["']public["']/);
  assert.match(login, /id=["']inactive-account["']/);
  assert.match(login, /data-pricing-mode=["']inactive["']/);
  assert.doesNotMatch(members, /data-pricing-mode=["']authenticated["']/);
  assert.match(members, /href=["']\/purchase\/["'][\s\S]*Kup lub przedłuż/);
  assert.match(purchasePage, /data-pricing-mode=["']authenticated["']/);
  assert.match(members, /id=["']admin-payment-disabled["']/);
  assert.match(members, /data-admin-tab=["']payments["']/);
  assert.match(members, /Kup lub przedłuż[\s\S]*Status dostępu/);
  assert.match(dashboard, /document\.createElement\('details'\)/);
  assert.match(dashboard, /PAYMENT_ADMIN_URL/);
});
