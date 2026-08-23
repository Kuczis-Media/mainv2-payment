'use strict';

const { json } = require('../admin-common.js');
const landing = require('../landing-content.js');

exports.handler = async (event = {}) => {
  if (String(event.httpMethod || '').toUpperCase() !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET' });
  try {
    const result = await landing.readModel(landing.getLandingStore(), landing.PUBLISHED_KEY);
    return json(result.exists ? {
      active: true,
      model: {
        version: result.model.version,
        revision: result.model.revision,
        sections: result.model.sections,
        publishedAt: result.model.publishedAt
      }
    } : { active: false });
  } catch {
    // The checked-in landing page is the safe availability fallback.
    return json({ active: false });
  }
};
