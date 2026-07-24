'use strict';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const REQUEST_TIMEOUT_MS = 10_000;
const LIST_CACHE_MS = 20_000;
const MAX_PROMPT_CHARS = 10_000;
const MAX_CATALOG_BYTES = 256 * 1024;
const MAX_LESSON_BYTES = 512 * 1024;
const MAX_PROMPT_BYTES = 256 * 1024;
const SAFE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_REPOSITORY_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SAFE_TOKEN_ENV = /^GITHUB_CONTENT_TOKEN(?:_[A-Z0-9][A-Z0-9_]*)?$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const SAFE_ROOT = /^(?:[A-Za-z0-9][A-Za-z0-9_.-]*\/)*[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SAFE_LESSON_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.md$/i;
const SAFE_PROMPT_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.(json|txt)$/i;
const SAFE_SHA = /^[a-f0-9]{40,64}$/i;
const PROMPT_POINT_HEADER = /^::punkt[ \t]+([1-9]\d{0,3})[ \t]*$/i;
const SIMPLE_PROMPT_POINT_HEADER = /^([1-9]\d{0,3})[.)][ \t]+(.+)$/;
const listCache = new Map();
const mutationQueues = new Map();
const MAX_REPOSITORIES = 20;

class ContentRepositoryError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.name = 'ContentRepositoryError';
    this.code = code;
    this.status = status;
  }
}

function repositoryConfigs(env = process.env) {
  const raw = cleanString(env.GITHUB_CONTENT_REPOSITORIES);
  if (!raw) return [legacyRepositoryConfig(env)];

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch {
    throw new ContentRepositoryError('CONTENT_REPOSITORIES_INVALID', 503);
  }
  if (!Array.isArray(entries) || !entries.length || entries.length > MAX_REPOSITORIES) {
    throw new ContentRepositoryError('CONTENT_REPOSITORIES_INVALID', 503);
  }

  const seen = new Set();
  let defaultCount = 0;
  const configs = entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ContentRepositoryError('CONTENT_REPOSITORIES_INVALID', 503);
    }
    const allowed = new Set(['id', 'label', 'repository', 'ref', 'root', 'tokenEnv', 'default']);
    if (Object.keys(entry).some((key) => !allowed.has(key))) {
      throw new ContentRepositoryError('CONTENT_REPOSITORIES_INVALID', 503);
    }
    const id = cleanString(entry.id).toLowerCase();
    const label = cleanString(entry.label).slice(0, 80);
    const repository = cleanString(entry.repository);
    const ref = cleanString(entry.ref) || 'main';
    const root = cleanString(entry.root).replace(/^\/+|\/+$/g, '');
    const tokenEnv = cleanString(entry.tokenEnv) || 'GITHUB_CONTENT_TOKEN';
    const isDefault = entry.default === true || (!index && !entries.some((item) => item && item.default === true));
    if (
      !SAFE_REPOSITORY_ID.test(id) ||
      seen.has(id) ||
      !label ||
      !SAFE_REPOSITORY.test(repository) ||
      !SAFE_REF.test(ref) ||
      (root && !SAFE_ROOT.test(root)) ||
      !SAFE_TOKEN_ENV.test(tokenEnv) ||
      (entry.default != null && typeof entry.default !== 'boolean')
    ) {
      throw new ContentRepositoryError('CONTENT_REPOSITORIES_INVALID', 503);
    }
    seen.add(id);
    if (isDefault) defaultCount += 1;
    const token = cleanString(env[tokenEnv]);
    return {
      id,
      label,
      default: isDefault,
      configured: Boolean(token),
      token,
      repository,
      ref,
      root
    };
  });
  if (defaultCount !== 1) {
    throw new ContentRepositoryError('CONTENT_REPOSITORIES_INVALID', 503);
  }
  return configs;
}

