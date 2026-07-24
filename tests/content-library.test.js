const test = require('node:test');
const assert = require('node:assert/strict');

const repository = require('../netlify/content-repository');
const contentFunction = require('../netlify/functions/content-library');
const browserLibrary = require('../public/assets/js/content-library');

const configured = {
  configured: true,
  token: 'github_pat_test',
  repository: 'Kuczis-Media/chemdisk-content',
  ref: 'main',
  root: ''
};

function githubResponse(body, options = {}) {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status: options.status || 200,
      headers: options.headers || {
        'content-type': typeof body === 'string' ? 'text/plain' : 'application/json'
      }
    }
  );
}

test('content repository configuration never exposes the GitHub token', () => {
  const env = {
    GITHUB_CONTENT_TOKEN: 'github_pat_secret',
    GITHUB_CONTENT_REPOSITORY: 'Kuczis-Media/chemdisk-content',
    GITHUB_CONTENT_REF: 'main'
  };
  const internal = repository.repositoryConfig(env);
  const visible = repository.publicConfiguration(env);

  assert.equal(internal.configured, true);
  assert.equal(internal.token, 'github_pat_secret');
  assert.equal(visible.configured, true);
  assert.equal(visible.tokenConfigured, true);
  assert.equal(visible.repository, 'Kuczis-Media/chemdisk-content');
  assert.equal(Object.hasOwn(visible, 'token'), false);
  assert.doesNotMatch(JSON.stringify(visible), /github_pat_secret/);
});

test('content repository selects one of several allowlisted repositories without exposing tokens', () => {
  const env = {
    GITHUB_CONTENT_TOKEN: 'github_pat_shared',
    GITHUB_CONTENT_TOKEN_SZKOLA: 'github_pat_school',
    GITHUB_CONTENT_REPOSITORIES: JSON.stringify([
      {
        id: 'glowne',
        label: 'Materiały główne',
        repository: 'Kuczis-Media/chemdisk-content',
        ref: 'main',
        default: true
      },
      {
        id: 'organiczna',
        label: 'Chemia organiczna',
        repository: 'Szkola/chemia-organiczna',
        ref: 'publikacja',
        root: 'kurs',
        tokenEnv: 'GITHUB_CONTENT_TOKEN_SZKOLA'
      }
    ])
  };

  const configs = repository.repositoryConfigs(env);
  const selected = repository.repositoryConfig(env, 'organiczna');
  const visible = repository.publicConfigurations(env);

  assert.equal(configs.length, 2);
  assert.equal(configs[0].default, true);
  assert.equal(selected.repository, 'Szkola/chemia-organiczna');
  assert.equal(selected.token, 'github_pat_school');
  assert.equal(selected.root, 'kurs');
  assert.equal(visible[1].id, 'organiczna');
  assert.equal(visible[1].label, 'Chemia organiczna');
  assert.equal(Object.hasOwn(visible[1], 'token'), false);
  assert.doesNotMatch(JSON.stringify(visible), /github_pat_/);
  assert.throws(
    () => repository.repositoryConfig(env, 'nieskonfigurowane'),
    (error) => error.code === 'INVALID_CONTENT_REPOSITORY' && error.status === 400
  );
});

test('multi-repository configuration fails closed on duplicate ids or arbitrary token variables', () => {
  const base = {
    GITHUB_CONTENT_TOKEN: 'github_pat_shared'
  };
  const duplicate = JSON.stringify([
    { id: 'chemia', label: 'A', repository: 'owner/a', default: true },
    { id: 'chemia', label: 'B', repository: 'owner/b' }
  ]);
  const unsafeTokenVariable = JSON.stringify([
    {
      id: 'chemia',
      label: 'A',
      repository: 'owner/a',
      tokenEnv: 'UNRELATED_SECRET',
      default: true
    }
  ]);

  assert.throws(
    () => repository.repositoryConfigs({ ...base, GITHUB_CONTENT_REPOSITORIES: duplicate }),
    (error) => error.code === 'CONTENT_REPOSITORIES_INVALID'
  );
  assert.throws(
    () => repository.repositoryConfigs({
      ...base,
      GITHUB_CONTENT_REPOSITORIES: unsafeTokenVariable
    }),
    (error) => error.code === 'CONTENT_REPOSITORIES_INVALID'
  );
});

