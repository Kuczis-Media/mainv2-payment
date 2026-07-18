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

test('default Stripe offer contains the requested PLN prices and durations', () => {
  const config = payments.defaultPriceConfig();
  assert.deepEqual(config.prices, {
    week: 3_000,
    month: 5_000,
    halfyear: 30_000,
    year: 50_000
  });
  assert.deepEqual(
    payments.PLANS.map(({ id, durationDays }) => [id, durationDays]),
    [['week', 7], ['month', 30], ['halfyear', 182], ['year', 365]]
  );
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

test('Checkout fulfillment validation binds paid session to user, plan and PLN amount', () => {
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

  for (const override of [
    { payment_status: 'unpaid' },
    { client_reference_id: ADMIN_ID },
    { currency: 'usd' },
    { metadata: { userId: USER_ID, plan: 'hour' } }
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
  assert.equal(paymentConfig._test.validateUpdate({
    expectedEtag: null,
    prices: { week: 3_000, month: 5_000, halfyear: 30_000, year: 50_000 }
  }).ok, true);
  assert.equal(paymentConfig._test.validateUpdate({
    expectedEtag: null,
    prices: { week: 0, month: 5_000, halfyear: 30_000, year: 50_000 }
  }).code, 'INVALID_PRICE');
  assert.equal(paymentAdmin._test.validateAction({ action: 'revoke', userId: USER_ID }).ok, true);
  assert.equal(paymentAdmin._test.validateAction({ action: 'refund', userId: USER_ID }).code, 'INVALID_PAYMENT_ACTION');
  assert.equal(createCheckout._test.validatePlanRequest({ plan: 'month' }), 'month');
  assert.equal(createCheckout._test.validatePlanRequest({ plan: 'hour' }), '');
});

test('payment offer is published in all requested user-facing places and admin users are collapsible', () => {
  const root = path.join(__dirname, '..');
  const home = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const login = fs.readFileSync(path.join(root, 'public', 'login', 'index.html'), 'utf8');
  const members = fs.readFileSync(path.join(root, 'public', 'members', 'index.html'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'public', 'members', 'dashboard.js'), 'utf8');

  assert.match(home, /data-pricing-mode=["']public["']/);
  assert.match(login, /id=["']inactive-account["']/);
  assert.match(login, /data-pricing-mode=["']inactive["']/);
  assert.match(members, /data-pricing-mode=["']authenticated["']/);
  assert.match(members, /data-admin-tab=["']payments["']/);
  assert.match(members, /Kup lub przedłuż[\s\S]*Status dostępu/);
  assert.match(dashboard, /document\.createElement\('details'\)/);
  assert.match(dashboard, /PAYMENT_ADMIN_URL/);
});