function legacyRepositoryConfig(env) {
  const token = cleanString(env.GITHUB_CONTENT_TOKEN);
  const repository = cleanString(env.GITHUB_CONTENT_REPOSITORY);
  const ref = cleanString(env.GITHUB_CONTENT_REF) || 'main';
  const root = cleanString(env.GITHUB_CONTENT_ROOT).replace(/^\/+|\/+$/g, '');
  return {
    id: 'default',
    label: repository && SAFE_REPOSITORY.test(repository)
      ? repository.split('/')[1]
      : 'Główne repozytorium',
    default: true,
    configured: Boolean(
      token &&
      SAFE_REPOSITORY.test(repository) &&
      SAFE_REF.test(ref) &&
      (!root || SAFE_ROOT.test(root))
    ),
    token,
    repository,
    ref,
    root
  };
}

function repositoryConfig(env = process.env, rawRepositoryId = '') {
  const configs = repositoryConfigs(env);
  const repositoryId = cleanString(rawRepositoryId).toLowerCase();
  if (repositoryId && !SAFE_REPOSITORY_ID.test(repositoryId)) {
    throw new ContentRepositoryError('INVALID_CONTENT_REPOSITORY', 400);
  }
  const selected = repositoryId
    ? configs.find((config) => config.id === repositoryId)
    : configs.find((config) => config.default) || configs[0];
  if (!selected) throw new ContentRepositoryError('INVALID_CONTENT_REPOSITORY', 400);
  return selected;
}

function publicConfig(config) {
  return {
    configured: config.configured,
    tokenConfigured: Boolean(config.token),
    id: config.id,
    label: config.label,
    default: Boolean(config.default),
    repository: SAFE_REPOSITORY.test(config.repository) ? config.repository : '',
    ref: SAFE_REF.test(config.ref) ? config.ref : '',
    root: !config.root || SAFE_ROOT.test(config.root) ? config.root : ''
  };
}

function publicConfiguration(env = process.env, repositoryId = '') {
  return publicConfig(repositoryConfig(env, repositoryId));
}

function publicConfigurations(env = process.env) {
  return repositoryConfigs(env).map(publicConfig);
}

function configFromOptions(options = {}) {
  if (options.config) {
    const repository = cleanString(options.config.repository);
    return {
      ...options.config,
      id: cleanString(options.config.id) || 'default',
      label: cleanString(options.config.label)
        || (SAFE_REPOSITORY.test(repository) ? repository.split('/')[1] : '')
        || 'Repozytorium',
      default: options.config.default !== false
    };
  }
  return repositoryConfig(options.env, options.repositoryId);
}

function assetDefinition(kind) {
  if (kind === 'lesson') {
    return {
      directory: 'lessons',
      maxBytes: MAX_LESSON_BYTES,
      pattern: SAFE_LESSON_FILENAME
    };
  }
  if (kind === 'prompt') {
    return {
      directory: 'prompts',
      maxBytes: MAX_PROMPT_BYTES,
      pattern: SAFE_PROMPT_FILENAME
    };
  }
  throw new ContentRepositoryError('INVALID_CONTENT_KIND', 400);
}

function validateFilename(kind, rawFilename) {
  const filename = cleanString(rawFilename);
  const definition = assetDefinition(kind);
  if (!definition.pattern.test(filename)) {
    throw new ContentRepositoryError('INVALID_CONTENT_FILENAME', 400);
  }
  return filename;
}

function repositoryPath(config, relativePath) {
  const suffix = String(relativePath || '').replace(/^\/+/, '');
  return config.root ? `${config.root}/${suffix}` : suffix;
}