test('repository id routes reads to the selected GitHub repository and its assigned token', async () => {
  repository._test.clearCache();
  const env = {
    GITHUB_CONTENT_TOKEN: 'github_pat_main',
    GITHUB_CONTENT_TOKEN_SZKOLA: 'github_pat_school',
    GITHUB_CONTENT_REPOSITORIES: JSON.stringify([
      {
        id: 'glowne',
        label: 'Główne',
        repository: 'owner/main-content',
        default: true
      },
      {
        id: 'organiczna',
        label: 'Organiczna',
        repository: 'school/organic-content',
        tokenEnv: 'GITHUB_CONTENT_TOKEN_SZKOLA'
      }
    ])
  };
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), authorization: options.headers.Authorization });
    if (String(url).includes('/catalog.json')) return githubResponse({ assets: {} });
    return githubResponse([]);
  };

  await repository.listAssets('lesson', {
    env,
    repositoryId: 'organiczna',
    fetchImpl
  });

  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ url }) => url.includes('/repos/school/organic-content/contents/')));
  assert.ok(requests.every(({ authorization }) => authorization === 'Bearer github_pat_school'));
});

test('content repository lists allowlisted files and applies catalog metadata', async () => {
  repository._test.clearCache();
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), headers: options.headers });
    if (String(url).includes('/contents/catalog.json')) {
      return githubResponse(JSON.stringify({
        assets: {
          'lessons/atom.md': {
            title: 'Budowa atomu',
            description: 'Lekcja testowa',
            tags: ['atom', 'chemia']
          }
        }
      }));
    }
    return githubResponse([
      { type: 'file', name: 'atom.md', size: 1200, sha: 'lesson-sha' },
      { type: 'file', name: 'notatki.txt', size: 40, sha: 'ignored' },
      { type: 'dir', name: 'podfolder', size: 0, sha: 'ignored-dir' },
      { type: 'file', name: 'za-duza.md', size: 900000, sha: 'ignored-size' }
    ]);
  };

  const assets = await repository.listAssets('lesson', { config: configured, fetchImpl });

  assert.deepEqual(assets, [{
    id: 'lesson:atom.md',
    kind: 'lesson',
    filename: 'atom.md',
    path: 'lessons/atom.md',
    title: 'Budowa atomu',
    description: 'Lekcja testowa',
    tags: ['atom', 'chemia'],
    size: 1200,
    sha: 'lesson-sha',
    repositoryId: 'default',
    repositoryLabel: 'chemdisk-content'
  }]);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.headers.Authorization === 'Bearer github_pat_test'));
  assert.ok(requests.every((request) => request.headers['X-GitHub-Api-Version']));
});

test('content repository reads UTF-8 lessons and rejects traversal', async () => {
  const fetchImpl = async () => githubResponse('# Lekcja\n\nTreść.', {
    headers: { etag: '"abc123"', 'content-length': '18' }
  });
  const asset = await repository.readAsset('lesson', 'atom.md', { config: configured, fetchImpl });

  assert.equal(asset.filename, 'atom.md');
  assert.match(asset.content, /Lekcja/);
  assert.equal(asset.sha, 'abc123');
  await assert.rejects(
    repository.readAsset('lesson', '../sekret.md', { config: configured, fetchImpl }),
    (error) => error.code === 'INVALID_CONTENT_FILENAME'
  );
});

