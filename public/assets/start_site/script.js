(() => {
  'use strict';

  const navbar = document.querySelector('.navbar');
  const scrollButton = document.querySelector('.scroll-up-btn');
  const menu = document.querySelector('.navbar .menu');
  const menuToggle = document.querySelector('.navbar .max-width > .menu-btn');
  const menuIcon = menuToggle && menuToggle.querySelector('i');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateScrollState = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    navbar?.classList.toggle('sticky', y > 20);
    scrollButton?.classList.toggle('show', y > 500);
  };

  window.addEventListener('scroll', updateScrollState, { passive: true });
  updateScrollState();

  scrollButton?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  menuToggle?.addEventListener('click', () => {
    const open = menu?.classList.toggle('active') || false;
    menuIcon?.classList.toggle('active', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu?.classList.contains('active')) return;
    menu.classList.remove('active');
    menuIcon?.classList.remove('active');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Otwórz menu');
    menuToggle?.focus();
  });

  document.querySelectorAll('.navbar .menu a').forEach((link) => {
    link.addEventListener('click', () => {
      menu?.classList.remove('active');
      menuIcon?.classList.remove('active');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });
  });

  const runTyping = (selector, words) => {
    const element = document.querySelector(selector);
    if (!element || words.length === 0) return;
    if (reduceMotion) {
      element.textContent = words[0];
      return;
    }

    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const tick = () => {
      const word = words[wordIndex];
      charIndex += deleting ? -1 : 1;
      element.textContent = word.slice(0, Math.max(0, charIndex));

      let delay = deleting ? 55 : 95;
      if (!deleting && charIndex >= word.length) {
        deleting = true;
        delay = 1300;
      } else if (deleting && charIndex <= 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        delay = 250;
      }
      window.setTimeout(tick, delay);
    };

    tick();
  };

  runTyping('.typing', ['we własnym tempie', 'z materiałami w jednym miejscu', 'z pomocą asystenta AI', 'na tablicy i w testach']);
  runTyping('.typing-2', ['Najlepsi', 'Niezawodni', 'Pasjonaci', 'Egzaminatorzy', 'Nauczyciele']);

  const year = document.getElementById('current-year');
  if (year) year.textContent = String(new Date().getFullYear());

  const updateAuthLinks = (authenticated) => {
    const menuLink = document.getElementById('login-btn');
    const callToAction = document.getElementById('login-cta');
    if (menuLink) menuLink.textContent = authenticated ? 'Panel kursanta' : 'Zaloguj';
    if (callToAction) callToAction.textContent = authenticated ? 'Przejdź do kursu' : 'Zaloguj się';
  };

  const auth = window.ChemAuth;
  if (auth && auth.ready && typeof auth.ready.then === 'function') {
    auth.ready.then((state) => updateAuthLinks(Boolean(state && state.authenticated))).catch(() => {});
  }
  window.addEventListener('chem-auth-user-changed', (event) => {
    updateAuthLinks(Boolean(event.detail && event.detail.authenticated));
  });
})();
