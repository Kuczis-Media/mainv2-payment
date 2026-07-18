(function () {
  'use strict';

  const CONFIG_URL = '/.netlify/functions/payment-config';
  const CHECKOUT_URL = '/.netlify/functions/create-checkout';
  const VALID_PLANS = new Set(['week', 'month', 'halfyear', 'year']);
  const ERROR_MESSAGES = Object.freeze({
    AUTH_EXPIRED: 'Sesja wygasła. Zaloguj się ponownie.',
    AUTH_REQUIRED: 'Zaloguj się, aby kupić dostęp.',
    IDENTITY_ADMIN_UNAVAILABLE: 'Usługa kont jest chwilowo niedostępna.',
    INVALID_PLAN: 'Wybrany pakiet jest nieprawidłowy.',
    PAYMENT_CONFIG_INVALID: 'Konfiguracja cen jest nieprawidłowa.',
    PAYMENT_STORAGE_UNAVAILABLE: 'Magazyn płatności jest chwilowo niedostępny.',
    SAME_ORIGIN_REQUIRED: 'Odśwież stronę i spróbuj ponownie.',
    SESSION_REPLACED: 'To konto zalogowało się na innym urządzeniu.',
    STRIPE_CHECKOUT_FAILED: 'Stripe nie utworzył płatności. Spróbuj ponownie.',
    STRIPE_NOT_CONFIGURED: 'Płatności nie zostały jeszcze skonfigurowane przez administratora.'
  });

  let configPromise = null;
  let checkoutInFlight = false;

  function loadConfig(force) {
    if (!configPromise || force) {
      configPromise = fetch(CONFIG_URL, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      }).then(async (response) => {
        let payload = null;
        try { payload = await response.json(); } catch (_) {}
        if (!response.ok || !payload || !Array.isArray(payload.plans)) {
          throw new Error('Nie udało się wczytać aktualnych cen.');
        }
        return payload;
      }).catch((error) => {
        configPromise = null;
        throw error;
      });
    }
    return configPromise;
  }

  function formatMoney(amount, currency) {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: String(currency || 'pln').toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(Number(amount || 0) / 100);
  }

  function selectedPlanFromAddress() {
    try {
      const plan = new URLSearchParams(location.search || '').get('plan') || '';
      return VALID_PLANS.has(plan) ? plan : '';
    } catch {
      return '';
    }
  }

  function renderContainer(container, config) {
    const mode = container.dataset.pricingMode || 'public';
    const compact = container.hasAttribute('data-pricing-compact');
    const selectedPlan = selectedPlanFromAddress();
    const fragment = document.createDocumentFragment();
    const grid = document.createElement('div');
    grid.className = `chem-pricing-grid${compact ? ' is-compact' : ''}`;

    config.plans.forEach((plan) => {
      if (!plan || !VALID_PLANS.has(plan.id)) return;
      const card = document.createElement('article');
      card.className = `chem-price-card${plan.featured ? ' is-featured' : ''}${selectedPlan === plan.id ? ' is-selected' : ''}`;
      card.dataset.plan = plan.id;

      if (plan.featured) {
        const badge = document.createElement('span');
        badge.className = 'chem-price-badge';
        badge.textContent = 'Najczęściej wybierany';
        card.append(badge);
      }

      const label = document.createElement('h3');
      label.textContent = plan.label;
      const duration = document.createElement('p');
      duration.className = 'chem-price-duration';
      duration.textContent = plan.durationLabel;
      const price = document.createElement('p');
      price.className = 'chem-price-value';
      const amount = document.createElement('strong');
      amount.textContent = formatMoney(plan.amount, config.currency);
      const suffix = document.createElement('span');
      suffix.textContent = 'jednorazowo';
      price.append(amount, suffix);
      const feature = document.createElement('p');
      feature.className = 'chem-price-feature';
      feature.textContent = 'Pełny dostęp do wszystkich materiałów';

      const button = document.createElement('button');
      button.className = 'chem-price-button';
      button.type = 'button';
      button.dataset.checkoutPlan = plan.id;
      button.textContent = config.checkoutAvailable
        ? (mode === 'public' ? 'Wybieram pakiet' : 'Kup i przedłuż dostęp')
        : 'Płatności w przygotowaniu';
      button.disabled = !config.checkoutAvailable;
      button.addEventListener('click', () => startCheckout(plan.id, button, container));

      card.append(label, duration, price, feature, button);
      grid.append(card);
    });

    const status = document.createElement('p');
    status.className = 'chem-pricing-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.dataset.pricingStatus = 'true';
    fragment.append(grid, status);

    if (config.testMode) {
      const testNote = document.createElement('p');
      testNote.className = 'chem-test-card';
      testNote.innerHTML = '<strong>Tryb testowy Stripe:</strong> karta <code>4242 4242 4242 4242</code>, dowolna przyszła data i dowolne 3 cyfry CVC.';
      fragment.append(testNote);
    }

    const stacking = document.createElement('p');
    stacking.className = 'chem-pricing-stacking';
    stacking.textContent = 'Każdy kolejny zakup dodaje czas do obecnego terminu. Ten sam webhook nigdy nie nalicza pakietu drugi raz.';
    fragment.append(stacking);
    container.replaceChildren(fragment);

    if (selectedPlan) {
      const selected = container.querySelector(`[data-plan="${selectedPlan}"]`);
      if (selected) window.setTimeout(() => selected.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }

  function renderFailure(container, error) {
    const message = document.createElement('p');
    message.className = 'chem-pricing-load-error';
    message.textContent = error && error.message ? error.message : 'Nie udało się wczytać pakietów.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'chem-price-button';
    retry.textContent = 'Spróbuj ponownie';
    retry.addEventListener('click', () => renderAll(true));
    container.replaceChildren(message, retry);
  }

  async function renderAll(force) {
    const containers = Array.from(document.querySelectorAll('[data-pricing]'));
    if (!containers.length) return null;
    containers.forEach((container) => {
      if (!container.children.length || force) {
        container.innerHTML = '<p class="chem-pricing-loading">Wczytywanie aktualnych cen…</p>';
      }
    });
    try {
      const config = await loadConfig(force);
      containers.forEach((container) => renderContainer(container, config));
      window.dispatchEvent(new CustomEvent('chem-pricing-ready', { detail: { config } }));
      return config;
    } catch (error) {
      containers.forEach((container) => renderFailure(container, error));
      return null;
    }
  }

  async function startCheckout(plan, button, container) {
    if (!VALID_PLANS.has(plan) || checkoutInFlight) return;
    const auth = window.ChemAuth;
    const user = auth && typeof auth.getUser === 'function'
      ? auth.getUser()
      : window.netlifyIdentity && typeof window.netlifyIdentity.currentUser === 'function'
        ? window.netlifyIdentity.currentUser()
        : null;

    if (!user) {
      const target = new URL('/login/', location.origin);
      target.searchParams.set('plan', plan);
      target.searchParams.set('returnTo', '/members/');
      location.assign(`${target.pathname}${target.search}`);
      return;
    }

    const status = container && container.querySelector('[data-pricing-status]');
    const original = button ? button.textContent : '';
    checkoutInFlight = true;
    document.querySelectorAll('[data-checkout-plan]').forEach((candidate) => { candidate.disabled = true; });
    if (button) button.textContent = 'Przechodzę do Stripe…';
    if (status) {
      status.textContent = 'Tworzymy bezpieczną stronę płatności…';
      status.className = 'chem-pricing-status';
    }

    try {
      const token = auth && typeof auth.getAccessToken === 'function'
        ? await auth.getAccessToken({ forceRefresh: false })
        : await user.jwt();
      const response = await fetch(CHECKOUT_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      let payload = null;
      try { payload = await response.json(); } catch (_) {}
      if (!response.ok || !payload || typeof payload.url !== 'string') {
        const code = payload && typeof payload.error === 'string' ? payload.error : '';
        throw new Error(ERROR_MESSAGES[code] || `Nie udało się rozpocząć płatności (${response.status}).`);
      }
      location.assign(payload.url);
    } catch (error) {
      checkoutInFlight = false;
      document.querySelectorAll('[data-checkout-plan]').forEach((candidate) => { candidate.disabled = false; });
      if (button) button.textContent = original;
      if (status) {
        status.textContent = error && error.message ? error.message : 'Nie udało się rozpocząć płatności.';
        status.className = 'chem-pricing-status is-error';
      }
    }
  }

  window.ChemPayments = {
    loadConfig,
    renderAll,
    startCheckout
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderAll(false), { once: true });
  } else {
    renderAll(false);
  }
})();