test('content repository creates and updates files with base64 content and branch-scoped commits', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return githubResponse({
      content: { sha: 'b'.repeat(40) },
      commit: {
        sha: 'c'.repeat(40),
        html_url: 'https://github.com/Kuczis-Media/chemdisk-content/commit/test'
      }
    }, { status: requests.length === 1 ? 201 : 200 });
  };

  const created = await repository.saveAsset(
    'lesson',
    'nowa.md',
    '# Nowa lekcja\n\nTreść.',
    { config: configured, fetchImpl }
  );
  const updated = await repository.saveAsset(
    'prompt',
    'pomoc.json',
    JSON.stringify({ prompt: 'Pomagaj pytaniami naprowadzającymi.' }),
    { config: configured, fetchImpl, expectedSha: 'a'.repeat(40) }
  );

  const createBody = JSON.parse(requests[0].options.body);
  const updateBody = JSON.parse(requests[1].options.body);
  assert.equal(requests[0].options.method, 'PUT');
  assert.equal(new URL(requests[0].url).search, '');
  assert.equal(Buffer.from(createBody.content, 'base64').toString('utf8'), '# Nowa lekcja\n\nTreść.');
  assert.equal(createBody.branch, 'main');
  assert.equal(Object.hasOwn(createBody, 'sha'), false);
  assert.equal(updateBody.sha, 'a'.repeat(40));
  assert.equal(created.created, true);
  assert.equal(updated.created, false);
  assert.equal(updated.sha, 'b'.repeat(40));
  assert.ok(requests.every(({ options }) => options.headers.Authorization === 'Bearer github_pat_test'));
});

test('content repository deletes only an exact known SHA and maps GitHub conflicts safely', async () => {
  const requests = [];
  const deleted = await repository.deleteAsset(
    'lesson',
    'stara.md',
    'd'.repeat(40),
    {
      config: configured,
      fetchImpl: async (url, options) => {
        requests.push({ url: String(url), options });
        return githubResponse({
          content: null,
          commit: { sha: 'e'.repeat(40), html_url: 'https://github.com/example/commit/delete' }
        });
      }
    }
  );

  assert.equal(requests[0].options.method, 'DELETE');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    message: 'Delete lessons/stara.md from ChemDisk Studio',
    sha: 'd'.repeat(40),
    branch: 'main'
  });
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.commitSha, 'e'.repeat(40));

  await assert.rejects(
    repository.saveAsset('lesson', 'stara.md', '# Zmiana', {
      config: configured,
      expectedSha: 'f'.repeat(40),
      fetchImpl: async () => githubResponse({ message: 'conflict' }, { status: 409 })
    }),
    (error) => error.code === 'CONTENT_WRITE_CONFLICT' && error.status === 409
  );
});

test('content repository rejects malformed prompts and blind deletes before GitHub access', async () => {
  let requests = 0;
  const fetchImpl = async () => {
    requests += 1;
    return githubResponse({});
  };

  await assert.rejects(
    repository.saveAsset('prompt', 'zly.json', '{"wrong":"field"}', { config: configured, fetchImpl }),
    (error) => error.code === 'PROMPT_FILE_INVALID'
  );
  await assert.rejects(
    repository.saveAsset('prompt', 'zly.txt', 'tekst bez nagłówka', { config: configured, fetchImpl }),
    (error) => error.code === 'PROMPT_FILE_INVALID'
  );
  await assert.rejects(
    repository.deleteAsset('lesson', 'lekcja.md', '', { config: configured, fetchImpl }),
    (error) => error.code === 'INVALID_CONTENT_SHA'
  );
  assert.equal(requests, 0);
});

test('browser content client searches metadata and validates names locally', () => {
  const assets = [
    {
      title: 'Izotopy węgla',
      filename: 'izotopy-wegla.md',
      description: 'Liczba neutronów',
      tags: ['atom']
    },
    {
      title: 'Stechiometria',
      filename: 'stechiometria.md',
      description: '',
      tags: []
    }
  ];

  assert.deepEqual(browserLibrary.search(assets, 'neutron'), [assets[0]]);
  assert.deepEqual(browserLibrary.search(assets, 'ATOM'), [assets[0]]);
  assert.equal(browserLibrary.validateFilename('lesson', 'atom.md'), 'atom.md');
  assert.throws(() => browserLibrary.validateFilename('lesson', '../atom.md'));
});

