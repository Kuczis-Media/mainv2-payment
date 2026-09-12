(function (root) {
  'use strict';
  const ID = /^[A-Za-z0-9_-]{10,200}$/;
  const UUID = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
  const bound = new WeakSet();
  const clamp = (value, min, max, fallback) => value != null && Number.isFinite(Number(value)) && String(value).trim() ? Math.round(Math.max(min, Math.min(max, Number(value)))) : fallback;
  const dimensions = (value = {}) => ({ width: clamp(value.width, 20, 100, 100), height: clamp(value.height, 160, 1200, 480) });

  // Only known Google preview endpoints, never arbitrary HTML or iframe code.
  function resolve(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2000 || /[\s\\<>"'`]/.test(raw)) return null;
    let url;
    try { url = new URL(ID.test(raw) ? `https://drive.google.com/file/d/${raw}/view` : raw); } catch (_) { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname;
    if (['notebook.google.com', 'notebooklm.google.com'].includes(host)) {
      if (!new RegExp(`^/notebook/${UUID}(?:/artifact/${UUID})?/?$`, 'i').test(url.pathname)) return null;
      return { kind: 'notebook', href: `${url.origin}${url.pathname}`, embedUrl: '' };
    }
    if (!['drive.google.com', 'docs.google.com'].includes(host)) return null;
    let id, embedUrl, href;
    const file = url.pathname.match(/^\/file(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|preview|edit))?\/?$/);
    const folder = host === 'drive.google.com' && url.pathname.match(/^\/drive(?:\/u\/\d+)?\/folders\/([A-Za-z0-9_-]+)\/?$/);
    const doc = host === 'docs.google.com' && url.pathname.match(/^\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/(e\/)?([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview|embed|pub|pubhtml))?\/?$/);
    if (file || (host === 'drive.google.com' && /^\/(?:open|uc)\/?$/.test(url.pathname))) {
      id = file ? file[1] : url.searchParams.get('id');
      embedUrl = `https://drive.google.com/file/d/${id}/preview`;
      href = `https://drive.google.com/file/d/${id}/view`;
    } else if (folder) {
      id = folder[1]; embedUrl = `https://drive.google.com/embeddedfolderview?id=${id}#grid`;
      href = `https://drive.google.com/drive/folders/${id}`;
    } else if (doc) {
      id = doc[3];
      const base = `https://docs.google.com/${doc[1]}/d/${doc[2] || ''}${id}`;
      const view = doc[1] === 'presentation' ? 'embed' : doc[2] ? (doc[1] === 'spreadsheets' ? 'pubhtml' : 'pub') : 'preview';
      embedUrl = `${base}/${view}`;
      href = doc[2] ? embedUrl : `${base}/view`;
    } else return null;
    if (!ID.test(id || '')) return null;
    // Shared Drive links can need the resource key; never forward tracking/auth parameters.
    const key = url.searchParams.get('resourcekey');
    if (key && /^[A-Za-z0-9_-]{1,200}$/.test(key)) {
      const frame = new URL(embedUrl), outside = new URL(href);
      frame.searchParams.set('resourcekey', key); outside.searchParams.set('resourcekey', key);
      embedUrl = frame.href; href = outside.href;
    }
    return { kind: folder ? 'folder' : 'drive', href, embedUrl };
  }

  const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function html(value = {}) {
    const media = resolve(value.url || value.id);
    if (!media) return '<p class="google-media-error" role="status">Wklej prawidłowy link do pliku Google Drive lub notatnika Google.</p>';
    const size = dimensions(value), title = escape(String(value.title || 'Materiał Google').slice(0, 180));
    const note = media.kind === 'notebook'
      ? 'Google nie pozwala osadzić tego notatnika. Otwórz materiał w nowej karcie. Audio możesz pobrać z notatnika i udostępnić jako plik na Dysku Google.'
      : 'Podgląd wczyta się po kliknięciu. Jeśli Google nie obsługuje formatu lub wymaga logowania, otwórz plik w nowej karcie.';
    return `<section class="google-media" data-google-media style="--google-media-width:${size.width}%;--google-media-height:${size.height}px">
      <header class="google-media-heading"><span aria-hidden="true">▱</span><strong>${title}</strong></header>
      <p class="google-media-note">${note}</p>
      <div class="google-media-actions">
        ${media.embedUrl ? `<button type="button" data-google-load data-google-url="${escape(media.href)}" aria-expanded="false">Pokaż materiał</button>` : ''}
        <a href="${escape(media.href)}" target="_blank" rel="noopener noreferrer" data-google-outside>Otwórz w Google ↗</a>
        ${media.embedUrl ? '<button type="button" data-google-size="-120" hidden aria-label="Zmniejsz wysokość podglądu">−</button><button type="button" data-google-size="120" hidden aria-label="Zwiększ wysokość podglądu">+</button><button type="button" data-google-fullscreen hidden>Pełny ekran</button>' : ''}
      </div>
      <div class="google-media-viewport" hidden></div><span class="google-media-status" role="status"></span>
    </section>`;
  }

  function mount(host, value) {
    const template = host.ownerDocument.createElement('template');
    template.innerHTML = html(value);
    host.replaceChildren(template.content.cloneNode(true));
    bind(host.ownerDocument);
  }

  function bind(doc) {
    if (!doc || bound.has(doc)) return;
    bound.add(doc);
    doc.addEventListener('click', async (event) => {
      const button = event.target.closest?.('[data-google-load], [data-google-size], [data-google-fullscreen]');
      const card = button?.closest('[data-google-media]');
      if (!card) return;
      const viewport = card.querySelector('.google-media-viewport');
      if (button.hasAttribute('data-google-load')) {
        if (viewport.querySelector('iframe')) {
          viewport.replaceChildren(); viewport.hidden = true;
          button.textContent = 'Pokaż materiał'; button.setAttribute('aria-expanded', 'false');
          card.querySelectorAll('[data-google-size], [data-google-fullscreen]').forEach((node) => { node.hidden = true; });
          return;
        }
        const media = resolve(button.dataset.googleUrl);
        if (!media?.embedUrl) return;
        const frame = doc.createElement('iframe');
        frame.src = media.embedUrl; frame.title = card.querySelector('strong').textContent;
        frame.loading = 'lazy'; frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.setAttribute('allow', 'fullscreen; picture-in-picture'); frame.allowFullscreen = true;
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');
        viewport.replaceChildren(frame); viewport.hidden = false;
        button.textContent = 'Zamknij podgląd'; button.setAttribute('aria-expanded', 'true');
        card.querySelectorAll('[data-google-size], [data-google-fullscreen]').forEach((node) => { node.hidden = false; });
      } else if (button.hasAttribute('data-google-size')) {
        const current = viewport.getBoundingClientRect().height || parseFloat(card.style.getPropertyValue('--google-media-height')) || 480;
        viewport.style.height = `${dimensions({ height: current + Number(button.dataset.googleSize) }).height}px`;
      } else {
        try {
          if (doc.fullscreenElement === card) await doc.exitFullscreen();
          else if (card.requestFullscreen) await card.requestFullscreen();
          else throw new Error('Unavailable');
        } catch (_) { card.querySelector('.google-media-status').textContent = 'Pełny ekran jest niedostępny. Możesz otworzyć plik w Google.'; }
      }
    });
  }
  const api = { resolve, dimensions, html, mount, bind };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) { root.NextMedGoogleMedia = api; bind(root.document); }
})(typeof window !== 'undefined' ? window : globalThis);