function apiUrl(config, relativePath, includeRef = true) {
  const [owner, repository] = config.repository.split('/');
  const path = repositoryPath(config, relativePath)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  const url = new URL(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${path}`
  );
  if (includeRef) url.searchParams.set('ref', config.ref);
  return url;
}

function githubHeaders(config, raw) {
  return {
    Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'User-Agent': 'ChemDisk-content-library',
    'X-GitHub-Api-Version': GITHUB_API_VERSION
  };
}

async function githubRequest(config, relativePath, options = {}) {
  if (!config.configured) {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_NOT_CONFIGURED', 503);
  }
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = apiUrl(config, relativePath);
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: githubHeaders(config, Boolean(options.raw)),
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ContentRepositoryError('CONTENT_REPOSITORY_TIMEOUT', 504);
    }
    throw new ContentRepositoryError('CONTENT_REPOSITORY_UNAVAILABLE', 503);
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 || response.status === 403) {
    throw new ContentRepositoryError('GITHUB_CONTENT_TOKEN_REJECTED', 503);
  }
  if (response.status === 404) {
    throw new ContentRepositoryError(options.notFoundCode || 'CONTENT_REPOSITORY_NOT_FOUND', 404);
  }
  if (!response.ok) {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_UNAVAILABLE', 503);
  }
  return response;
}

async function githubMutationRequest(config, relativePath, method, payload, options = {}) {
  if (!config.configured) {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_NOT_CONFIGURED', 503);
  }
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(apiUrl(config, relativePath, false), {
      method,
      headers: {
        ...githubHeaders(config, false),
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ContentRepositoryError('CONTENT_REPOSITORY_TIMEOUT', 504);
    }
    throw new ContentRepositoryError('CONTENT_REPOSITORY_UNAVAILABLE', 503);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ContentRepositoryError('GITHUB_CONTENT_WRITE_REJECTED', 503);
  }
  if (response.status === 404) {
    throw new ContentRepositoryError(
      options.fileExpected ? 'CONTENT_FILE_NOT_FOUND' : 'CONTENT_REPOSITORY_NOT_FOUND',
      404
    );
  }
  if (response.status === 409) {
    throw new ContentRepositoryError('CONTENT_WRITE_CONFLICT', 409);
  }
  if (response.status === 422) {
    throw new ContentRepositoryError(
      options.creating ? 'CONTENT_FILE_ALREADY_EXISTS' : 'CONTENT_WRITE_CONFLICT',
      409
    );
  }
  if (!response.ok) {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_UNAVAILABLE', 503);
  }
  try {
    return await response.json();
  } catch {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_RESPONSE_INVALID', 503);
  }
}

async function readResponseBytes(response, maxBytes) {
  const declaredLength = Number(response.headers && response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ContentRepositoryError('CONTENT_FILE_TOO_LARGE', 413);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new ContentRepositoryError('CONTENT_FILE_TOO_LARGE', 413);
  }
  return buffer;
}

function decodeUtf8(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    throw new ContentRepositoryError('CONTENT_FILE_INVALID', 422);
  }
}

async function readCatalog(config, options = {}) {
  let response;
  try {
    response = await githubRequest(config, 'catalog.json', {
      ...options,
      raw: true,
      notFoundCode: 'CONTENT_CATALOG_NOT_FOUND'
    });
  } catch (error) {
    if (error instanceof ContentRepositoryError && error.code === 'CONTENT_CATALOG_NOT_FOUND') {
      return {};
    }
    throw error;
  }
  const raw = decodeUtf8(await readResponseBytes(response, MAX_CATALOG_BYTES));
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ContentRepositoryError('CONTENT_CATALOG_INVALID', 422);
  }
  const assets = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed.assets
    : null;
  return assets && typeof assets === 'object' && !Array.isArray(assets) ? assets : {};
}

function normalizeMetadata(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const tags = Array.isArray(source.tags)
    ? source.tags.map(cleanString).filter(Boolean).slice(0, 12)
    : [];
  return {
    title: cleanString(source.title).slice(0, 160),
    description: cleanString(source.description).slice(0, 500),
    tags
  };
}

function titleFromFilename(filename) {
  const stem = String(filename || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (!stem) return filename;
  return stem.charAt(0).toLocaleUpperCase('pl') + stem.slice(1);
}

async function listAssets(kind, options = {}) {
  const definition = assetDefinition(kind);
  const config = configFromOptions(options);
  if (!config.configured) {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_NOT_CONFIGURED', 503);
  }
  const cacheKey = [config.id, config.repository, config.ref, config.root, kind].join(':');
  const cached = listCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.value.map((asset) => ({ ...asset, tags: [...asset.tags] }));
  }

  const [response, catalog] = await Promise.all([
    githubRequest(config, definition.directory, {
      ...options,
      notFoundCode: 'CONTENT_DIRECTORY_NOT_FOUND'
    }),
    readCatalog(config, options)
  ]);
  let entries;
  try {
    entries = await response.json();
  } catch {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_RESPONSE_INVALID', 503);
  }
  if (!Array.isArray(entries)) {
    throw new ContentRepositoryError('CONTENT_REPOSITORY_RESPONSE_INVALID', 503);
  }
  const assets = entries
    .filter((entry) => (
      entry &&
      entry.type === 'file' &&
      definition.pattern.test(entry.name || '') &&
      Number.isFinite(Number(entry.size)) &&
      Number(entry.size) <= definition.maxBytes
    ))
    .map((entry) => {
      const path = `${definition.directory}/${entry.name}`;
      const metadata = normalizeMetadata(catalog[path]);
      return {
        id: `${kind}:${entry.name}`,
        kind,
        repositoryId: config.id,
        repositoryLabel: config.label,
        filename: entry.name,
        path,
        title: metadata.title || titleFromFilename(entry.name),
        description: metadata.description,
        tags: metadata.tags,
        size: Number(entry.size),
        sha: cleanString(entry.sha)
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title, 'pl', { sensitivity: 'base' }));

  listCache.set(cacheKey, {
    expiresAt: Date.now() + LIST_CACHE_MS,
    value: assets
  });
  return assets.map((asset) => ({ ...asset, tags: [...asset.tags] }));
}

async function readAsset(kind, rawFilename, options = {}) {
  const definition = assetDefinition(kind);
  const filename = validateFilename(kind, rawFilename);
  const config = configFromOptions(options);
  const response = await githubRequest(config, `${definition.directory}/${filename}`, {
    ...options,
    raw: true,
    notFoundCode: 'CONTENT_FILE_NOT_FOUND'
  });
  const content = decodeUtf8(await readResponseBytes(response, definition.maxBytes));
  return {
    kind,
    repositoryId: config.id,
    repositoryLabel: config.label,
    filename,
    content,
    sha: cleanString(response.headers && response.headers.get('etag')).replace(/^W\/|"/g, '')
  };
}

function validateExpectedSha(rawSha, required = false) {
  const sha = cleanString(rawSha);
  if ((!sha && required) || (sha && !SAFE_SHA.test(sha))) {
    throw new ContentRepositoryError('INVALID_CONTENT_SHA', 400);
  }
  return sha.toLowerCase();
}

function extractJsonPrompt(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string').join('\n').trim();
  }
  if (value && typeof value === 'object') {
    for (const key of ['prompt', 'system', 'text', 'value', 'content']) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      if (Array.isArray(candidate)) {
        const joined = candidate.filter((item) => typeof item === 'string').join('\n').trim();
        if (joined) return joined;
      }
    }
  }
  return '';
}

function validateTxtPrompt(content) {
  const text = String(content || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const usesExplicitHeaders = lines.some((line) => PROMPT_POINT_HEADER.test(line));
  const seen = new Set();
  let currentNumber = null;
  let currentLines = [];

  const saveCurrent = () => {
    if (currentNumber === null) return;
    const value = currentLines.join('\n').trim();
    if (!value || value.length > MAX_PROMPT_CHARS || seen.has(currentNumber)) {
      throw new ContentRepositoryError('PROMPT_FILE_INVALID', 422);
    }
    seen.add(currentNumber);
  };

  for (const line of lines) {
    const header = usesExplicitHeaders
      ? PROMPT_POINT_HEADER.exec(line)
      : SIMPLE_PROMPT_POINT_HEADER.exec(line);
    if (header) {
      saveCurrent();
      currentNumber = Number(header[1]);
      currentLines = usesExplicitHeaders ? [] : [header[2].trim()];
      continue;
    }
    if (currentNumber === null) {
      if (line.trim()) throw new ContentRepositoryError('PROMPT_FILE_INVALID', 422);
      continue;
    }
    currentLines.push(line);
  }
  saveCurrent();
  if (!seen.size) throw new ContentRepositoryError('PROMPT_FILE_INVALID', 422);
}

function validateAssetContent(kind, filename, rawContent) {
  const definition = assetDefinition(kind);
  if (typeof rawContent !== 'string' || rawContent.includes('\0') || !rawContent.trim()) {
    throw new ContentRepositoryError('CONTENT_FILE_INVALID', 422);
  }
  const bytes = Buffer.byteLength(rawContent, 'utf8');
  if (bytes > definition.maxBytes) {
    throw new ContentRepositoryError('CONTENT_FILE_TOO_LARGE', 413);
  }
  if (kind === 'prompt') {
    if (/\.json$/i.test(filename)) {
      let parsed;
      try {
        parsed = JSON.parse(rawContent.replace(/^\uFEFF/, ''));
      } catch {
        throw new ContentRepositoryError('PROMPT_FILE_INVALID', 422);
      }
      const prompt = extractJsonPrompt(parsed);
      if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
        throw new ContentRepositoryError('PROMPT_FILE_INVALID', 422);
      }
    } else {
      validateTxtPrompt(rawContent);
    }
  }
  return rawContent;
}

function mutationResult(data, fallbackSha = '') {
  const source = data && typeof data === 'object' ? data : {};
  const content = source.content && typeof source.content === 'object' ? source.content : {};
  const commit = source.commit && typeof source.commit === 'object' ? source.commit : {};
  return {
    sha: cleanString(content.sha) || fallbackSha,
    commitSha: cleanString(commit.sha),
    commitUrl: cleanString(commit.html_url)
  };
}

function enqueueMutation(config, task) {
  const key = [config.repository, config.ref, config.root].join(':');
  const previous = mutationQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  mutationQueues.set(key, current);
  return current.finally(() => {
    if (mutationQueues.get(key) === current) mutationQueues.delete(key);
  });
}

async function saveAsset(kind, rawFilename, rawContent, options = {}) {
  const definition = assetDefinition(kind);
  const filename = validateFilename(kind, rawFilename);
  const content = validateAssetContent(kind, filename, rawContent);
  const expectedSha = validateExpectedSha(options.expectedSha, false);
  const config = configFromOptions(options);
  const creating = !expectedSha;
  const payload = {
    message: creating
      ? `Add ${definition.directory}/${filename} from ChemDisk Studio`
      : `Update ${definition.directory}/${filename} from ChemDisk Studio`,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: config.ref
  };
  if (expectedSha) payload.sha = expectedSha;

  return enqueueMutation(config, async () => {
    const data = await githubMutationRequest(
      config,
      `${definition.directory}/${filename}`,
      'PUT',
      payload,
      {
        ...options,
        creating,
        fileExpected: Boolean(expectedSha)
      }
    );
    listCache.clear();
    return {
      kind,
      repositoryId: config.id,
      repositoryLabel: config.label,
      filename,
      created: creating,
      ...mutationResult(data, expectedSha)
    };
  });
}

async function deleteAsset(kind, rawFilename, rawSha, options = {}) {
  const definition = assetDefinition(kind);
  const filename = validateFilename(kind, rawFilename);
  const expectedSha = validateExpectedSha(rawSha, true);
  const config = configFromOptions(options);

  return enqueueMutation(config, async () => {
    const data = await githubMutationRequest(
      config,
      `${definition.directory}/${filename}`,
      'DELETE',
      {
        message: `Delete ${definition.directory}/${filename} from ChemDisk Studio`,
        sha: expectedSha,
        branch: config.ref
      },
      {
        ...options,
        fileExpected: true
      }
    );
    listCache.clear();
    return {
      kind,
      repositoryId: config.id,
      repositoryLabel: config.label,
      filename,
      deleted: true,
      ...mutationResult(data)
    };
  });
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clearCache() {
  listCache.clear();
}

module.exports = {
  ContentRepositoryError,
  GITHUB_API_VERSION,
  deleteAsset,
  listAssets,
  publicConfiguration,
  publicConfigurations,
  readAsset,
  repositoryConfig,
  repositoryConfigs,
  saveAsset,
  validateFilename,
  _test: {
    apiUrl,
    assetDefinition,
    clearCache,
    decodeUtf8,
    extractJsonPrompt,
    mutationResult,
    normalizeMetadata,
    publicConfig,
    repositoryPath,
    titleFromFilename,
    validateAssetContent,
    validateExpectedSha,
    validateTxtPrompt
  }
};
