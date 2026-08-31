'use strict';

const { decodeMediaUpload, GITHUB_API_VERSION } = require('./content-repository.js');

const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_REPOSITORY = 'Kuczis-Media/logo';
const DEFAULT_REF = 'main';
const REQUEST_TIMEOUT_MS = 10_000;
const PUBLIC_CHECK_TTL_MS = 5 * 60 * 1000;
const MAX_IMAGE_DIMENSION = 8_192;
const MAX_IMAGE_PIXELS = 32_000_000;
const SAFE_DIRECTORY = /^(?:[A-Za-z0-9][A-Za-z0-9_.-]*\/)*[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SAFE_SHA = /^[a-f0-9]{40}$/i;
const SAFE_ASSET_FILENAME = /^[a-z0-9][a-z0-9_.-]{0,99}\.(?:png|jpe?g|webp|gif|svg)$/;
let publicCheckCache = null;

class SiteAssetsError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.name = 'SiteAssetsError';
    this.code = code;
    this.status = status;
  }
}

function configuration(env = process.env) {
  const directory = clean(env.GITHUB_SITE_ASSETS_DIRECTORY).replace(/^\/+|\/+$/g, '');
  const token = clean(env.GITHUB_SITE_ASSETS_TOKEN);
  const valid = !directory || SAFE_DIRECTORY.test(directory);
  return {
    repository: DEFAULT_REPOSITORY,
    ref: DEFAULT_REF,
    directory,
    token,
    configured: Boolean(valid && token),
    cdnBaseUrl: valid ? cdnUrl({ repository: DEFAULT_REPOSITORY, ref: DEFAULT_REF, directory }, '', DEFAULT_REF).replace(/\/$/, '') : ''
  };
}

function publicConfiguration(env = process.env) {
  const config = configuration(env);
  return {
    configured: config.configured,
    repository: config.repository,
    ref: config.ref,
    directory: !config.directory || SAFE_DIRECTORY.test(config.directory) ? config.directory : '',
    cdnBaseUrl: config.cdnBaseUrl
  };
}

function contentPath(config, filename = '') {
  return [config.directory, filename].filter(Boolean).join('/');
}

function apiUrl(config, filename = '', includeRef = true) {
  const [owner, repository] = config.repository.split('/');
  const suffix = contentPath(config, filename)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const url = new URL(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents${suffix ? `/${suffix}` : ''}`);
  if (includeRef) url.searchParams.set('ref', config.ref);
  return url;
}

function repositoryUrl(config) {
  const [owner, repository] = config.repository.split('/');
  return new URL(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`);
}

