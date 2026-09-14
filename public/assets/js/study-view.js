(function (root) {
  'use strict';
  const el = (tag, text, cls = '') => { const n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (text, fn) => { const n = el('button', text, 'quiz-player-button mini-button'); n.type = 'button'; n.addEventListener('click', fn); return n; };
  function study({ questions, getUrl, review: client, onComplete, mode: initialMode }) {
    const scheduler = root.ChemStudyScheduler, all = scheduler.cards(questions), host = el('section', null, 'quiz-deck-study study-session');
    const now = () => client.now?.() ?? Date.now();
    let mode = Object.hasOwn(scheduler.MODES, initialMode) ? initialMode : Object.keys(client.records).length ? 'due' : 'new', queue = [], current, checked, answer, correct, reviewed = 0, completionSaved = false;
    const stats = el('p', null, 'study-summary'), controls = el('div', null, 'study-modes'), stage = el('div'), status = el('p'); status.setAttribute('role', 'status');
    async function sync() {
      await client.flush();
      if (reviewed && !queue.length && !completionSaved && scheduler.stats(all, client.records, now()).new === 0) {
        completionSaved = true; try { await onComplete?.(); } catch (_) { completionSaved = false; }
      }
    }
    const save = button('Zapisz teraz', () => void sync().catch(() => {}));
    const modeSelect = el('select'); modeSelect.setAttribute('aria-label', 'Tryb nauki');
    for (const [value, label] of Object.entries(scheduler.MODES)) { const option = el('option', label); option.value = value; modeSelect.append(option); }
    modeSelect.value = mode;
    modeSelect.addEventListener('change', () => { mode = modeSelect.value; queue = scheduler.select(all, client.records, mode, now()); reviewed = 0; completionSaved = false; render(); });
    const reload = button('Odśwież kolejkę', () => { queue = scheduler.select(all, client.records, mode, now()); render(); });
    controls.append(modeSelect, reload); host.append(stats, controls, stage, status, save);
    client.onStatus((s) => {
      status.textContent = s.error || (!s.enabled ? 'Administrator wyłączył zapis postępu. Nauka działa tylko w tej sesji.' : s.pending ? `Oczekuje na zapis: ${s.pending} ocen.` : 'Postęp zapisany na Twoim koncie.');
      save.textContent = s.error ? 'Ponów zapis' : 'Zapisz teraz'; save.disabled = !s.pending;
    });
    function updateStats() { const s = scheduler.stats(all, client.records, now()); stats.textContent = `${s.due} do powtórzenia · ${s.new} nowych · ${s.hard} trudnych · ${s.failed} błędnych. Poprawne: ${s.correct}/${s.attempts}.`; }
    function render() {
      root.MathJax?.typesetClear?.([stage]); stage.replaceChildren(); updateStats();
      current = queue[0]; checked = false; answer = null; correct = null;
      if (!current) {
        const dueAgain = all.filter((q) => client.records[q.studyKey]?.lastGrade === 1).map((q) => Date.parse(client.records[q.studyKey].dueAt)).filter((v) => v > now()).sort((a,b) => a-b)[0];
        stage.append(el('h3', reviewed ? 'Sesja zakończona' : 'Brak kart w tym trybie'), el('p', dueAgain ? `Najbliższy powrót zapomnianej karty: ${new Date(dueAgain).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}. Odśwież kolejkę, gdy nadejdzie jej termin.` : 'Wybierz inny tryb lub wróć później.'));
        if (reviewed) void sync().catch(() => {});
        return;
      }
      const ratings = el('div', null, 'quiz-flashcard-ratings'); ratings.hidden = true;
      const flash = ['flashcard', 'image_occlusion'].includes(current.type);
      const card = current.type === 'image_occlusion' ? root.ChemQuizOcclusion.card(current, getUrl)
        : flash ? root.ChemQuizFlashcards.card(current, getUrl)
          : root.ChemQuizFlashcards.practiceCard(current, getUrl, { onAnswer: (v) => { answer = v; }, onCheck: (v, result) => { answer = v; correct = result.correct; checked = true; ratings.hidden = false; } });
      card.addEventListener('flashcard-reveal', (e) => { checked = e.detail; ratings.hidden = !checked; });
      ['Nie pamiętam', 'Trudne', 'Dobre', 'Łatwe'].forEach((label, i) => {
        const rate = button(label, () => {
          if (!checked) return;
          try {
            client.rate(current, i + 1, answer, correct); reviewed++; queue.shift();
            // Again cards return as soon as their short interval has elapsed,
            // after the remaining cards rather than recursively after every click.
            const waiting = new Set(queue.map((q) => q.studyKey));
            for (const q of all) if (client.records[q.studyKey]?.lastGrade === 1 && scheduler.matches(client.records[q.studyKey], 'due', now()) && !waiting.has(q.studyKey)) { queue.push(q); waiting.add(q.studyKey); }
            render(); stage.querySelector('button, textarea, input')?.focus({ preventScroll: true });
          } catch (e) { status.textContent = e.message; }
        }); rate.dataset.studyGrade = String(i + 1); ratings.append(rate);
      });
      const skip = button('Pomiń na teraz', () => { queue.shift(); render(); });
      stage.append(el('p', `Pozostało: ${queue.length} · oceniono: ${reviewed}`, 'quiz-deck-position'), card, ratings, skip);
    }
    queue = scheduler.select(all, client.records, mode, now()); render(); return host;
  }
  root.ChemStudyView = Object.freeze({ study });
})(window);
