(function exposeAssessmentText(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemAssessmentText = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAssessmentText(root) {
  'use strict';
  const FONTS = Object.freeze({ sans: 'Inter, system-ui, sans-serif', serif: 'Georgia, serif', mono: 'ui-monospace, monospace', arial: 'Arial, sans-serif' });
  const SIZES = Object.freeze({ small: '0.95rem', normal: '1.1rem', large: '1.35rem', xlarge: '1.65rem' });
  const COMMANDS = new Set('ce frac dfrac tfrac sqrt sum prod int iint oint left right text textrm textbf mathrm mathbf mathit mathbb mathcal operatorname pm mp cdot times div le leq ge geq ne neq approx equiv sim infty Delta delta alpha beta gamma pi theta Omega omega lambda mu nu sigma tau phi sin cos tan log ln lim to rightarrow leftarrow leftrightarrow rightleftharpoons overset underset overline underline vec hat bar begin end in notin subset cup cap quad qquad degree'.split(' '));
  const escape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function normalizeFormat(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      color: typeof source.color === 'string' && /^#[0-9a-f]{6}$/i.test(source.color) ? source.color.toLowerCase() : '',
      align: ['left', 'center', 'right', 'justify'].includes(source.align) ? source.align : 'left',
      font: Object.hasOwn(FONTS, source.font) ? source.font : 'sans',
      size: Object.hasOwn(SIZES, source.size) ? source.size : 'normal',
      bold: source.bold === true
    };
  }

  function inline(text) {
    return escape(text)
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/__([^_\n]+)__/g, '<u>$1</u>')
      .replace(/\^([^^\n]{1,100})\^/g, '<sup>$1</sup>')
      .replace(/~([^~\n]{1,100})~/g, '<sub>$1</sub>')
      .replace(/\n/g, '<br>');
  }

  function safeFormula(value) {
    return typeof value === 'string' && value.length <= 4000
      && [...value.matchAll(/\\([A-Za-z]+)/g)].every((match) => COMMANDS.has(match[1]));
  }

  function html(value) {
    const text = String(value ?? '').replace(/\0/g, '').slice(0, 20_000);
    const math = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
    let output = '', offset = 0;
    for (const match of text.matchAll(math)) {
      output += inline(text.slice(offset, match.index));
      const expression = match[1] ?? match[2] ?? match[3];
      const display = match[1] === undefined;
      output += safeFormula(expression)
        ? `<span class="assessment-math${display ? ' is-display' : ''}" data-assessment-math>${escape(display ? `\\[${expression}\\]` : `\\(${expression}\\)`)}</span>`
        : escape(match[0]);
      offset = match.index + match[0].length;
    }
    return output + inline(text.slice(offset));
  }

  let mathPromise = null;
  let typesetQueue = Promise.resolve();
  function loadMath() {
    if (root.MathJax?.typesetPromise) return Promise.resolve(root.MathJax);
    if (mathPromise) return mathPromise;
    mathPromise = new Promise((resolve, reject) => {
      const document = root.document;
      let script = null;
      const cleanup = () => {
        root.clearTimeout(timeout);
        document.removeEventListener('chemdisk-mathjax-ready', ready);
        root.removeEventListener('chem-mathjax-ready', ready);
      };
      const failed = () => {
        cleanup();
        script?.remove();
        reject(new Error('Math rendering unavailable'));
      };
      const ready = () => {
        if (!root.MathJax?.typesetPromise) return;
        cleanup();
        resolve(root.MathJax);
      };
      const timeout = root.setTimeout(failed, 15_000);
      document.addEventListener('chemdisk-mathjax-ready', ready);
      root.addEventListener('chem-mathjax-ready', ready);
      if (!document.querySelector('script[src*="mathjax"]')) {
        root.MathJax = { loader: { load: ['[tex]/mhchem'] }, tex: { packages: { '[+]': ['mhchem'] } }, startup: { typeset: false }, options: { renderActions: { addMenu: [] } } };
        script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js';
        script.onload = () => Promise.resolve(root.MathJax?.startup?.promise).then(ready, failed);
        script.onerror = failed;
        document.head.append(script);
      }
    }).catch((error) => { mathPromise = null; throw error; });
    return mathPromise;
  }

  function render(target, value, format) {
    const style = normalizeFormat(format);
    try { root.MathJax?.typesetClear?.([target]); } catch { /* Math must not interrupt a question. */ }
    target.classList.add('assessment-rich-text');
    target.style.color = style.color;
    target.style.textAlign = style.align;
    target.style.fontFamily = FONTS[style.font];
    target.style.fontSize = SIZES[style.size];
    target.style.fontWeight = style.bold ? '700' : '400';
    target.innerHTML = html(value);
    const formulas = [...target.querySelectorAll('[data-assessment-math]')];
    if (!formulas.length) return;
    const loading = Promise.resolve().then(() => target.isConnected ? loadMath() : null);
    typesetQueue = Promise.all([typesetQueue.catch(() => {}), loading]).then(async ([, math]) => {
      if (!math || !target.isConnected) return;
      const current = formulas.filter((node) => node.isConnected);
      if (current.length) await math.typesetPromise(current);
    }).catch(() => { /* Raw, readable formula stays visible; never block an exam. */ });
  }

  return Object.freeze({ FONTS, SIZES, normalizeFormat, html, render, safeFormula });
});
