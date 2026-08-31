(function initializeEnvGenerator() {
  'use strict';

  const modelApi = window.ChemEnvModel;
  const elements = {
    access: document.getElementById('access-state'), app: document.getElementById('env-app'), list: document.getElementById('env-list'),
    template: document.getElementById('env-row-template'), output: document.getElementById('env-output'), status: document.getElementById('env-status'),
    includeEmpty: document.getElementById('env-include-empty'), search: document.getElementById('env-search'), import: document.getElementById('env-import'),
    add: document.getElementById('env-add'), defaults: document.getElementById('env-defaults'), clear: document.getElementById('env-clear'),
    copy: document.getElementById('env-copy'), copyNames: document.getElementById('env-copy-names'), download: document.getElementById('env-download'),
    theme: document.getElementById('theme-toggle')
  };
  let entries = modelApi.defaultEntries();

  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });

  async function bootstrap() {
    try {
      const authState = await window.ChemAuth.ready;
      const user = window.ChemAuth.getUser?.();
      const roles = user?.app_metadata?.roles || [];
      if (!authState?.authenticated || !authState.session?.ok || !roles.includes('admin')) throw new Error('Generator .env jest dostępny tylko dla administratora.');
      bindEvents();
      elements.access.hidden = true;
      elements.app.hidden = false;
      render();
    } catch (error) {
      elements.access.querySelector('h1').textContent = 'Brak dostępu';
      elements.access.querySelector('p').textContent = error.message;
    }
  }

  function bindEvents() {
    elements.add.addEventListener('click', addEntry);
    elements.defaults.addEventListener('click', restoreDefaults);
    elements.clear.addEventListener('click', clearValues);
    elements.search.addEventListener('input', applyFilter);
    elements.includeEmpty.addEventListener('change', updateOutput);
    elements.import.addEventListener('change', importFile);
    elements.copy.addEventListener('click', () => copyText(elements.output.value, 'Skopiowano gotowy plik .env.'));
    elements.copyNames.addEventListener('click', () => copyText(entries.map((entry) => entry.name).filter((name) => modelApi.NAME_PATTERN.test(name)).join('\n'), 'Skopiowano nazwy zmiennych.'));
    elements.download.addEventListener('click', downloadEnv);
    elements.theme.addEventListener('click', () => {
      const root = document.documentElement;
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    });
  }

  function render() {
    const fragment = document.createDocumentFragment();
    entries.forEach((entry, index) => {
      const row = elements.template.content.firstElementChild.cloneNode(true);
      row.dataset.index = String(index);
      row.querySelector('.env-group').textContent = entry.group || 'Własna';
      row.querySelector('.env-label').textContent = entry.name || 'Nowa zmienna';
      row.querySelector('.env-description').textContent = entry.description || 'Własna zmienna środowiskowa.';
      const name = row.querySelector('.env-name');
      const value = row.querySelector('.env-value');
      const reveal = row.querySelector('.reveal-button');
      name.value = entry.name || '';
      value.value = entry.value || '';
      value.type = entry.secret ? 'password' : 'text';
      reveal.hidden = !entry.secret;
      name.addEventListener('input', () => {
        entry.name = name.value.trim();
        entry.secret = entry.secret || modelApi.looksSecret(entry.name);
        name.setAttribute('aria-invalid', String(Boolean(entry.name && !modelApi.NAME_PATTERN.test(entry.name))));
        row.querySelector('.env-label').textContent = entry.name || 'Nowa zmienna';
        updateOutput();
      });
      value.addEventListener('input', () => { entry.value = value.value; updateOutput(); });
      reveal.addEventListener('click', () => {
        const hidden = value.type === 'password';
        value.type = hidden ? 'text' : 'password';
        reveal.textContent = hidden ? 'Ukryj' : 'Pokaż';
      });
      row.querySelector('.remove-button').addEventListener('click', () => {
        entries.splice(index, 1);
        render();
      });
      fragment.append(row);
    });
    elements.list.replaceChildren(fragment);
    applyFilter();
    updateOutput();
  }

  function addEntry() {
    if (entries.length >= modelApi.MAX_ENTRIES) return setStatus('Limit to 100 zmiennych.', 'error');
    entries.push({ name: '', value: '', group: 'Własna', description: 'Własna zmienna środowiskowa.', secret: false, preset: false });
    render();
    const input = elements.list.querySelector('.env-row:last-child .env-name');
    input?.focus();
  }

  function restoreDefaults() {
    if (!window.confirm('Przywrócić domyślną listę? Wpisane wartości zostaną wyczyszczone.')) return;
    entries = modelApi.defaultEntries();
    render();
    setStatus('Przywrócono bezpieczny szablon projektu.', 'success');
  }

  function clearValues() {
    if (!window.confirm('Wyczyścić wszystkie wartości z tej karty?')) return;
    entries.forEach((entry) => { entry.value = ''; });
    render();
    setStatus('Wartości zostały usunięte z formularza.', 'success');
  }

  async function importFile() {
    const file = elements.import.files?.[0];
    elements.import.value = '';
    if (!file) return;
    if (file.size > modelApi.MAX_SOURCE_LENGTH) return setStatus('Plik .env przekracza 256 KB.', 'error');
    try {
      const parsed = modelApi.parseEnv(await file.text());
      const imported = new Map(parsed.entries.map((entry) => [entry.name, entry]));
      entries = entries.map((entry) => imported.has(entry.name) ? { ...entry, value: imported.get(entry.name).value } : entry);
      const known = new Set(entries.map((entry) => entry.name));
      parsed.entries.forEach((entry) => { if (!known.has(entry.name)) entries.push(entry); });
      render();
      setStatus(parsed.invalidLines.length
        ? `Zaimportowano plik; pominięto niepoprawne wiersze: ${parsed.invalidLines.join(', ')}.`
        : `Zaimportowano ${parsed.entries.length} zmiennych lokalnie.`, parsed.invalidLines.length ? 'warning' : 'success');
    } catch {
      setStatus('Nie udało się odczytać tego pliku .env.', 'error');
    }
  }

  function applyFilter() {
    const query = elements.search.value.trim().toLocaleLowerCase('pl');
    elements.list.querySelectorAll('.env-row').forEach((row) => {
      const entry = entries[Number(row.dataset.index)];
      row.hidden = Boolean(query && !`${entry?.name || ''} ${entry?.group || ''} ${entry?.description || ''}`.toLocaleLowerCase('pl').includes(query));
    });
  }

  function updateOutput() {
    elements.output.value = modelApi.serializeEnv(entries, { includeEmpty: elements.includeEmpty.checked });
    const invalid = entries.filter((entry) => entry.name && !modelApi.NAME_PATTERN.test(entry.name)).length;
    if (invalid) setStatus(`${invalid} ${invalid === 1 ? 'nazwa jest niepoprawna' : 'nazwy są niepoprawne'} i nie trafi do wyniku.`, 'error');
  }

  async function copyText(value, message) {
    if (!value) return setStatus('Nie ma jeszcze nic do skopiowania.', 'error');
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message, 'success');
    } catch {
      elements.output.focus();
      elements.output.select();
      setStatus('Przeglądarka zablokowała schowek. Zaznaczony tekst skopiuj ręcznie.', 'error');
    }
  }

  function downloadEnv() {
    const value = elements.output.value;
    if (!value) return setStatus('Nie ma jeszcze nic do pobrania.', 'error');
    const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus('Pobrano plik .env. Nie commituj go do repozytorium.', 'success');
  }

  function setStatus(message, state = '') {
    elements.status.textContent = message;
    elements.status.dataset.state = state;
  }
})();