function branchUrl(config) {
  const [owner, repository] = config.repository.split('/');
  return new URL(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/branches/${encodeURIComponent(config.ref)}`);
}

function headers(config, json = false) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'User-Agent': 'ChemDisk-site-assets',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    ...(json ? { 'Content-Type': 'application/json; charset=utf-8' } : {})
  };
}

async function githubFetch(url, config, options = {}) {
  if (!config.configured) throw new SiteAssetsError('SITE_ASSETS_NOT_CONFIGURED', 503);
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(url, {
      method: options.method || 'GET',
      headers: headers(config, Boolean(options.body)),
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw new SiteAssetsError('SITE_ASSETS_TIMEOUT', 504);
    throw new SiteAssetsError('SITE_ASSETS_UNAVAILABLE', 503);
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0') {
    throw new SiteAssetsError('SITE_ASSETS_RATE_LIMITED', 503);
  }
  if (response.status === 401 || response.status === 403) {
    throw new SiteAssetsError(options.write ? 'SITE_ASSETS_WRITE_REJECTED' : 'SITE_ASSETS_TOKEN_REJECTED', 503);
  }
  return response;
}

async function ensurePublic(config, options = {}) {
  const key = `${config.repository}:${config.ref}:${config.token.slice(-8)}`;
  if (!options.forcePublicCheck && publicCheckCache && publicCheckCache.key === key && publicCheckCache.expiresAt > Date.now()) {
    return publicCheckCache.commitSha;
  }
  const response = await githubFetch(repositoryUrl(config), config, options);
  if (response.status === 404) throw new SiteAssetsError('SITE_ASSETS_REPOSITORY_NOT_FOUND', 404);
  if (!response.ok) throw new SiteAssetsError('SITE_ASSETS_UNAVAILABLE', 503);
  let payload;
  try { payload = await response.json(); }
  catch { throw new SiteAssetsError('SITE_ASSETS_RESPONSE_INVALID', 503); }
  if (!payload || payload.private !== false) {
    throw new SiteAssetsError('SITE_ASSETS_REPOSITORY_NOT_PUBLIC', 409);
  }
  const branchResponse = await githubFetch(branchUrl(config), config, options);
  if (branchResponse.status === 404) throw new SiteAssetsError('SITE_ASSETS_REF_NOT_FOUND', 404);
  if (!branchResponse.ok) throw new SiteAssetsError('SITE_ASSETS_UNAVAILABLE', 503);
  let branch;
  try { branch = await branchResponse.json(); }
  catch { throw new SiteAssetsError('SITE_ASSETS_RESPONSE_INVALID', 503); }
  const commitSha = clean(branch && branch.commit && branch.commit.sha);
  if (!SAFE_SHA.test(commitSha)) throw new SiteAssetsError('SITE_ASSETS_RESPONSE_INVALID', 503);
  publicCheckCache = { key, commitSha, expiresAt: Date.now() + PUBLIC_CHECK_TTL_MS };
  return commitSha;
}

function cdnUrl(config, filename, version = config.ref) {
  const path = contentPath(config, filename)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const base = `https://cdn.jsdelivr.net/gh/${config.repository}@${encodeURIComponent(version)}`;
  return path ? `${base}/${path}` : `${base}/`;
}

function normalizeEntry(config, entry, commitSha) {
  const filename = clean(entry && entry.name);
  if (!entry || entry.type !== 'file' || !SAFE_ASSET_FILENAME.test(filename.toLowerCase())) return null;
  return {
    filename,
    path: contentPath(config, filename),
    size: Number(entry.size) || 0,
    sha: clean(entry.sha),
    mimeType: mimeType(filename),
    cdnUrl: cdnUrl(config, filename, commitSha),
    branchCdnUrl: cdnUrl(config, filename),
    githubUrl: clean(entry.html_url)
  };
}

async function listAssets(env = process.env, options = {}) {
  const config = configuration(env);
  const commitSha = await ensurePublic(config, options);
  const response = await githubFetch(apiUrl(config), config, options);
  if (response.status === 404) {
    return { configuration: publicConfiguration(env), assets: [] };
  }
  if (!response.ok) throw new SiteAssetsError('SITE_ASSETS_UNAVAILABLE', 503);
  let payload;
  try { payload = await response.json(); }
  catch { throw new SiteAssetsError('SITE_ASSETS_RESPONSE_INVALID', 503); }
  if (!Array.isArray(payload)) throw new SiteAssetsError('SITE_ASSETS_RESPONSE_INVALID', 503);
  const assets = payload.map((entry) => normalizeEntry(config, entry, commitSha)).filter(Boolean)
    .sort((left, right) => left.filename.localeCompare(right.filename, 'pl', { sensitivity: 'base' }));
  return { configuration: publicConfiguration(env), assets };
}

async function uploadAsset(input = {}, env = process.env, options = {}) {
  const config = configuration(env);
  let media;
  try {
    media = decodeMediaUpload(input.filename, input.contentBase64, input.mimeType);
    validatePublicImage(media);
  } catch (error) {
    if (error && error.code === 'CONTENT_FILE_TOO_LARGE') throw new SiteAssetsError(error.code, error.status || 413);
    throw new SiteAssetsError(error && error.code === 'MEDIA_SVG_UNSAFE' ? error.code : 'SITE_ASSET_INVALID', error && error.status || 422);
  }
  await ensurePublic(config, { ...options, forcePublicCheck: true });
  const response = await githubFetch(apiUrl(config, media.filename, false), config, {
    ...options,
    method: 'PUT',
    write: true,
    body: {
      message: `Add ${contentPath(config, media.filename)} from ChemDisk Studio`,
      content: media.buffer.toString('base64'),
      branch: config.ref
    }
  });
  if (response.status === 404) throw new SiteAssetsError('SITE_ASSETS_REPOSITORY_NOT_FOUND', 404);
  if (response.status === 409 || response.status === 422) {
    const message = await githubErrorMessage(response);
    if (/\bsha\b.*(?:missing|required|supplied)|already exists/i.test(message)) {
      throw new SiteAssetsError('SITE_ASSET_ALREADY_EXISTS', 409);
    }
    if (/branch|ref/i.test(message) && /not found|invalid|protected|update/i.test(message)) {
      throw new SiteAssetsError('SITE_ASSETS_REF_NOT_FOUND', 409);
    }
    throw new SiteAssetsError('SITE_ASSETS_WRITE_REJECTED', 409);
  }
  if (!response.ok) throw new SiteAssetsError('SITE_ASSETS_WRITE_REJECTED', 503);
  let payload;
  try { payload = await response.json(); }
  catch { throw new SiteAssetsError('SITE_ASSETS_RESPONSE_INVALID', 503); }
  const commitSha = clean(payload && payload.commit && payload.commit.sha);
  const sha = clean(payload && payload.content && payload.content.sha);
  if (!SAFE_SHA.test(commitSha) || !SAFE_SHA.test(sha)) {
    throw new SiteAssetsError('SITE_ASSETS_RESPONSE_INVALID', 503);
  }
  return {
    filename: media.filename,
    path: contentPath(config, media.filename),
    size: media.buffer.byteLength,
    mimeType: media.mimeType,
    sha,
    commitSha,
    commitUrl: clean(payload && payload.commit && payload.commit.html_url),
    cdnUrl: cdnUrl(config, media.filename, commitSha),
    branchCdnUrl: cdnUrl(config, media.filename),
    configuration: publicConfiguration(env)
  };
}

async function githubErrorMessage(response) {
  try {
    const payload = await response.json();
    return [payload && payload.message, ...(Array.isArray(payload && payload.errors) ? payload.errors.map((item) => JSON.stringify(item)) : [])]
      .filter(Boolean).join(' ');
  } catch { return ''; }
}

function validatePublicImage(media) {
  if (media.mimeType === 'image/svg+xml') return;
  const dimensions = media.mimeType === 'image/png' ? pngDimensions(media.buffer)
    : media.mimeType === 'image/jpeg' ? jpegDimensions(media.buffer)
      : media.mimeType === 'image/gif' ? gifDimensions(media.buffer)
        : media.mimeType === 'image/webp' ? webpDimensions(media.buffer)
          : null;
  if (!dimensions || !validDimensions(dimensions.width, dimensions.height)) {
    throw new SiteAssetsError('SITE_ASSET_INVALID', 422);
  }
}

function validDimensions(width, height) {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0
    && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION
    && width * height <= MAX_IMAGE_PIXELS;
}

function pngDimensions(buffer) {
  if (buffer.length < 45) return null;
  let offset = 8;
  let dimensions = null;
  let hasData = false;
  let hasEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) return null;
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13) return null;
      dimensions = { width: buffer.readUInt32BE(dataStart), height: buffer.readUInt32BE(dataStart + 4) };
    } else if (type === 'IDAT' && length > 0) hasData = true;
    else if (type === 'IEND') {
      if (length !== 0) return null;
      hasEnd = true;
      break;
    }
    offset = dataEnd + 4;
  }
  return dimensions && hasData && hasEnd ? dimensions : null;
}

