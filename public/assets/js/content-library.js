(function exposeContentLibrary(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemContentLibrary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createContentLibrary(root) {
  'use strict';

  const DEFAULT_ENDPOINT = '/.netlify/functions/content-library';
  const SAFE_LESSON_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.md$/i;
  const SAFE_PROMPT_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.(json|txt)$/i;
  const SAFE_REPOSITORY_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

  const ERROR_MESSAGES = Object.freeze({
    ACCESS_EXPIRED: 'Dostęp do kursu wygasł.',
    ACCESS_REQUIRED: 'To konto nie ma dostępu do materiałów.',
    ADMIN_REQUIRED: 'Ta operacja jest dostępna tylko dla administratora.',
    AUTH_EXPIRED: 'Sesja wygasła. Zaloguj się ponownie.',
    AUTH_REQUIRED: 'Zaloguj się ponownie, aby pobrać materiały.',
    CONTENT_CATALOG_INVALID: 'Plik catalog.json w repozytorium jest nieprawidłowy.',
    CONTENT_DIRECTORY_NOT_FOUND: 'W repozytorium brakuje folderu lessons lub prompts.',
    CONTENT_FILE_INVALID: 'Plik nie jest poprawnym tekstem UTF-8.',
    CONTENT_FILE_ALREADY_EXISTS: 'Plik o tej nazwie już istnieje. Wczytaj go z repozytorium przed aktualizacją albo wybierz inną nazwę.',
    CONTENT_FILE_NOT_FOUND: 'Nie znaleziono tego materiału w repozytorium.',
    CONTENT_FILE_TOO_LARGE: 'Plik przekracza dozwolony rozmiar.',
    CONTENT_REPOSITORY_NOT_CONFIGURED: 'Biblioteka GitHub nie została jeszcze skonfigurowana.',
    CONTENT_REPOSITORIES_INVALID: 'Konfiguracja listy repozytoriów jest nieprawidłowa.',
    CONTENT_REPOSITORY_NOT_FOUND: 'Nie znaleziono skonfigurowanego repozytorium lub gałęzi.',
    CONTENT_REPOSITORY_RESPONSE_INVALID: 'GitHub zwrócił nieprawidłową odpowiedź.',
    CONTENT_REPOSITORY_TIMEOUT: 'GitHub zbyt długo nie odpowiadał.',
    CONTENT_REPOSITORY_UNAVAILABLE: 'Biblioteka materiałów jest chwilowo niedostępna.',
    GITHUB_CONTENT_TOKEN_REJECTED: 'Token GitHub jest nieprawidłowy albo nie ma dostępu do repozytorium.',
    GITHUB_CONTENT_WRITE_REJECTED: 'Token GitHub nie ma uprawnienia Contents: Read and write do repozytorium.',
    CONTENT_WRITE_CONFLICT: 'Plik został w międzyczasie zmieniony. Wczytaj najnowszą wersję z repozytorium.',
    INVALID_CONTENT_SHA: 'Brakuje aktualnej wersji pliku. Wczytaj go ponownie z repozytorium.',
    INVALID_CONTENT_ENDPOINT: 'Endpoint biblioteki musi działać w tej samej domenie co aplikacja.',
    INVALID_CONTENT_FILENAME: 'Nazwa pliku lub rozszerzenie są nieprawidłowe.',
    INVALID_CONTENT_KIND: 'Nieprawidłowy rodzaj materiału.',
    INVALID_CONTENT_REQUEST: 'Żądanie zapisu materiału jest nieprawidłowe.',
    INVALID_CONTENT_REPOSITORY: 'Wybrane repozytorium jest nieprawidłowe albo nie zostało skonfigurowane.',
    PROMPT_FILE_INVALID: 'Prompt ma nieprawidłowy format albo przekracza limit.',
    SESSION_CHECK_UNAVAILABLE: 'Nie udało się potwierdzić sesji.'
  });

  class ContentLibraryError extends Error {
    constructor(code, status) {
      super(ERROR_MESSAGES[code] || 'Nie udało się pobrać materiałów.');
      this.name = 'ContentLibraryError';
      this.code = code;
      this.status = status;
    }
  }

  function endpoint() {
    const meta = root && root.document
      ? root.document.querySelector('meta[name="chemdisk-content-endpoint"]')
      : null;
    const value = meta && typeof meta.content === 'string' ? meta.content.trim() : '';
    return value || DEFAULT_ENDPOINT;
  }

  function validateFilename(kind, rawFilename) {
    const filename = typeof rawFilename === 'string' ? rawFilename.trim() : '';
    const pattern = kind === 'lesson' ? SAFE_LESSON_FILENAME : SAFE_PROMPT_FILENAME;
    if (!pattern.test(filename)) {
      throw new ContentLibraryError('INVALID_CONTENT_FILENAME', 400);
    }
    return filename;
  }

  function validateRepositoryId(rawRepositoryId, optional = true) {
    const repositoryId = typeof rawRepositoryId === 'string'
      ? rawRepositoryId.trim().toLowerCase()
      : '';
    if (!repositoryId && optional) return '';
    if (!SAFE_REPOSITORY_ID.test(repositoryId)) {
      throw new ContentLibraryError('INVALID_CONTENT_REPOSITORY', 400);
    }
    return repositoryId;
  }

  async function accessToken(forceRefresh) {
    const auth = root && root.ChemAuth;
    if (!auth || typeof auth.getAccessToken !== 'function') {
      throw new ContentLibraryError('AUTH_REQUIRED', 401);
    }
    const token = await auth.getAccessToken({ forceRefresh: Boolean(forceRefresh) });
    if (!token) throw new ContentLibraryError('AUTH_REQUIRED', 401);
    return token;
  }

  async function request(params, options = {}) {
    const applicationOrigin = root && root.location ? root.location.origin : 'https://local.invalid';
    const url = new URL(endpoint(), applicationOrigin);
    if (url.origin !== applicationOrigin) {
      throw new ContentLibraryError('INVALID_CONTENT_ENDPOINT', 400);
    }
    const token = await accessToken(options.forceRefresh);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    let response;
    try {
      response = await root.fetch(url, {
        method: options.method || 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${token}`
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      });
    } catch {
      throw new ContentLibraryError('CONTENT_REPOSITORY_UNAVAILABLE', 503);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ContentLibraryError('CONTENT_REPOSITORY_UNAVAILABLE', response.status || 503);
    }
    if (!response.ok) {
      const code = payload && typeof payload.error === 'string'
        ? payload.error
        : 'CONTENT_REPOSITORY_UNAVAILABLE';
      if (response.status === 401 && !options.forceRefresh) {
        return request(params, { ...options, forceRefresh: true });
      }
      throw new ContentLibraryError(code, response.status);
    }
    return payload;
  }

  async function list(kind, options = {}) {
    if (kind !== 'lesson' && kind !== 'prompt') {
      throw new ContentLibraryError('INVALID_CONTENT_KIND', 400);
    }
    const payload = await request({
      action: 'list',
      kind,
      repo: validateRepositoryId(options.repositoryId),
      refresh: options.refresh ? '1' : ''
    });
    return Array.isArray(payload.assets) ? payload.assets : [];
  }

  async function readLesson(rawFilename, options = {}) {
    return read('lesson', rawFilename, options);
  }

  async function readPrompt(rawFilename, options = {}) {
    return read('prompt', rawFilename, options);
  }

  async function read(kind, rawFilename, options = {}) {
    const filename = validateFilename(kind, rawFilename);
    const payload = await request({
      action: 'read',
      kind,
      file: filename,
      repo: validateRepositoryId(options.repositoryId)
    });
    if (!payload || typeof payload.content !== 'string') {
      throw new ContentLibraryError('CONTENT_FILE_INVALID', 422);
    }
    return payload;
  }

  async function save(kind, input = {}) {
    const filename = validateFilename(kind, input.filename);
    if (typeof input.content !== 'string') {
      throw new ContentLibraryError('CONTENT_FILE_INVALID', 422);
    }
    return request({}, {
      method: 'PUT',
      body: {
        kind,
        filename,
        content: input.content,
        expectedSha: typeof input.expectedSha === 'string' ? input.expectedSha : '',
        repositoryId: validateRepositoryId(input.repositoryId)
      }
    });
  }

  async function remove(kind, input = {}) {
    const filename = validateFilename(kind, input.filename);
    return request({}, {
      method: 'DELETE',
      body: {
        kind,
        filename,
        expectedSha: typeof input.expectedSha === 'string' ? input.expectedSha : '',
        repositoryId: validateRepositoryId(input.repositoryId)
      }
    });
  }

  async function status(options = {}) {
    return request({
      action: 'status',
      repo: validateRepositoryId(options.repositoryId),
      refresh: options.refresh ? '1' : ''
    });
  }

  async function repositories() {
    const payload = await request({ action: 'repositories' });
    return Array.isArray(payload.repositories) ? payload.repositories : [];
  }

  function lessonUrl(rawFilename, rawRepositoryId = '') {
    const filename = validateFilename('lesson', rawFilename);
    const repositoryId = validateRepositoryId(rawRepositoryId);
    const params = new URLSearchParams({ file: filename });
    if (repositoryId) params.set('repo', repositoryId);
    return `/members/module/lesson/?${params.toString()}`;
  }

  function search(assets, query) {
    const normalized = String(query || '').trim().toLocaleLowerCase('pl');
    if (!normalized) return Array.isArray(assets) ? assets.slice() : [];
    return (Array.isArray(assets) ? assets : []).filter((asset) => (
      [
        asset && asset.title,
        asset && asset.filename,
        asset && asset.description,
        ...(Array.isArray(asset && asset.tags) ? asset.tags : [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pl')
        .includes(normalized)
    ));
  }

  return {
    ContentLibraryError,
    ERROR_MESSAGES,
    list,
    readPrompt,
    readLesson,
    repositories,
    remove,
    save,
    search,
    status,
    lessonUrl,
    validateFilename,
    validateRepositoryId,
    _test: { endpoint }
  };
});
