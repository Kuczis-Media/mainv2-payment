'use strict';

const {
  json,
  mutationGuard,
  parseJsonBody,
  plainObject,
  requireAdmin,
  requireCourseAccess,
  responseForFailure
} = require('../admin-common');
const contentRepository = require('../content-repository');

exports.handler = async function contentLibraryHandler(event = {}, context = {}) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        Vary: 'Origin'
      },
      body: ''
    };
  }
  if (!['GET', 'PUT', 'DELETE'].includes(event.httpMethod)) {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, PUT, DELETE' });
  }

  if (event.httpMethod === 'PUT' || event.httpMethod === 'DELETE') {
    const guard = mutationGuard(event, { maxBodyBytes: 1_100_000 });
    if (!guard.ok) return responseForFailure(guard);
    const authorization = await requireAdmin(event, context);
    if (!authorization.ok) return responseForFailure(authorization);
    return mutateContent(event);
  }

  const query = event.queryStringParameters || {};
  const action = typeof query.action === 'string' ? query.action : 'list';
  const kind = typeof query.kind === 'string' ? query.kind : 'lesson';
  const repositoryId = typeof query.repo === 'string' ? query.repo : '';
  const adminOnly = action === 'status' || kind === 'prompt' || query.refresh === '1';
  const authorization = adminOnly
    ? await requireAdmin(event, context)
    : await requireCourseAccess(event, context);
  if (!authorization.ok) return responseForFailure(authorization);

  try {
    if (action === 'status') {
      const configuration = contentRepository.publicConfiguration(process.env, repositoryId);
      const repositories = contentRepository.publicConfigurations();
      let counts = { lessons: 0, prompts: 0 };
      let connection = configuration.configured ? 'pending' : 'not_configured';
      let error = '';
      if (configuration.configured) {
        try {
          const [lessons, prompts] = await Promise.all([
            contentRepository.listAssets('lesson', {
              force: query.refresh === '1',
              repositoryId: configuration.id
            }),
            contentRepository.listAssets('prompt', {
              force: query.refresh === '1',
              repositoryId: configuration.id
            })
          ]);
          counts = { lessons: lessons.length, prompts: prompts.length };
          connection = 'ready';
        } catch (statusError) {
          connection = 'error';
          error = errorCode(statusError);
        }
      }
      return json({ configuration, repositories, connection, counts, error });
    }

    if (action === 'repositories') {
      return json({ repositories: contentRepository.publicConfigurations() });
    }

    if (action === 'list') {
      const assets = await contentRepository.listAssets(kind, {
        force: query.refresh === '1',
        repositoryId
      });
      return json({
        assets,
        kind,
        repository: contentRepository.publicConfiguration(process.env, repositoryId)
      });
    }

    if (action === 'read' && (kind === 'lesson' || kind === 'prompt')) {
      const asset = await contentRepository.readAsset(kind, query.file, { repositoryId });
      return json(asset);
    }

    return json({ error: 'INVALID_CONTENT_ACTION' }, 400);
  } catch (error) {
    const status = error instanceof contentRepository.ContentRepositoryError
      ? error.status
      : 503;
    return json({ error: errorCode(error) }, status);
  }
};

async function mutateContent(event) {
  const parsed = parseJsonBody(event);
  if (!parsed.ok) return responseForFailure(parsed);
  const validation = validateMutationBody(parsed.value, event.httpMethod);
  if (!validation.ok) return json({ error: validation.code }, validation.status || 400);

  try {
    if (event.httpMethod === 'PUT') {
      const saved = await contentRepository.saveAsset(
        validation.value.kind,
        validation.value.filename,
        validation.value.content,
        {
          expectedSha: validation.value.expectedSha,
          repositoryId: validation.value.repositoryId
        }
      );
      return json(saved, saved.created ? 201 : 200);
    }
    const deleted = await contentRepository.deleteAsset(
      validation.value.kind,
      validation.value.filename,
      validation.value.expectedSha,
      { repositoryId: validation.value.repositoryId }
    );
    return json(deleted);
  } catch (error) {
    const status = error instanceof contentRepository.ContentRepositoryError
      ? error.status
      : 503;
    return json({ error: errorCode(error) }, status);
  }
}

function validateMutationBody(value, method) {
  if (!plainObject(value)) return { ok: false, code: 'INVALID_CONTENT_REQUEST' };
  const allowed = method === 'PUT'
    ? new Set(['kind', 'filename', 'content', 'expectedSha', 'repositoryId'])
    : new Set(['kind', 'filename', 'expectedSha', 'repositoryId']);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    return { ok: false, code: 'INVALID_CONTENT_REQUEST' };
  }
  if (!['lesson', 'prompt'].includes(value.kind)) {
    return { ok: false, code: 'INVALID_CONTENT_KIND' };
  }
  if (typeof value.filename !== 'string') {
    return { ok: false, code: 'INVALID_CONTENT_FILENAME' };
  }
  if (method === 'PUT' && typeof value.content !== 'string') {
    return { ok: false, code: 'CONTENT_FILE_INVALID', status: 422 };
  }
  if (
    value.expectedSha != null &&
    typeof value.expectedSha !== 'string'
  ) {
    return { ok: false, code: 'INVALID_CONTENT_SHA' };
  }
  if (method === 'DELETE' && !value.expectedSha) {
    return { ok: false, code: 'INVALID_CONTENT_SHA' };
  }
  if (value.repositoryId != null && typeof value.repositoryId !== 'string') {
    return { ok: false, code: 'INVALID_CONTENT_REPOSITORY' };
  }
  return {
    ok: true,
    value: {
      kind: value.kind,
      filename: value.filename,
      content: method === 'PUT' ? value.content : '',
      expectedSha: typeof value.expectedSha === 'string' ? value.expectedSha : '',
      repositoryId: typeof value.repositoryId === 'string' ? value.repositoryId : ''
    }
  };
}

function errorCode(error) {
  return error instanceof contentRepository.ContentRepositoryError
    ? error.code
    : 'CONTENT_REPOSITORY_UNAVAILABLE';
}

exports._test = { errorCode, validateMutationBody };