test('browser content client never sends an Identity token to a cross-origin endpoint', async (t) => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const originalAuth = global.ChemAuth;
  let tokenRequests = 0;
  t.after(() => {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    if (originalLocation === undefined) delete global.location;
    else global.location = originalLocation;
    if (originalAuth === undefined) delete global.ChemAuth;
    else global.ChemAuth = originalAuth;
  });
  global.document = {
    querySelector: () => ({ content: 'https://untrusted.example/content-library' })
  };
  global.location = { origin: 'https://course.example' };
  global.ChemAuth = {
    async getAccessToken() {
      tokenRequests += 1;
      return 'identity-secret';
    }
  };

  await assert.rejects(
    browserLibrary.list('lesson'),
    (error) => error.code === 'INVALID_CONTENT_ENDPOINT'
  );
  assert.equal(tokenRequests, 0);
});

test('browser content client sends repository mutations only to the same-origin Function', async (t) => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  const originalAuth = global.ChemAuth;
  const originalFetch = global.fetch;
  const requests = [];
  t.after(() => {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    if (originalLocation === undefined) delete global.location;
    else global.location = originalLocation;
    if (originalAuth === undefined) delete global.ChemAuth;
    else global.ChemAuth = originalAuth;
    global.fetch = originalFetch;
  });
  global.document = { querySelector: () => null };
  global.location = { origin: 'https://course.example' };
  global.ChemAuth = { getAccessToken: async () => 'identity-secret' };
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return githubResponse({
      sha: 'a'.repeat(40),
      commitSha: 'b'.repeat(40),
      created: options.method === 'PUT'
    });
  };

  await browserLibrary.save('lesson', {
    filename: 'nowa.md',
    content: '# Lekcja',
    expectedSha: '',
    repositoryId: 'organiczna'
  });
  await browserLibrary.remove('lesson', {
    filename: 'nowa.md',
    expectedSha: 'a'.repeat(40),
    repositoryId: 'organiczna'
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://course.example/.netlify/functions/content-library');
  assert.equal(requests[0].options.method, 'PUT');
  assert.equal(requests[1].options.method, 'DELETE');
  assert.ok(requests.every(({ options }) => options.credentials === 'same-origin'));
  assert.ok(requests.every(({ options }) => options.headers.Authorization === 'Bearer identity-secret'));
  assert.ok(requests.every(({ options }) => !options.body.includes('identity-secret')));
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    kind: 'lesson',
    filename: 'nowa.md',
    expectedSha: 'a'.repeat(40),
    repositoryId: 'organiczna'
  });
  assert.equal(
    browserLibrary.lessonUrl('nowa.md', 'organiczna'),
    '/members/module/lesson/?file=nowa.md&repo=organiczna'
  );
});

test('content status endpoint requires an admin and never returns a secret', async (t) => {
  const originalFetch = global.fetch;
  const originalToken = process.env.GITHUB_CONTENT_TOKEN;
  const originalRepository = process.env.GITHUB_CONTENT_REPOSITORY;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_CONTENT_TOKEN;
    else process.env.GITHUB_CONTENT_TOKEN = originalToken;
    if (originalRepository === undefined) delete process.env.GITHUB_CONTENT_REPOSITORY;
    else process.env.GITHUB_CONTENT_REPOSITORY = originalRepository;
  });
  delete process.env.GITHUB_CONTENT_TOKEN;
  delete process.env.GITHUB_CONTENT_REPOSITORY;
  global.fetch = async () => githubResponse({
    id: 'admin-1',
    app_metadata: { roles: ['admin'] }
  });
  const event = {
    httpMethod: 'GET',
    headers: { authorization: 'Bearer identity-token' },
    queryStringParameters: { action: 'status' }
  };
  const context = {
    clientContext: {
      user: { id: 'admin-1', app_metadata: { roles: ['admin'] } },
      identity: { url: 'https://example.netlify.app/.netlify/identity' }
    }
  };

  const response = await contentFunction.handler(event, context);
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.connection, 'not_configured');
  assert.equal(payload.configuration.tokenConfigured, false);
  assert.doesNotMatch(response.body, /identity-token|github_pat/);
});

