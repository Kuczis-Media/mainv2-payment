(function initializeChemModuleTheme() {
  'use strict';

  const STORAGE_KEY = 'chem.theme';
  const root = document.documentElement;

  function preferredTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function readTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return preferredTheme();
  }

  function applyTheme(theme) {
    root.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  }

  applyTheme(readTheme());

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) applyTheme(readTheme());
  });

  if (window.matchMedia) {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemTheme = () => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch (_) {}
      applyTheme(systemTheme.matches ? 'dark' : 'light');
    };
    if (typeof systemTheme.addEventListener === 'function') {
      systemTheme.addEventListener('change', handleSystemTheme);
    } else if (typeof systemTheme.addListener === 'function') {
      systemTheme.addListener(handleSystemTheme);
    }
  }
})();
