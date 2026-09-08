(function () {
  'use strict';
  const editorModes = new Set(['home', 'dashboard', 'lesson', 'quiz', 'exam', 'presentation', 'prompt']);
  const destinations = Object.freeze({
    landing: '/members/module/studio/landing/', assets: '/members/module/studio/landing/?assets=1',
    progress: '/members/module/studio/manage/?tab=progress', 'ai-usage': '/members/module/studio/manage/?tab=ai-usage',
    payments: '/members/module/studio/manage/?tab=payments', 'ai-settings': '/members/?admin=ai', env: '/members/module/studio/env/'
  });
  const normalize = (value) => String(value || '').toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  function initToolPicker() {
    const select = document.getElementById('studio-tool-select');
    const search = document.getElementById('studio-tool-search');
    if (!select || !search) return;
    const cards = Array.from(document.querySelectorAll('.project-choices .project-card'));
    const filters = Array.from(document.querySelectorAll('[data-tool-filter]'));
    let category = 'all';
    select.addEventListener('change', () => {
      const value = select.value;
      if (editorModes.has(value)) document.dispatchEvent(new CustomEvent('studio-select-mode', { detail: value }));
      else if (Object.hasOwn(destinations, value)) window.location.assign(destinations[value]);
    });
    function render() {
      const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
      let count = 0;
      cards.forEach((card) => {
        const matches = (category === 'all' || card.dataset.toolGroup === category)
          && terms.every((term) => normalize(card.textContent).includes(term));
        card.hidden = !matches;
        if (matches) count += 1;
      });
      filters.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.toolFilter === category)));
      document.getElementById('studio-tool-count').textContent = `Dostępne narzędzia: ${count}`;
      document.getElementById('studio-tools-empty').hidden = count > 0;
      const explorer = document.getElementById('content-explorer');
      if (explorer) explorer.hidden = category === 'management' || category === 'appearance' || terms.length > 0;
    }
    filters.forEach((button) => button.addEventListener('click', () => { category = button.dataset.toolFilter; render(); }));
    search.addEventListener('input', render);
    render();
  }
  document.addEventListener('DOMContentLoaded', initToolPicker, { once: true });
})();
