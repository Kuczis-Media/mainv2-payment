'use strict';

const { json } = require('../admin-common.js');
const landing = require('../landing-content.js');

const PUBLIC_CACHE_HEADERS = Object.freeze({
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
  'Netlify-CDN-Cache-Control': 'public, durable, max-age=60, stale-while-revalidate=300',
  'Netlify-Cache-Tag': 'chemdisk-landing',
  Vary: 'Accept-Encoding'
});

exports.handler = async (event = {}) => {
  if (String(event.httpMethod || '').toUpperCase() !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET' });
  try {
    const result = await landing.readModel(landing.getLandingStore(), landing.PUBLISHED_KEY);
    return json(result.exists ? {
      active: true,
      model: {
        version: result.model.version,
        revision: result.model.revision,
        branding: result.model.branding,
        sections: result.model.sections,
        publishedAt: result.model.publishedAt
      }
    } : { active: false }, 200, PUBLIC_CACHE_HEADERS);
  } catch {
    // The checked-in landing page is the safe availability fallback.
    return json({ active: false, error: 'LANDING_STORAGE_UNAVAILABLE' }, 503);
  }
};
