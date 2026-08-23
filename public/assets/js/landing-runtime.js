(function applyPublishedLanding() {
  'use strict';

  const COPY_TARGETS = {
    home: { title: '.text-2', subtitle: '.text-1', body: '.text-3', image: null, cta: '#login-cta' },
    about: { title: '.title', subtitle: '.column.right .text', body: '.column.right p', image: '.column.left img', cta: '.column.right a' },
    services: { title: '.title' },
    pricing: { title: '.title', body: '.pricing-intro' },
    skills: { title: '.title', subtitle: '.column.left .text', body: '.column.left p', cta: '.column.left a' },
    contact: { title: '.title', subtitle: '.column.left .text', body: '.column.left > p' }
  };

  fetch('/.netlify/functions/landing', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      if (!payload?.active || !Array.isArray(payload.model?.sections)) return;
      const footer = document.querySelector('footer');
      payload.model.sections.forEach((config) => {
        const section = document.getElementById(config.id);
        if (!section) return;
        section.hidden = config.enabled === false;
        section.dataset.landingManaged = 'true';
        if (config.backgroundColor) section.style.backgroundColor = config.backgroundColor;
        if (config.textColor) section.style.color = config.textColor;
        if (config.accentColor) section.style.setProperty('--landing-accent', config.accentColor);
        if (config.id === 'home' && config.imageUrl) {
          section.style.backgroundImage = `linear-gradient(rgba(0,0,0,.46), rgba(0,0,0,.46)), url("${config.imageUrl.replace(/["\\]/g, '')}")`;
        }
        const targets = COPY_TARGETS[config.id] || {};
        setText(section, targets.title, config.title);
        setText(section, targets.subtitle, config.subtitle);
        setText(section, targets.body, config.body);
        const image = targets.image && section.querySelector(targets.image);
        if (image && config.imageUrl) image.src = config.imageUrl;
        const cta = targets.cta && section.querySelector(targets.cta);
        if (cta && config.ctaLabel) cta.textContent = config.ctaLabel;
        if (cta && config.ctaHref) cta.setAttribute('href', config.ctaHref);
        if (footer) footer.before(section);
      });
      document.documentElement.dataset.landingPublished = 'true';
    })
    .catch(() => {});

  function setText(root, selector, value) {
    if (!selector || !value) return;
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }
})();
