(() => {
  'use strict';

  const navbar = document.querySelector('.navbar');
  const scrollButton = document.querySelector('.scroll-up-btn');
  const menu = document.querySelector('.navbar .menu');
  const menuToggle = document.querySelector('.navbar .menu-toggle');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.getElementById('motion-toggle');
  const progress = document.querySelector('.reading-progress span');
  let userMotionOff = false;
  try { userMotionOff = sessionStorage.getItem('nextmed.motion.off') === '1'; } catch {}
  let motionEnabled = false;
  let frame = 0;
  let revealObserver;
  let parallaxNodes = [];

  const updateScrollState = () => {
    frame = 0;
    const y = window.scrollY || document.documentElement.scrollTop;
    navbar?.classList.toggle('sticky', y > 20);
    scrollButton?.classList.toggle('show', y > 500);
    if (scrollButton) scrollButton.tabIndex = y > 500 ? 0 : -1;
    const range = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${range > 0 ? Math.min(1, Math.max(0, y / range)) : 0})`;
    if (!motionEnabled) return;
    const height = window.innerHeight;
    const scale = window.innerWidth < 860 ? .35 : 1;
    // Read before writing; do not animate off-screen decorations or poll at rest.
    const positions = parallaxNodes.map((node) => ({ node, rect: node.getBoundingClientRect() }));
    positions.forEach(({ node, rect }) => {
      if (rect.bottom < -150 || rect.top > height + 150) return;
      const phase = Math.max(-1, Math.min(1, (height / 2 - rect.top - rect.height / 2) / height));
      const offset = phase * Number(node.dataset.parallax || 0) * scale;
      node.style.setProperty('--parallax-y', `${offset.toFixed(1)}px`);
    });
  };

  const scheduleScroll = () => {
    if (!frame && !document.hidden) frame = window.requestAnimationFrame(updateScrollState);
  };
  const configureMotion = () => {
    motionEnabled = !motionPreference.matches && !userMotionOff && document.documentElement.dataset.motion !== 'off';
    document.documentElement.classList.toggle('motion-enabled', motionEnabled);
    revealObserver?.disconnect();
    parallaxNodes = Array.from(document.querySelectorAll('[data-parallax]'));
    parallaxNodes.forEach((node) => node.style.removeProperty('--parallax-y'));
    const reveals = document.querySelectorAll('[data-reveal]');
    if (motionEnabled && 'IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -24px 0px', threshold: .04 });
      reveals.forEach((node) => revealObserver.observe(node));
    } else reveals.forEach((node) => node.classList.add('is-visible'));
    if (motionToggle) {
      motionToggle.hidden = motionPreference.matches || document.documentElement.dataset.motion === 'off';
      motionToggle.textContent = motionEnabled ? 'Wyłącz animacje' : 'Włącz animacje';
      motionToggle.setAttribute('aria-pressed', String(!motionEnabled));
    }
    scheduleScroll();
  };
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll, { passive: true });
  document.addEventListener('chemdisk-landing-applied', configureMotion);
  motionPreference.addEventListener?.('change', configureMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { window.cancelAnimationFrame(frame); frame = 0; }
    else scheduleScroll();
  });
  motionToggle?.addEventListener('click', () => {
    userMotionOff = !userMotionOff;
    try { sessionStorage.setItem('nextmed.motion.off', userMotionOff ? '1' : '0'); } catch {}
    configureMotion();
  });
  configureMotion();

  scrollButton?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: motionEnabled ? 'smooth' : 'auto' });
  });

  menuToggle?.addEventListener('click', () => {
    const open = menu?.classList.toggle('active') || false;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu?.classList.contains('active')) return;
    menu.classList.remove('active');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Otwórz menu');
    menuToggle?.focus();
  });

  document.querySelectorAll('.navbar .menu a').forEach((link) => {
    link.addEventListener('click', () => {
      menu?.classList.remove('active');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });
  });

  const year = document.getElementById('current-year');
  if (year) year.textContent = String(new Date().getFullYear());

  const preview = new URLSearchParams(location.search).get('landing-preview') === '1' && window.parent !== window;
  const exported = Boolean(document.querySelector('meta[name="nextmed-landing-export"]'));
  const offerButton = document.getElementById('load-offer');
  let offerLoading = false;
  offerButton?.addEventListener('click', () => {
    if (preview || exported) {
      if (preview) offerButton.textContent = 'Cennik dostępny na opublikowanej stronie';
      return;
    }
    if (offerLoading) return;
    offerLoading = true;
    offerButton.disabled = true;
    offerButton.textContent = 'Wczytuję pakiety…';
    const script = document.createElement('script');
    script.src = '/assets/payments/payments.js';
    script.async = true;
    const timeout = window.setTimeout(failed, 15000);
    function failed() {
      window.clearTimeout(timeout);
      script.remove();
      offerLoading = false;
      offerButton.disabled = false;
      offerButton.textContent = 'Spróbuj ponownie — pokaż pakiety';
    }
    script.onerror = failed;
    script.onload = () => { window.clearTimeout(timeout); };
    document.head.append(script);
  });

  const updateAuthLinks = (authenticated) => {
    const menuLink = document.getElementById('login-btn');
    const callToAction = document.getElementById('login-cta');
    if (menuLink) menuLink.textContent = authenticated ? 'Panel kursanta' : 'Zaloguj';
    if (callToAction && callToAction.dataset.landingManaged !== 'true') {
      callToAction.textContent = authenticated ? 'Przejdź do kursu' : 'Zaloguj się';
    }
  };

  const auth = window.ChemAuth;
  if (auth && auth.ready && typeof auth.ready.then === 'function') {
    auth.ready.then((state) => updateAuthLinks(Boolean(state && state.authenticated))).catch(() => {});
  }
  window.addEventListener('chem-auth-user-changed', (event) => {
    updateAuthLinks(Boolean(event.detail && event.detail.authenticated));
  });
})();