test('course users receive the safe repository selector without GitHub tokens', async (t) => {
  const originalFetch = global.fetch;
  const originalRepositories = process.env.GITHUB_CONTENT_REPOSITORIES;
  const originalToken = process.env.GITHUB_CONTENT_TOKEN;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalRepositories === undefined) delete process.env.GITHUB_CONTENT_REPOSITORIES;
    else process.env.GITHUB_CONTENT_REPOSITORIES = originalRepositories;
    if (originalToken === undefined) delete process.env.GITHUB_CONTENT_TOKEN;
    else process.env.GITHUB_CONTENT_TOKEN = originalToken;
  });
  process.env.GITHUB_CONTENT_TOKEN = 'github_pat_selector_secret';
  process.env.GITHUB_CONTENT_REPOSITORIES = JSON.stringify([
    {
      id: 'glowne',
      label: 'Materiały główne',
      repository: 'Kuczis-Media/chemdisk-content',
      default: true
    },
    {
      id: 'organiczna',
      label: 'Chemia organiczna',
      repository: 'Kuczis-Media/chemia-organiczna'
    }
  ]);
  global.fetch = async () => githubResponse({
    id: 'student-1',
    app_metadata: { roles: ['active'] }
  });

  const response = await contentFunction.handler({
    httpMethod: 'GET',
    headers: { authorization: 'Bearer student-token' },
    queryStringParameters: { action: 'repositories' }
  }, {
    clientContext: {
      user: { id: 'student-1', app_metadata: { roles: ['active'] } },
      identity: { url: 'https://course.example/.netlify/identity' }
    }
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.repositories.map(({ id, label, default: isDefault }) => ({
    id,
    label,
    default: isDefault
  })), [
    { id: 'glowne', label: 'Materiały główne', default: true },
    { id: 'organiczna', label: 'Chemia organiczna', default: false }
  ]);
  assert.doesNotMatch(response.body, /github_pat_selector_secret|student-token/);
});

test('course users can list lessons but prompt metadata remains admin-only', async (t) => {
  const originalFetch = global.fetch;
  const originalToken = process.env.GITHUB_CONTENT_TOKEN;
  const originalRepository = process.env.GITHUB_CONTENT_REPOSITORY;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_CONTENT_TOKEN;
    else process.env.GITHUB_CONTENT_TOKEN = originalToken;
    if (originalRepository === undefined) delete process.env.GITHUB_CONTENT_REPOSITORY;
    else process.env.GITHUB_CONTENT_REPOSITORY = originalRepository;
  });
  process.env.GITHUB_CONTENT_TOKEN = 'test-content-token';
  process.env.GITHUB_CONTENT_REPOSITORY = 'Kuczis-Media/chemdisk-content';
  repository._test.clearCache();
  let githubRequests = 0;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/.netlify/identity/user')) {
      return githubResponse({ id: 'student-1', app_metadata: { roles: ['active'] } });
    }
    githubRequests += 1;
    if (value.includes('/contents/catalog.json')) return githubResponse({ assets: {} });
    if (value.includes('/contents/lessons')) {
      return githubResponse([
        { type: 'file', name: 'atom.md', size: 100, sha: 'sha-1' }
      ]);
    }
    throw new Error(`Unexpected request: ${value}`);
  };
  const context = {
    clientContext: {
      user: { id: 'student-1', app_metadata: { roles: ['active'] } },
      identity: { url: 'https://example.netlify.app/.netlify/identity' }
    }
  };
  const baseEvent = {
    httpMethod: 'GET',
    headers: { authorization: 'Bearer student-token' }
  };

  const lessonsResponse = await contentFunction.handler({
    ...baseEvent,
    queryStringParameters: { action: 'list', kind: 'lesson' }
  }, context);
  const lessonsPayload = JSON.parse(lessonsResponse.body);
  assert.equal(lessonsResponse.statusCode, 200);
  assert.equal(lessonsPayload.assets[0].filename, 'atom.md');
  assert.equal(Object.hasOwn(lessonsPayload.assets[0], 'content'), false);

  const requestsBeforePrompts = githubRequests;
  const promptsResponse = await contentFunction.handler({
    ...baseEvent,
    queryStringParameters: { action: 'list', kind: 'prompt' }
  }, context);
  assert.equal(promptsResponse.statusCode, 403);
  assert.equal(JSON.parse(promptsResponse.body).error, 'ADMIN_REQUIRED');
  assert.equal(githubRequests, requestsBeforePrompts);
  assert.doesNotMatch(lessonsResponse.body + promptsResponse.body, /test-content-token/);
});

