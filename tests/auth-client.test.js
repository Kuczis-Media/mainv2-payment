const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'auth.js'), 'utf8');

const loadChemAuth = (search, currentUser = null, overrides = {}) => {
  const location = {
    hash: overrides.hash || '',
    origin: 'https://chemdisk.netlify.app',
    pathname: overrides.pathname || '/login/',
    protocol: 'https:',
    search,
    replace(value) { if (typeof overrides.onReplace === 'function') overrides.onReplace(value); }
  };
  const identityListeners = {};
  const identity = {
    currentUser: () => currentUser,
    on(name, callback) { identityListeners[name] = callback; },
    init() {},
    logout: async () => { if (typeof overrides.onIdentityLogout === 'function') overrides.onIdentityLogout(); },
    refresh: async () => {}
  };
  const document = {
    title: 'Login',
    cookie: '',
    hidden: false,
    addEventListener() {},
    querySelector: () => null
  };
  const window = {
    netlifyIdentity: identity,
    addEventListener() {},
    dispatchEvent() {},
    setInterval: () => 1,
    setTimeout,
    clearTimeout
  };

  vm.runInNewContext(authSource, {
    URL,
    URLSearchParams,
    CustomEvent: class CustomEvent {
      constructor(name, options) { this.type = name; this.detail = options && options.detail; }
    },
    Date,
    AbortController,
    Object,
    Promise,
    Set,
    String,
    atob,
    document,
    fetch: overrides.fetch || (async () => { throw new Error('not used'); }),
    history: { replaceState() {} },
    localStorage: overrides.localStorage || { getItem: () => null, removeItem() {}, setItem() {} },
    location,
    window
  });

  return window.ChemAuth;
};

test('ChemAuth exposes the dashboard profile and session contract', () => {
  const auth = loadChemAuth('');

  assert.equal(typeof auth.getUser, 'function');
  assert.equal(typeof auth.getProfile, 'function');
  assert.equal(typeof auth.getAccessToken, 'function');
  assert.equal(typeof auth.updateProfile, 'function');
  assert.equal(typeof auth.logout, 'function');
  assert.equal(typeof auth.checkSession, 'function');
  assert.equal(typeof auth.getSessionStatus, 'function');
  assert.equal(typeof auth.getReturnTo, 'function');
  assert.equal(typeof auth.ready.then, 'function');
});

test('getAccessToken can force a fresh JWT for authenticated function calls', async () => {
  let forceValue = null;
  const user = {
    app_metadata: { roles: ['active'], session_id: 'session-1' },
    user_metadata: {},
    async jwt(forceRefresh) {
      forceValue = forceRefresh;
      return 'fresh-signed-token';
    }
  };
  const auth = loadChemAuth('', user);

  const token = await auth.getAccessToken({ forceRefresh: true });

  assert.equal(token, 'fresh-signed-token');
  assert.equal(forceValue, true);
});

test('getReturnTo keeps module parameters but removes Identity control data', () => {
  const auth = loadChemAuth(
    '?returnTo=%2Fmembers%2Fmodule%2Ffilm%2F&id=CH50zuS8DD0&type=1&flow=recovery&token=secret&loggedout=1'
  );

  assert.equal(auth.getReturnTo(), '/members/module/film/?id=CH50zuS8DD0&type=1');
});

test('getReturnTo rejects external and protocol-relative redirects', () => {
  const external = loadChemAuth('?returnTo=https%3A%2F%2Fevil.example%2Fsteal');
  const protocolRelative = loadChemAuth('?returnTo=%2F%2Fevil.example%2Fsteal');

  assert.equal(external.getReturnTo(), '/members/');
  assert.equal(protocolRelative.getReturnTo(), '/members/');
});

test('getReturnTo allows the local access-status page', () => {
  const auth = loadChemAuth('?returnTo=%2Ftime');

  assert.equal(auth.getReturnTo(), '/time');
});

test('getReturnTo does not copy Identity type values into a module URL', () => {
  const auth = loadChemAuth('?returnTo=%2Fmembers%2F&type=recovery&error=denied');

  assert.equal(auth.getReturnTo(), '/members/');
});

test('Identity email tokens stay in the URL fragment while redirecting to login', () => {
  let redirect = '';
  loadChemAuth('?returnTo=%2Fmembers%2F', null, {
    pathname: '/',
    hash: '#recovery_token=secret-token&type=recovery',
    onReplace(value) { redirect = value; }
  });

  const target = new URL(redirect);
  assert.equal(target.pathname, '/login/');
  assert.equal(target.searchParams.has('token'), false);
  assert.equal(target.hash, '#recovery_token=secret-token&type=recovery');
});

test('updateProfile writes normalized names and drops authorization lookalikes', async () => {
  let updatePayload = null;
  const user = {
    email: 'kursant@example.com',
    app_metadata: { roles: ['active'] },
    user_metadata: { locale: 'pl', status: 'active', roles: ['admin'] },
    async update(payload) {
      updatePayload = payload;
      this.user_metadata = payload.data;
      return this;
    }
  };
  const auth = loadChemAuth('', user);
  const profile = await auth.updateProfile({ firstName: '  Anna Maria ', lastName: ' Kowalska-Nowak ' });

  assert.equal(updatePayload.data.first_name, 'Anna Maria');
  assert.equal(updatePayload.data.last_name, 'Kowalska-Nowak');
  assert.equal(updatePayload.data.full_name, 'Anna Maria Kowalska-Nowak');
  assert.equal(updatePayload.data.locale, 'pl');
  assert.equal(Object.hasOwn(updatePayload.data, 'status'), false);
  assert.equal(Object.hasOwn(updatePayload.data, 'roles'), false);
  assert.equal(profile.firstName, 'Anna Maria');
  assert.equal(profile.lastName, 'Kowalska-Nowak');
  assert.equal(profile.fullName, 'Anna Maria Kowalska-Nowak');
  assert.equal(profile.email, 'kursant@example.com');
});

test('a canonical session mismatch invalidates only the old local device', async () => {
  const storage = new Map([
    ['chem_session_id', 'old-session'],
    ['gotrue.user', '{"token":"old"}']
  ]);
  let redirect = '';
  let identityLogoutCalls = 0;
  const user = {
    email: 'kursant@example.com',
    app_metadata: { roles: ['active'], session_id: 'old-session' },
    user_metadata: {},
    jwt: async () => 'signed-jwt'
  };
  const auth = loadChemAuth('', user, {
    pathname: '/members/module/forms/',
    onReplace(value) { redirect = value; },
    onIdentityLogout() { identityLogoutCalls += 1; },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      removeItem(key) { storage.delete(key); },
      setItem(key, value) { storage.set(key, value); }
    },
    fetch: async () => ({
      ok: true,
      async json() {
        return {
          email: user.email,
          app_metadata: { roles: ['active'], session_id: 'new-session' },
          user_metadata: {}
        };
      }
    })
  });

  const status = await auth.checkSession();

  assert.equal(status.ok, false);
  assert.equal(status.reason, 'session_mismatch');
  assert.equal(storage.has('chem_session_id'), false);
  assert.equal(storage.has('gotrue.user'), false);
  assert.equal(identityLogoutCalls, 0, 'mismatch must not revoke the new device refresh token');
  assert.match(redirect, /^\/login\/\?loggedout=1&returnTo=/);
});
