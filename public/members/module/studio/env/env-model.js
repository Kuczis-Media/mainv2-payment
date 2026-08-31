(function exposeEnvModel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemEnvModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createEnvModel() {
  'use strict';

  const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const MAX_ENTRIES = 100;
  const MAX_SOURCE_LENGTH = 256 * 1024;
  const PRESETS = Object.freeze([
    preset('NETLIFY_API_TOKEN', 'Netlify', 'Token Netlify do Blobs i narzędzi administratora.', true),
    preset('SITE_ID', 'Netlify', 'UUID witryny; na deployu Netlify ustawia go automatycznie.', false),
    preset('GITHUB_CONTENT_TOKEN', 'Materiały GitHub', 'Fine-grained PAT do prywatnego repo materiałów.', true),
    preset('GITHUB_CONTENT_REPOSITORIES', 'Materiały GitHub', 'Opcjonalna lista wielu repozytoriów w JSON.', false),
    preset('GITHUB_CONTENT_REPOSITORY', 'Materiały GitHub', 'Pojedyncze repo w formacie właściciel/nazwa.', false, 'Kuczis-Media/chemdisk-content'),
    preset('GITHUB_CONTENT_REF', 'Materiały GitHub', 'Gałąź repozytorium materiałów.', false, 'main'),
    preset('GITHUB_CONTENT_ROOT', 'Materiały GitHub', 'Opcjonalny katalog bazowy materiałów.', false),
    preset('GITHUB_SITE_ASSETS_TOKEN', 'Logo i landing', 'Fine-grained PAT tylko do publicznego Kuczis-Media/logo.', true),
    preset('GITHUB_SITE_ASSETS_DIRECTORY', 'Logo i landing', 'Opcjonalny katalog na nowe logo i obrazy.', false),
    preset('GEMINI_API_KEY', 'AI', 'Opcjonalny klucz awaryjny Google Gemini.', true),
    preset('GEMINI_MODEL', 'AI', 'Model awaryjny Gemini.', false, 'gemini-2.5-flash'),
    preset('OPENAI_API_KEY', 'AI', 'Opcjonalny klucz awaryjny OpenAI.', true),
    preset('OPENAI_MODEL', 'AI', 'Model awaryjny OpenAI.', false, 'gpt-4.1-mini'),
    preset('STRIPE_SECRET_KEY', 'Płatności', 'Sekretny klucz Stripe test albo live.', true),
    preset('STRIPE_WEBHOOK_SECRET', 'Płatności', 'Sekret podpisu webhooka Stripe.', true)
  ]);

  function preset(name, group, description, secret, value = '') {
    return Object.freeze({ name, value, group, description, secret, preset: true });
  }

  function defaultEntries() {
    return PRESETS.map((entry) => ({ ...entry }));
  }

  function parseEnv(source) {
    const text = String(source || '');
    if (text.length > MAX_SOURCE_LENGTH) throw new Error('ENV_SOURCE_TOO_LARGE');
    const entries = [];
    const positions = new Map();
    const invalidLines = [];
    text.split(/\r?\n/).forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const assignment = trimmed.replace(/^export\s+/, '');
      const separator = assignment.indexOf('=');
      if (separator < 1) {
        invalidLines.push(index + 1);
        return;
      }
      const name = assignment.slice(0, separator).trim();
      if (!NAME_PATTERN.test(name)) {
        invalidLines.push(index + 1);
        return;
      }
      const entry = {
        name,
        value: parseValue(assignment.slice(separator + 1).trim()),
        group: 'Zaimportowane',
        description: 'Zmienna zaimportowana lokalnie z pliku.',
        secret: looksSecret(name),
        preset: false
      };
      if (positions.has(name)) entries[positions.get(name)] = entry;
      else {
        positions.set(name, entries.length);
        entries.push(entry);
      }
    });
    if (entries.length > MAX_ENTRIES) throw new Error('ENV_TOO_MANY_ENTRIES');
    return { entries, invalidLines };
  }

  function parseValue(value) {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      try { return JSON.parse(value); } catch { return value.slice(1, -1); }
    }
    if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
    return value;
  }

  function serializeEnv(entries, options = {}) {
    const includeEmpty = options.includeEmpty !== false;
    const seen = new Set();
    const lines = [];
    for (const raw of Array.isArray(entries) ? entries : []) {
      const name = String(raw?.name || '').trim();
      const value = String(raw?.value || '');
      if (!NAME_PATTERN.test(name) || seen.has(name) || (!includeEmpty && !value)) continue;
      seen.add(name);
      lines.push(`${name}=${formatValue(value)}`);
      if (lines.length >= MAX_ENTRIES) break;
    }
    return `${lines.join('\n')}${lines.length ? '\n' : ''}`;
  }

  function formatValue(value) {
    if (!value) return '';
    if (/^[A-Za-z0-9_./:@%+,\-]+$/.test(value)) return value;
    return JSON.stringify(value);
  }

  function looksSecret(name) {
    return /(?:TOKEN|KEY|SECRET|PASSWORD|PRIVATE|PAT)(?:_|$)/i.test(String(name || ''));
  }

  return { PRESETS, NAME_PATTERN, MAX_ENTRIES, MAX_SOURCE_LENGTH, defaultEntries, parseEnv, serializeEnv, looksSecret };
});
