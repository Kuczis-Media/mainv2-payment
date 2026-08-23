(function exposeContentLibrary(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChemContentLibrary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createContentLibrary(root) {
  'use strict';

  const DEFAULT_ENDPOINT = '/.netlify/functions/content-library';
  const DEFAULT_MEDIA_ENDPOINT = '/.netlify/functions/content-media';
  const SAFE_LESSON_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.md$/i;
  const SAFE_PROMPT_FILENAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.(json|txt)$/i;
  const SAFE_EXAM_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
  const SAFE_QUESTION_BANK_FILENAME = /^question-bank\.json$/;
  const SAFE_REPOSITORY_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
  const MEDIA_CACHE_TTL_MS = 15 * 60 * 1000;
  const MEDIA_CACHE_MAX_ENTRIES = 96;
  const MEDIA_FETCH_TIMEOUT_MS = 12_000;
  const MEDIA_RETRY_DELAYS_MS = Object.freeze([0, 300, 900]);
  const mediaBlobCache = new Map();

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
    EXAM_FILE_INVALID: 'Definicja egzaminu jest nieprawidłowa.',
    EXAM_MEDIA_INVALID: 'Plik nie jest prawidłowym obrazem PNG, JPG, WEBP lub GIF.',
    INVALID_EXAM_MEDIA_REFERENCE: 'Nazwa albo ścieżka obrazu jest nieprawidłowa.',
    MEDIA_INVALID: 'Plik nie jest prawidłowym obrazem PNG, JPG, WEBP, GIF lub SVG.',
    MEDIA_SVG_UNSAFE: 'SVG zawiera aktywną albo zewnętrzną treść i nie może zostać zapisany.',
    INVALID_MEDIA_REFERENCE: 'Nazwa albo ścieżka obrazu jest nieprawidłowa.',
    INVALID_MEDIA_OWNER: 'Nieprawidłowy materiał nadrzędny dla obrazu.',
    INVALID_MEDIA_SCOPE: 'Nieprawidłowa biblioteka mediów.',
    QUESTION_BANK_INVALID: 'Bank pytań jest nieprawidłowy.',
    PRESENTATION_FILE_INVALID: 'Definicja prezentacji jest nieprawidłowa.',
    QUIZ_FILE_INVALID: 'Definicja quizu jest nieprawidłowa.',
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

  function mediaEndpoint() {
    const meta = root && root.document
      ? root.document.querySelector('meta[name="chemdisk-media-endpoint"]')
      : null;
    const value = meta && typeof meta.content === 'string' ? meta.content.trim() : '';
    return value || DEFAULT_MEDIA_ENDPOINT;
  }

  function validateFilename(kind, rawFilename) {
    const filename = typeof rawFilename === 'string' ? rawFilename.trim() : '';
    const pattern = kind === 'lesson'
      ? SAFE_LESSON_FILENAME
      : ['exam', 'presentation', 'quiz'].includes(kind) ? SAFE_EXAM_ID
        : kind === 'question_bank' ? SAFE_QUESTION_BANK_FILENAME : SAFE_PROMPT_FILENAME;
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
    if (!['lesson', 'prompt', 'exam', 'question_bank', 'presentation', 'quiz'].includes(kind)) {
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

  async function readExam(rawExamId, options = {}) {
    return read('exam', rawExamId, options);
  }

  async function readQuestionBank(options = {}) {
    return read('question_bank', 'question-bank.json', options);
  }

  async function readPresentation(rawPresentationId, options = {}) {
    return read('presentation', rawPresentationId, options);
  }

  async function readQuiz(rawQuizId, options = {}) {
    return read('quiz', rawQuizId, options);
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

  async function uploadExamMedia(input = {}) {
    const examId = validateFilename('exam', input.examId);
    const filename = typeof input.filename === 'string' ? input.filename.trim().toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9_.-]{0,99}\.(?:png|jpe?g|webp|gif)$/.test(filename)) {
      throw new ContentLibraryError('INVALID_EXAM_MEDIA_REFERENCE', 400);
    }
    if (typeof input.contentBase64 !== 'string' || !input.contentBase64) {
      throw new ContentLibraryError('EXAM_MEDIA_INVALID', 422);
    }
    return request({}, {
      method: 'PUT',
      body: {
        kind: 'exam_media',
        examId,
        filename,
        contentBase64: input.contentBase64,
        mimeType: typeof input.mimeType === 'string' ? input.mimeType : '',
        repositoryId: validateRepositoryId(input.repositoryId)
      }
    });
  }

  function normalizeMediaOwner(input = {}) {
    const scope = input.scope === 'shared' ? 'shared' : 'local';
    const materialKind = scope === 'shared' ? '' : String(input.materialKind || '').trim().toLowerCase();
    const materialId = scope === 'shared' ? '' : String(input.materialId || '').trim();
    if (scope === 'local' && !['lesson', 'exam', 'presentation', 'quiz'].includes(materialKind)) {
      throw new ContentLibraryError('INVALID_MEDIA_OWNER', 400);
    }
    if (scope === 'local') {
      if (materialKind === 'lesson') validateFilename('lesson', materialId);
      else if (!SAFE_EXAM_ID.test(materialId)) throw new ContentLibraryError('INVALID_MEDIA_OWNER', 400);
    }
    return { scope, materialKind, materialId };
  }

  async function listMedia(input = {}) {
    const owner = normalizeMediaOwner(input);
    const payload = await request({
      action: 'list-media',
      scope: owner.scope,
      materialKind: owner.materialKind,
      materialId: owner.materialId,
      repo: validateRepositoryId(input.repositoryId),
      refresh: input.refresh ? '1' : '',
      usage: input.usage ? '1' : ''
    });
    return Array.isArray(payload.assets) ? payload.assets : [];
  }

  async function uploadMedia(input = {}) {
    const owner = normalizeMediaOwner(input);
    const filename = typeof input.filename === 'string' ? input.filename.trim().toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9_.-]{0,99}\.(?:png|jpe?g|webp|gif|svg)$/.test(filename)) {
      throw new ContentLibraryError('INVALID_MEDIA_REFERENCE', 400);
    }
    if (typeof input.contentBase64 !== 'string' || !input.contentBase64) {
      throw new ContentLibraryError('MEDIA_INVALID', 422);
    }
    const saved = await request({}, {
      method: 'PUT',
      body: {
        kind: 'media',
        ...owner,
        filename,
        contentBase64: input.contentBase64,
        mimeType: typeof input.mimeType === 'string' ? input.mimeType : '',
        repositoryId: validateRepositoryId(input.repositoryId)
      }
    });
    invalidateMediaBlob(owner, saved.reference || saved.ref || `photos/${filename}`, input.repositoryId);
    return saved;
  }

  async function removeMedia(input = {}) {
    const owner = normalizeMediaOwner(input);
    const removed = await request({}, {
      method: 'DELETE',
      body: {
        kind: 'media',
        ...owner,
        reference: typeof input.reference === 'string' ? input.reference.trim().toLowerCase() : '',
        expectedSha: typeof input.expectedSha === 'string' ? input.expectedSha : '',
        repositoryId: validateRepositoryId(input.repositoryId)
      }
    });
    invalidateMediaBlob(owner, input.reference, input.repositoryId);
    return removed;
  }

  function mediaBlobCacheKey(owner, reference, repositoryId) {
    return [
      validateRepositoryId(repositoryId),
      owner.scope,
      owner.materialKind,
      owner.materialId,
      String(reference || '').trim().toLowerCase()
    ].join(':');
  }

  function invalidateMediaBlob(owner, reference, repositoryId) {
    try { mediaBlobCache.delete(mediaBlobCacheKey(owner, reference, repositoryId)); } catch { /* invalid input */ }
  }

  function trimMediaBlobCache() {
    while (mediaBlobCache.size > MEDIA_CACHE_MAX_ENTRIES) {
      mediaBlobCache.delete(mediaBlobCache.keys().next().value);
    }
  }

  function wait(milliseconds) {
    return new Promise((resolve) => (root?.setTimeout || setTimeout)(resolve, milliseconds));
  }

  function transientMediaStatus(status) {
    return [404, 408, 425, 429].includes(status) || status >= 500;
  }

  async function fetchMediaBlob(owner, input, options = {}) {
    const applicationOrigin = root && root.location ? root.location.origin : 'https://local.invalid';
    const url = new URL(mediaEndpoint(), applicationOrigin);
    if (url.origin !== applicationOrigin) throw new ContentLibraryError('INVALID_CONTENT_ENDPOINT', 400);
    const values = {
      scope: owner.scope,
      materialKind: owner.materialKind,
      materialId: owner.materialId,
      ref: typeof input.reference === 'string' ? input.reference.trim().toLowerCase() : '',
      repo: validateRepositoryId(input.repositoryId)
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    let forceRefresh = Boolean(options.forceRefresh);
    let lastError = null;
    for (let attempt = 0; attempt < MEDIA_RETRY_DELAYS_MS.length; attempt += 1) {
      if (MEDIA_RETRY_DELAYS_MS[attempt]) await wait(MEDIA_RETRY_DELAYS_MS[attempt]);
      const token = await accessToken(forceRefresh);
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = (root?.setTimeout || setTimeout)(() => controller?.abort(), MEDIA_FETCH_TIMEOUT_MS);
      let response;
      try {
        response = await root.fetch(url, {
          method: 'GET',
          cache: 'default',
          credentials: 'same-origin',
          headers: { Accept: 'image/*', Authorization: `Bearer ${token}` },
          ...(controller ? { signal: controller.signal } : {})
        });
      } catch (error) {
        lastError = new ContentLibraryError(
          error?.name === 'AbortError' ? 'CONTENT_REPOSITORY_TIMEOUT' : 'CONTENT_REPOSITORY_UNAVAILABLE',
          error?.name === 'AbortError' ? 504 : 503
        );
        if (attempt + 1 < MEDIA_RETRY_DELAYS_MS.length) continue;
        throw lastError;
      } finally {
        (root?.clearTimeout || clearTimeout)(timeout);
      }
      if (response.status === 401 && !forceRefresh) {
        forceRefresh = true;
        lastError = new ContentLibraryError('AUTH_EXPIRED', 401);
        continue;
      }
      if (!response.ok) {
        let payload = {};
        try { payload = await response.json(); } catch { /* binary endpoint */ }
        lastError = new ContentLibraryError(payload.error || 'CONTENT_REPOSITORY_UNAVAILABLE', response.status);
        if (transientMediaStatus(response.status) && attempt + 1 < MEDIA_RETRY_DELAYS_MS.length) continue;
        throw lastError;
      }
      const blob = await response.blob();
      if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) {
        throw new ContentLibraryError('MEDIA_INVALID', 422);
      }
      return blob;
    }
    throw lastError || new ContentLibraryError('CONTENT_REPOSITORY_UNAVAILABLE', 503);
  }

  function readMediaBlob(input = {}, options = {}) {
    const owner = normalizeMediaOwner(input);
    const key = mediaBlobCacheKey(owner, input.reference, input.repositoryId);
    const cached = mediaBlobCache.get(key);
    if (!options.bypassCache && cached && cached.expiresAt > Date.now()) return cached.promise;
    if (cached) mediaBlobCache.delete(key);
    const promise = fetchMediaBlob(owner, input, options).catch((error) => {
      if (mediaBlobCache.get(key)?.promise === promise) mediaBlobCache.delete(key);
      throw error;
    });
    mediaBlobCache.set(key, { promise, expiresAt: Date.now() + MEDIA_CACHE_TTL_MS });
    trimMediaBlobCache();
    return promise;
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

  function examUrl(rawExamId, rawRepositoryId = '', materialId = '') {
    const examId = validateFilename('exam', rawExamId);
    const repositoryId = validateRepositoryId(rawRepositoryId);
    const params = new URLSearchParams({ exam: examId });
    if (repositoryId) params.set('repo', repositoryId);
    if (/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(materialId || '')) params.set('material', materialId);
    return `/members/module/exam/?${params.toString()}`;
  }

  function presentationUrl(rawPresentationId, rawRepositoryId = '', materialId = '') {
    const presentationId = validateFilename('presentation', rawPresentationId);
    const repositoryId = validateRepositoryId(rawRepositoryId);
    const params = new URLSearchParams({ presentation: presentationId });
    if (repositoryId) params.set('repo', repositoryId);
    if (/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(materialId || '')) params.set('material', materialId);
    return `/members/module/presentation/?${params.toString()}`;
  }

  function quizUrl(rawQuizId, rawRepositoryId = '', materialId = '') {
    const quizId = validateFilename('quiz', rawQuizId);
    const repositoryId = validateRepositoryId(rawRepositoryId);
    const params = new URLSearchParams({ quiz: quizId });
    if (repositoryId) params.set('repo', repositoryId);
    if (/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(materialId || '')) params.set('material', materialId);
    return `/members/module/quiz/?${params.toString()}`;
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
    readExam,
    readPresentation,
    readPrompt,
    readQuiz,
    readLesson,
    readQuestionBank,
    repositories,
    remove,
    removeMedia,
    save,
    search,
    status,
    listMedia,
    readMediaBlob,
    uploadMedia,
    uploadExamMedia,
    lessonUrl,
    examUrl,
    presentationUrl,
    quizUrl,
    validateFilename,
    validateRepositoryId,
    _test: {
      endpoint,
      clearMediaCache() { mediaBlobCache.clear(); },
      mediaCacheSize() { return mediaBlobCache.size; }
    }
  };
});