test('repository mutations require same-origin JSON and a canonical administrator', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let requests = 0;
  global.fetch = async () => {
    requests += 1;
    return githubResponse({ id: 'student-1', app_metadata: { roles: ['active'] } });
  };
  const context = {
    clientContext: {
      user: { id: 'student-1', app_metadata: { roles: ['active'] } },
      identity: { url: 'https://course.example/.netlify/identity' }
    }
  };
  const body = JSON.stringify({
    kind: 'lesson',
    filename: 'nowa.md',
    content: '# Lekcja',
    expectedSha: ''
  });

  const crossOrigin = await contentFunction.handler({
    httpMethod: 'PUT',
    headers: {
      authorization: 'Bearer student-token',
      'content-type': 'application/json',
      origin: 'https://evil.example',
      host: 'course.example',
      'x-forwarded-proto': 'https'
    },
    body
  }, context);
  assert.equal(crossOrigin.statusCode, 403);
  assert.equal(requests, 0);

  const student = await contentFunction.handler({
    httpMethod: 'PUT',
    headers: {
      authorization: 'Bearer student-token',
      'content-type': 'application/json',
      origin: 'https://course.example',
      host: 'course.example',
      'x-forwarded-proto': 'https'
    },
    body
  }, context);
  assert.equal(student.statusCode, 403);
  assert.equal(JSON.parse(student.body).error, 'ADMIN_REQUIRED');
  assert.equal(requests, 1);
});

test('an administrator can create a lesson through the guarded Function without exposing the GitHub token', async (t) => {
  const originalFetch = global.fetch;
  const originalToken = process.env.GITHUB_CONTENT_TOKEN;
  const originalRepository = process.env.GITHUB_CONTENT_REPOSITORY;
  const originalRef = process.env.GITHUB_CONTENT_REF;
  t.after(() => {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_CONTENT_TOKEN;
    else process.env.GITHUB_CONTENT_TOKEN = originalToken;
    if (originalRepository === undefined) delete process.env.GITHUB_CONTENT_REPOSITORY;
    else process.env.GITHUB_CONTENT_REPOSITORY = originalRepository;
    if (originalRef === undefined) delete process.env.GITHUB_CONTENT_REF;
    else process.env.GITHUB_CONTENT_REF = originalRef;
  });
  process.env.GITHUB_CONTENT_TOKEN = 'github_pat_server_only';
  process.env.GITHUB_CONTENT_REPOSITORY = 'Kuczis-Media/chemdisk-content';
  process.env.GITHUB_CONTENT_REF = 'main';
  let githubRequest;
  global.fetch = async (url, options) => {
    if (String(url).includes('/.netlify/identity/user')) {
      return githubResponse({ id: 'admin-1', app_metadata: { roles: ['admin'] } });
    }
    githubRequest = { url: String(url), options };
    return githubResponse({
      content: { sha: 'c'.repeat(40) },
      commit: { sha: 'd'.repeat(40), html_url: 'https://github.com/example/commit/test' }
    }, { status: 201 });
  };
  const response = await contentFunction.handler({
    httpMethod: 'PUT',
    headers: {
      authorization: 'Bearer identity-token',
      'content-type': 'application/json',
      origin: 'https://course.example',
      host: 'course.example',
      'x-forwarded-proto': 'https'
    },
    body: JSON.stringify({
      kind: 'lesson',
      filename: 'nowa.md',
      content: '# Nowa lekcja',
      expectedSha: ''
    })
  }, {
    clientContext: {
      user: { id: 'admin-1', app_metadata: { roles: ['admin'] } },
      identity: { url: 'https://course.example/.netlify/identity' }
    }
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 201);
  assert.equal(payload.created, true);
  assert.equal(payload.sha, 'c'.repeat(40));
  assert.equal(githubRequest.options.headers.Authorization, 'Bearer github_pat_server_only');
  assert.doesNotMatch(response.body, /github_pat_server_only|identity-token/);
});
