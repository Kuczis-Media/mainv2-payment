(function exposeAssessmentEditor(root) {
  'use strict';
  const rich = root.ChemAssessmentText;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function field(label, control) {
    const node = element('label', 'exam-field');
    node.append(element('span', '', label), control);
    return node;
  }
  function select(options, value) {
    const node = element('select');
    Object.entries(options).forEach(([key, label]) => {
      const option = element('option', '', label); option.value = key; node.append(option);
    });
    node.value = value;
    return node;
  }
  function insert(input, before, after = '') {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(before + input.value.slice(start, end) + after, start, end, 'end');
    input.focus();
    if (start === end && after) input.setSelectionRange(start + before.length, start + before.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function create(value, format, onChange) {
    const box = element('div', 'assessment-editor');
    let style = rich.normalizeFormat(format);
    const text = element('textarea');
    text.value = value || ''; text.rows = 6; text.maxLength = 10_000;
    text.setAttribute('aria-label', 'Treść pytania');
    const preview = element('div', 'assessment-editor-preview');
    preview.setAttribute('aria-label', 'Podgląd treści pytania');
    let timer = 0;
    function changed() {
      onChange(text.value, { ...style });
      root.clearTimeout(timer);
      timer = root.setTimeout(() => rich.render(preview, text.value, style), 180);
    }
    text.addEventListener('input', changed);
    const toolbar = element('div', 'assessment-toolbar');
    toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', 'Formatowanie zaznaczonego tekstu');
    for (const [label, title, marker] of [['B', 'Pogrubienie', '**'], ['I', 'Kursywa', '*'], ['U', 'Podkreślenie', '__'], ['x₂', 'Indeks dolny', '~'], ['x²', 'Indeks górny', '^']]) {
      const button = element('button', '', label); button.type = 'button'; button.title = title; button.setAttribute('aria-label', title);
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => insert(text, marker, marker));
      toolbar.append(button);
    }
    const controls = element('div', 'assessment-format-controls');
    const font = select({ sans: 'Nowoczesna', serif: 'Szeryfowa', mono: 'Monospace', arial: 'Arial' }, style.font);
    const align = select({ left: 'Do lewej', center: 'Wyśrodkowanie', right: 'Do prawej', justify: 'Justowanie' }, style.align);
    const size = select({ small: 'Mały', normal: 'Normalny', large: 'Duży', xlarge: 'Bardzo duży' }, style.size);
    const color = element('input'); color.type = 'color'; color.value = style.color || '#172033';
    const bold = element('input'); bold.type = 'checkbox'; bold.checked = style.bold;
    for (const [control, key] of [[font, 'font'], [align, 'align'], [size, 'size'], [color, 'color'], [bold, 'bold']]) {
      control.addEventListener('input', () => { style[key] = control.type === 'checkbox' ? control.checked : control.value; changed(); });
    }
    const resetColor = element('button', 'button button-soft', 'Kolor domyślny'); resetColor.type = 'button';
    resetColor.addEventListener('click', () => { style.color = ''; color.value = '#172033'; changed(); });
    controls.append(field('Czcionka całego pytania', font), field('Wyrównanie', align), field('Rozmiar', size), field('Kolor tekstu', color), field('Całe pytanie pogrubione', bold), resetColor);
    box.append(element('strong', '', 'Treść pytania'), toolbar, text, controls, formulaBuilder((formula) => insert(text, `\n\\[${formula}\\]\n`)), preview);
    rich.render(preview, text.value, style);
    return box;
  }

  function formulaBuilder(onInsert) {
    const box = element('details', 'assessment-formula-builder');
    box.append(element('summary', '', '∑ Kreator równań chemicznych i matematycznych'));
    const content = element('div');
    const mode = select({ chemistry: 'Równanie chemiczne', math: 'Wzór matematyczny' }, 'chemistry');
    const chemistry = element('div', 'assessment-format-controls');
    const left = element('input'); left.value = '2 H2 + O2'; left.maxLength = 1000;
    const right = element('input'); right.value = '2 H2O'; right.maxLength = 1000;
    const arrow = select({ '->': '→ reakcja', '<=>': '⇌ równowaga', '<-': '← reakcja w lewo', '=': '= równość' }, '->');
    const above = element('input'); above.placeholder = 'np. Δ, UV, katalizator'; above.maxLength = 200;
    chemistry.append(field('Substraty', left), field('Strzałka', arrow), field('Produkty', right), field('Warunek nad strzałką', above));
    const math = element('div'); math.hidden = true;
    const expression = element('textarea'); expression.rows = 3; expression.maxLength = 3000; expression.value = 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}';
    const presets = select({ quadratic: 'Równanie kwadratowe', fraction: 'Ułamek', root: 'Pierwiastek', power: 'Potęga', sum: 'Suma' }, 'quadratic');
    const snippets = { quadratic: expression.value, fraction: '\\frac{a}{b}', root: '\\sqrt{x}', power: 'x^{2}', sum: '\\sum_{i=1}^{n} x_i' };
    presets.addEventListener('change', () => { expression.value = snippets[presets.value]; refresh(); });
    math.append(field('Gotowy przykład', presets), field('Wzór (LaTeX)', expression));
    const preview = element('div', 'assessment-editor-preview');
    const note = element('p');
    const button = element('button', 'button button-soft', 'Wstaw równanie do pytania'); button.type = 'button';
    const formula = () => mode.value === 'math' ? expression.value : `\\ce{${left.value} ${arrow.value}${above.value ? `[${above.value}]` : ''} ${right.value}}`;
    let timer = 0;
    function refresh() {
      chemistry.hidden = mode.value !== 'chemistry'; math.hidden = mode.value !== 'math';
      const value = formula();
      button.disabled = !value.trim() || !rich.safeFormula(value);
      note.textContent = button.disabled ? 'Wzór zawiera nieobsługiwaną komendę. Użyj zwykłego wzoru bez linków i kodu HTML.' : 'Indeksy: H2O, Fe^{3+}. Wzór zobaczysz także w egzaminie i raporcie. Bez AI.';
      root.clearTimeout(timer);
      timer = root.setTimeout(() => rich.render(preview, `\\[${value}\\]`), 180);
    }
    [mode, left, right, arrow, above, expression].forEach((node) => node.addEventListener('input', refresh));
    box.addEventListener('toggle', () => { if (box.open) refresh(); });
    button.addEventListener('click', () => { if (rich.safeFormula(formula())) onInsert(formula()); });
    content.append(field('Rodzaj wzoru', mode), chemistry, math, preview, note, button); box.append(content);
    return box;
  }

  root.ChemAssessmentEditor = Object.freeze({ create });
})(window);
