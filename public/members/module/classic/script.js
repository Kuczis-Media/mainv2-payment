(async () => {
  'use strict';

  const authState = await window.ChemAuth.ready;
  if (!authState?.authenticated || !authState.session?.ok) return;

  const display = document.getElementById('display');
  const keys = document.getElementById('keys');
  if (!display || !keys) return;

  function evaluate(expression) {
    const source = expression.replaceAll(',', '.');
    let position = 0;

    const skip = () => { while (/\s/.test(source[position] || '')) position += 1; };
    const take = (char) => {
      skip();
      if (source[position] === char) { position += 1; return true; }
      return false;
    };

    function primary() {
      skip();
      if (take('(')) {
        const value = sum();
        if (!take(')')) throw new Error('Brak nawiasu');
        return value;
      }
      const match = source.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) throw new Error('Nieprawidłowe działanie');
      position += match[0].length;
      return Number(match[0]);
    }

    function unary() {
      if (take('+')) return unary();
      if (take('-')) return -unary();
      return primary();
    }

    function product() {
      let value = unary();
      while (true) {
        if (take('*')) value *= unary();
        else if (take('/')) value /= unary();
        else if (take('%')) value %= unary();
        else return value;
      }
    }

    function sum() {
      let value = product();
      while (true) {
        if (take('+')) value += product();
        else if (take('-')) value -= product();
        else return value;
      }
    }

    const result = sum();
    skip();
    if (position !== source.length || !Number.isFinite(result)) throw new Error('Nie można obliczyć');
    return Number(result.toPrecision(12)).toString();
  }

  function append(value) {
    display.classList.remove('error');
    display.value += value;
    display.focus();
  }

  function calculate() {
    try {
      display.value = evaluate(display.value || '0').replace('.', ',');
      display.classList.remove('error');
    } catch {
      display.value = 'Błąd';
      display.classList.add('error');
      display.select();
    }
  }

  keys.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'clear') { display.value = ''; display.classList.remove('error'); display.focus(); return; }
    if (action === 'delete') { display.value = display.value.slice(0, -1); display.classList.remove('error'); display.focus(); return; }
    if (action === 'equals') { calculate(); return; }
    if (button.dataset.value) append(button.dataset.value);
  });

  display.addEventListener('input', () => {
    display.value = display.value.replace(/[^0-9+\-*/%().,\s]/g, '');
    display.classList.remove('error');
  });
  display.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); }
    if (event.key === 'Escape') { display.value = ''; display.classList.remove('error'); }
  });
})();