function jpegDimensions(buffer) {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8
    || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if (startOfFrame.has(marker)) {
      if (length < 7) return null;
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function gifDimensions(buffer) {
  if (buffer.length < 14 || !['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
    || buffer[buffer.length - 1] !== 0x3b) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF'
    || buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
    || buffer.readUInt32LE(4) + 8 > buffer.length) return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > buffer.length) return null;
    if (type === 'VP8X' && length >= 10) {
      return { width: 1 + readUInt24LE(buffer, start + 4), height: 1 + readUInt24LE(buffer, start + 7) };
    }
    if (type === 'VP8L' && length >= 5 && buffer[start] === 0x2f) {
      return {
        width: 1 + buffer[start + 1] + ((buffer[start + 2] & 0x3f) << 8),
        height: 1 + ((buffer[start + 2] & 0xc0) >> 6) + (buffer[start + 3] << 2) + ((buffer[start + 4] & 0x0f) << 10)
      };
    }
    if (type === 'VP8 ' && length >= 10 && buffer[start + 3] === 0x9d && buffer[start + 4] === 0x01 && buffer[start + 5] === 0x2a) {
      return { width: buffer.readUInt16LE(start + 6) & 0x3fff, height: buffer.readUInt16LE(start + 8) & 0x3fff };
    }
    offset = start + length + (length % 2);
  }
  return null;
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function mimeType(filename) {
  if (/\.png$/i.test(filename)) return 'image/png';
  if (/\.jpe?g$/i.test(filename)) return 'image/jpeg';
  if (/\.webp$/i.test(filename)) return 'image/webp';
  if (/\.gif$/i.test(filename)) return 'image/gif';
  if (/\.svg$/i.test(filename)) return 'image/svg+xml';
  return 'application/octet-stream';
}

function clean(value) { return typeof value === 'string' ? value.trim() : ''; }

module.exports = {
  SiteAssetsError,
  configuration,
  listAssets,
  publicConfiguration,
  uploadAsset,
  _test: {
    apiUrl,
    branchUrl,
    cdnUrl,
    contentPath,
    validatePublicImage,
    resetPublicCheck() { publicCheckCache = null; }
  }
};
