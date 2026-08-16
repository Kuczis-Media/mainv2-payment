'use strict';

const contentRepository = require('../content-repository.js');
const {
  json,
  requireCourseAccess,
  responseForFailure
} = require('../admin-common.js');

exports.handler = async function contentMediaHandler(event = {}, context = {}) {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Headers': 'Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        Vary: 'Origin'
      },
      body: ''
    };
  }
  if (method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, OPTIONS' });
  const auth = await requireCourseAccess(event, context);
  if (!auth.ok) return responseForFailure(auth);

  const query = event.queryStringParameters || {};
  const allowed = new Set(['scope', 'materialKind', 'materialId', 'ref', 'repo']);
  if (Object.keys(query).some((key) => !allowed.has(key))) return json({ error: 'UNEXPECTED_QUERY' }, 400);
  try {
    const media = await contentRepository.readMedia(
      typeof query.scope === 'string' ? query.scope : 'local',
      typeof query.materialKind === 'string' ? query.materialKind : '',
      typeof query.materialId === 'string' ? query.materialId : '',
      typeof query.ref === 'string' ? query.ref : '',
      { repositoryId: typeof query.repo === 'string' ? query.repo : '' }
    );
    return {
      statusCode: 200,
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(media.buffer.byteLength),
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        ...(media.mimeType === 'image/svg+xml'
          ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" }
          : {})
      },
      body: media.buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    const status = error instanceof contentRepository.ContentRepositoryError ? error.status : 503;
    const code = error instanceof contentRepository.ContentRepositoryError
      ? error.code
      : 'CONTENT_REPOSITORY_UNAVAILABLE';
    return json({ error: code }, status);
  }
};
