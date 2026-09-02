(function () {
  'use strict';

  const CONTENT_URL = '/members/dashboard.md';
  const LOGIN_URL = '/login/?loggedout=1';
  const ADMIN_USERS_URL = '/.netlify/functions/admin-users';
  const ADMIN_FORMS_URL = '/.netlify/functions/admin-forms';
  const ADMIN_DASHBOARD_URL = '/.netlify/functions/admin-dashboard';
  const ADMIN_EXAMS_URL = '/.netlify/functions/admin-exams';
  const ADMIN_CONTENT_REPOSITORIES_URL = '/.netlify/functions/admin-content-repositories';
  const PAYMENT_ADMIN_URL = '/.netlify/functions/payment-admin';
  const PAYMENT_CONFIG_URL = '/.netlify/functions/payment-config';
  const ADMIN_PROGRESS_URL = '/.netlify/functions/admin-progress';
  const ADMIN_AI_URL = '/.netlify/functions/admin-ai';
  const ADMIN_AI_USAGE_URL = '/.netlify/functions/admin-ai-usage';
  const ADMIN_PROGRESS_PAGE_SIZE = 30;
  const ADMIN_AI_USERS_PAGE_SIZE = 25;
  const THEME_STORAGE_KEY = 'chem.theme';
  const SIDEBAR_STORAGE_KEY = 'chem.sidebar';
  const MOBILE_SIDEBAR_QUERY = '(max-width: 920px)';
  const REQUIRED_HELP_SECTION_LINES = Object.freeze([
    '## Pomoc i konto',
    '',
    'Zarządzaj dostępem albo skontaktuj się z prowadzącym.',
    '',
    '> Imię i nazwisko zmienisz po kliknięciu swojej karty konta w menu.',
    '',
    '- [Status dostępu](/time) — Sprawdź rolę i czas pozostały do końca dostępu.',
    '- [Napisz do nas](/members/module/contact/?internal=Wiadomo%C5%9B%C4%87%20z%20panelu%20kursanta) — Wyślij wiadomość bez opuszczania platformy.'
  ]);
  const REQUIRED_HELP_SECTION = REQUIRED_HELP_SECTION_LINES.join('\n');
  const ACCESS_ROLE_OPTIONS = Object.freeze([
    { value: '', label: 'Brak dostępu' },
    { value: 'active', label: 'Stały dostęp' },
    { value: 'hour', label: '1 godzina' },
    { value: 'day', label: '1 dzień' },
    { value: 'week', label: '1 tydzień' },
    { value: 'month', label: '1 miesiąc' },
    { value: 'halfyear', label: 'Pół roku' },
    { value: 'year', label: '1 rok' }
  ]);
  const COURSE_ROLE_VALUES = new Set(ACCESS_ROLE_OPTIONS.map((role) => role.value).filter(Boolean));
  const ADMIN_ROLE_VALUES = new Set(['admin', ...COURSE_ROLE_VALUES]);
  const AI_LIMIT_PERIODS = Object.freeze(['hour', 'day', 'week', 'month', 'lifetime']);
  const AI_LIMIT_METRICS = Object.freeze(['requests', 'inputTokens', 'outputTokens', 'totalTokens', 'estimatedCostMicros']);
  const ADMIN_ERROR_MESSAGES = Object.freeze({
    ADMIN_REQUIRED: 'Ta operacja jest dostępna tylko dla administratora.',
    ACCESS_EXPIRED: 'Dostęp do kursu wygasł. Zaloguj się ponownie po odnowieniu dostępu.',
    ACCESS_REQUIRED: 'To konto nie ma aktywnego dostępu do kursu.',
    AUTH_EXPIRED: 'Sesja administratora wygasła. Zaloguj się ponownie.',
    AUTH_REQUIRED: 'Zaloguj się ponownie, aby zarządzać kontami.',
    AI_CONFIG_CONFLICT: 'Konfiguracja AI została zmieniona równocześnie. Odśwież listę i spróbuj ponownie.',
    AI_CONFIG_NOT_FOUND: 'Nie znaleziono tej konfiguracji AI.',
    AI_INVALID_KEY: 'Dostawca odrzucił klucz API.',
    AI_MODEL_UNAVAILABLE: 'Wybrany model jest niedostępny dla tego klucza.',
    AI_NOT_CONFIGURED: 'Nie skonfigurowano jeszcze dostawcy AI.',
    AI_PROVIDER_ERROR: 'Dostawca AI jest chwilowo niedostępny.',
    AI_RATE_LIMITED: 'Dostawca AI ograniczył liczbę żądań. Spróbuj ponownie później.',
    AI_SECRET_MISSING: 'Najpierw ustaw klucz API dla tej konfiguracji.',
    AI_STORAGE_INVALID: 'Zapisana konfiguracja AI jest uszkodzona.',
    AI_STORAGE_UNAVAILABLE: 'Magazyn konfiguracji AI jest chwilowo niedostępny.',
    AI_LIMIT_STORAGE_INVALID: 'Magazyn limitów AI zawiera nieprawidłowe dane.',
    AI_LIMIT_STORAGE_UNAVAILABLE: 'Magazyn limitów i użycia AI jest chwilowo niedostępny.',
    AI_LIMIT_CONFLICT: 'Użycie AI zmieniło się równocześnie. Odśwież dane i spróbuj ponownie.',
    AI_CONCURRENT_REQUEST_LIMIT_REACHED: 'Trwa zbyt wiele równoległych wywołań AI. Spróbuj ponownie za chwilę.',
    AI_COST_ESTIMATE_UNAVAILABLE: 'Nie można bezpiecznie oszacować kosztu tego wywołania. Uzupełnij cennik konfiguracji AI.',
    AI_USAGE_RESET_BUSY: 'Nie można wyzerować użycia, gdy trwa wywołanie AI. Spróbuj ponownie za chwilę.',
    AI_FALLBACK_CYCLE: 'Fallback AI tworzy niedozwoloną pętlę.',
    INVALID_AI_FALLBACK: 'Wybrany fallback AI jest nieprawidłowy.',
    INVALID_AI_LIMIT_TIMEZONE: 'Podaj poprawną strefę czasową IANA, np. Europe/Warsaw.',
    INVALID_AI_LIMIT_VALUE: 'Limit musi być pusty albo dodatnią liczbą całkowitą (zero blokuje użycie).',
    INVALID_AI_PRICING: 'Cena tokenów musi być nieujemną liczbą.',
    INVALID_AI_WARNING_THRESHOLDS: 'Progi ostrzeżeń muszą rosnąć i mieścić się od 1 do 100%.',
    RESET_CONFIRMATION_REQUIRED: 'Reset użycia wymaga wyraźnego potwierdzenia.',
    INVALID_AI_ACTION: 'Wybrano nieprawidłową operację AI.',
    INVALID_AI_CONFIG: 'Uzupełnij nazwę, dostawcę i poprawny identyfikator modelu.',
    INVALID_AI_CONFIG_ID: 'Identyfikator konfiguracji AI jest nieprawidłowy.',
    INVALID_AI_MODULE: 'Wybrano nieprawidłowy moduł AI.',
    INVALID_AI_PROVIDER: 'Wybrano nieobsługiwanego dostawcę AI.',
    INVALID_AI_SECRET: 'Klucz API ma nieprawidłowy format.',
    UNEXPECTED_FIELDS: 'Żądanie zawiera nieobsługiwane pola.',
    CANNOT_DELETE_SELF: 'Nie możesz usunąć własnego konta administratora.',
    CANNOT_REMOVE_OWN_ADMIN: 'Nie możesz odebrać roli administratora własnemu kontu.',
    CONTENT_CATALOG_INVALID: 'Plik catalog.json w repozytorium materiałów jest nieprawidłowy.',
    CONTENT_DIRECTORY_NOT_FOUND: 'W prywatnym repozytorium brakuje folderu lessons lub prompts.',
    CONTENT_REPOSITORIES_ENV_TOO_LARGE: 'Lista repozytoriów przekracza limit wartości ENV Netlify. Skróć nazwy lub katalogi albo zmniejsz liczbę pozycji.',
    CONTENT_REPOSITORY_NOT_CONFIGURED: 'Dodaj zmienne GITHUB_CONTENT_* w Netlify.',
    CONTENT_REPOSITORY_INVALID_RESPONSE: 'GitHub zwrócił nieprawidłową odpowiedź dla wskazanego repozytorium lub katalogu.',
    CONTENT_REPOSITORY_NOT_FOUND: 'Nie znaleziono repozytorium, katalogu lub wybranej gałęzi.',
    CONTENT_REPOSITORY_UNAVAILABLE: 'GitHub jest chwilowo niedostępny.',
    CONTENT_REPOSITORY_ADMIN_UNAVAILABLE: 'Konfigurator repozytoriów jest chwilowo niedostępny.',
    CONTENT_REPOSITORY_BRANCH_NOT_FOUND: 'Nie znaleziono wskazanej gałęzi w tym repozytorium. Sprawdź pole „Gałąź” (np. main).',
    CONTENT_REPOSITORY_CONFIG_PENDING_DEPLOY: 'W Netlify jest już nowsza konfiguracja oczekująca na deploy. Uruchom deploy, poczekaj na jego zakończenie i odśwież stronę.',
    CONTENT_REPOSITORY_DEFAULT_REQUIRED: 'Wybierz dokładnie jedno repozytorium domyślne.',
    CONTENT_REPOSITORY_DEFAULT_ID_RESERVED: 'ID „default” jest zarezerwowane dla repozytorium domyślnego. Zaznacz ten wpis jako domyślny albo nadaj mu inne ID.',
    CONTENT_REPOSITORY_PRODUCTION_REQUIRED: 'Repozytoria można zmieniać tylko z produkcyjnego wdrożenia ChemDisk. Otwórz główny adres witryny Netlify.',
    CONTENT_REPOSITORY_ROOT_NOT_DIRECTORY: 'Wskazany katalog główny jest plikiem, a nie folderem. Popraw pole „Katalog główny”.',
    CONTENT_REPOSITORY_SHARED_TOKEN_CONFLICT: 'Repozytoria korzystające z tej samej zmiennej ENV otrzymały różne tokeny. Wklej ten sam token tylko raz albo użyj osobnych zmiennych GITHUB_CONTENT_TOKEN_*.',
    GITHUB_CONTENT_RATE_LIMITED: 'GitHub wyczerpał limit zapytań dla tego tokenu. Poczekaj na odnowienie limitu i spróbuj ponownie.',
    INVALID_CONTENT_REPOSITORIES: 'Uzupełnij poprawnie ID, nazwę, owner/repo, gałąź i opcjonalny katalog każdego repozytorium.',
    INVALID_CONTENT_REPOSITORY_ACTION: 'Wybrano nieprawidłową operację repozytorium.',
    INVALID_GITHUB_CONTENT_TOKEN: 'Token GitHub ma nieprawidłowy format.',
    GITHUB_CONTENT_TOKEN_REQUIRED: 'Wklej token GitHub albo utwórz wskazaną zmienną GITHUB_CONTENT_TOKEN_* ręcznie w Netlify i wykonaj deploy.',
    CONTENT_WRITE_CONFLICT: 'Plik został w międzyczasie zmieniony. Wczytaj najnowszą wersję i spróbuj ponownie.',
    DASHBOARD_CONFLICT: 'Dashboard został w międzyczasie zmieniony. Wczytaj najnowszą wersję i ponów edycję.',
    DASHBOARD_INVALID: 'Treść dashboardu jest nieprawidłowa.',
    DASHBOARD_STORAGE_INVALID: 'Zapisana wersja dashboardu jest uszkodzona. Aktywuj wersję z wdrożenia.',
    DASHBOARD_STORAGE_UNAVAILABLE: 'Magazyn dashboardu jest chwilowo niedostępny.',
    DASHBOARD_OVERRIDE_NOT_SET: 'Aktywna jest wersja dashboardu z wdrożenia.',
    DASHBOARD_STORE_UNAVAILABLE: 'Magazyn dashboardu jest chwilowo niedostępny.',
    DELETE_CAPABILITY_EXPIRED: 'Potwierdzenie usunięcia wygasło. Odśwież zgłoszenia i spróbuj ponownie.',
    DELETE_CAPABILITY_INVALID: 'Potwierdzenie usunięcia jest nieprawidłowe. Odśwież zgłoszenia.',
    DELETE_CAPABILITY_REQUIRED: 'Odśwież zgłoszenia przed próbą usunięcia.',
    EXPECTED_ETAG_REQUIRED: 'Wczytaj dashboard ponownie przed zapisaniem zmian.',
    FIRST_AND_LAST_NAME_REQUIRED: 'Uzupełnij poprawne imię i nazwisko użytkownika.',
    FORM_NOT_FOUND: 'Nie znaleziono tego formularza.',
    GITHUB_CONTENT_TOKEN_REJECTED: 'Token GitHub jest nieprawidłowy albo nie ma dostępu Contents do wskazanego repozytorium.',
    GITHUB_CONTENT_WRITE_REJECTED: 'Token GitHub nie ma uprawnienia Contents: Read and write do wybranego repozytorium.',
    IDENTITY_ADMIN_UNAVAILABLE: 'Administracja kontami jest chwilowo niedostępna.',
    IDENTITY_DELETE_FAILED: 'Nie udało się usunąć konta z Identity.',
    IDENTITY_INVITE_FAILED: 'Nie udało się wysłać zaproszenia przez Identity.',
    IDENTITY_REQUEST_FAILED: 'Nie udało się pobrać danych konta z Identity.',
    IDENTITY_RESPONSE_INVALID: 'Identity zwróciło nieprawidłowe dane konta.',
    IDENTITY_UNAVAILABLE: 'Nie udało się połączyć z usługą kont.',
    IDENTITY_UPDATE_FAILED: 'Nie udało się zapisać zmian w Identity.',
    INVALID_BODY: 'Dane zmiany konta są nieprawidłowe.',
    INVALID_FIRST_NAME: 'Podaj poprawne imię (od 2 do 80 znaków).',
    INVALID_EMAIL: 'Podaj poprawny adres e-mail.',
    INVALID_ETAG: 'Wersja dashboardu jest nieprawidłowa. Wczytaj ją ponownie.',
    INVALID_FORM_ID: 'Identyfikator formularza jest nieprawidłowy.',
    INVALID_JSON: 'Dane zmiany konta są nieprawidłowe.',
    INVALID_LAST_NAME: 'Podaj poprawne nazwisko (od 2 do 80 znaków).',
    INVALID_MARKDOWN: 'Treść dashboardu jest nieprawidłowa.',
    MARKDOWN_TOO_LARGE: 'Dashboard jest zbyt duży.',
    INVALID_ROLES: 'Wybrano nieprawidłową rolę.',
    INVALID_USER_ID: 'Identyfikator użytkownika jest nieprawidłowy.',
    INVITE_CREATED_PROFILE_UPDATE_FAILED: 'Zaproszenie wysłano, ale nie udało się nadać profilu lub roli. Sprawdź konto w Identity.',
    JSON_REQUIRED: 'Żądanie zmiany konta ma nieprawidłowy format.',
    MULTIPLE_ACCESS_ROLES: 'Wybierz tylko jeden rodzaj dostępu do kursu.',
    NETLIFY_FORMS_DELETE_FAILED: 'Netlify nie usunął zgłoszenia. Spróbuj ponownie.',
    NETLIFY_FORMS_NOT_CONFIGURED: 'Dodaj NETLIFY_API_TOKEN w zmiennych środowiskowych Netlify (zakres Functions).',
    NETLIFY_FORMS_REQUEST_FAILED: 'Netlify Forms odrzucił żądanie.',
    NETLIFY_FORMS_RESOURCE_NOT_FOUND: 'Nie znaleziono formularza lub zgłoszenia w tej witrynie.',
    NETLIFY_FORMS_RESPONSE_INVALID: 'Netlify Forms zwrócił nieprawidłowe dane.',
    NETLIFY_FORMS_TOKEN_REJECTED: 'NETLIFY_API_TOKEN jest nieprawidłowy albo nie ma dostępu do tej witryny.',
    NETLIFY_FORMS_UNAVAILABLE: 'Nie udało się połączyć z Netlify Forms.',
    NETLIFY_BUILDS_STOPPED: 'Buildy tego projektu są zatrzymane w Netlify. Włącz je i spróbuj ponownie.',
    NETLIFY_CONTENT_CONFIG_NOT_CONFIGURED: 'Dodaj jednorazowo NETLIFY_API_TOKEN w Netlify. SITE_ID jest ustawiane automatycznie.',
    NETLIFY_CONTENT_CONFIG_RESPONSE_INVALID: 'Netlify zwrócił nieprawidłową odpowiedź konfiguracji.',
    NETLIFY_CONTENT_CONFIG_SITE_NOT_FOUND: 'NETLIFY_API_TOKEN nie ma dostępu do tego projektu Netlify.',
    NETLIFY_CONTENT_CONFIG_TOKEN_REJECTED: 'NETLIFY_API_TOKEN jest nieprawidłowy albo nie może edytować tego projektu.',
    NETLIFY_CONTENT_CONFIG_UNAVAILABLE: 'API Netlify jest chwilowo niedostępne.',
    NETLIFY_CONTENT_CONFIG_WRITE_FAILED: 'Netlify nie zapisał zmiennych środowiskowych.',
    NETLIFY_CONTENT_SECRET_WRITE_FAILED: 'Netlify nie zapisał tokenu jako sekretu. Żadna jawna wersja PAT nie została utworzona; sprawdź ustawienia ENV i spróbuj ponownie.',
    NETLIFY_DEPLOY_START_FAILED: 'Netlify nie uruchomił deployu. Sprawdź stan projektu i spróbuj ponownie przyciskiem „Uruchom tylko deploy”.',
    NETLIFY_SECRETS_CONTROLLER_REQUIRED: 'Automatyczny zapis PAT wymaga Netlify Secrets Controller (plan Personal lub wyższy). Na Free utwórz wskazaną zmienną GITHUB_CONTENT_TOKEN_* ręcznie, wykonaj deploy i pozostaw pole tokenu puste.',
    NO_CHANGES: 'Nie wskazano żadnych zmian do zapisania.',
    INVALID_PAYMENT_ACTION: 'Wybrano nieprawidłową operację płatności.',
    INVALID_PAYMENT_ENABLED_SETTING: 'Ustawienie dostępności płatności jest nieprawidłowe.',
    INVALID_CURRENCY: 'Wybierz obsługiwaną walutę.',
    INVALID_ENABLED_PLANS: 'Lista dostępnych pakietów jest nieprawidłowa.',
    INVALID_PRICE: 'Cena musi wynosić od 1,00 do 10 000,00 jednostek wybranej waluty.',
    INVALID_STACKING_SETTING: 'Ustawienie przedłużania jest nieprawidłowe.',
    PAYMENT_CONFIG_CONFLICT: 'Ceny zostały w międzyczasie zmienione. Wczytaj je ponownie.',
    PAYMENT_CONFIG_INVALID: 'Zapisana konfiguracja cen jest nieprawidłowa.',
    PAYMENT_HISTORY_DELETE_FAILED: 'Konto usunięto z Identity, ale nie udało się usunąć historii płatności. Kliknij „Usuń konto” ponownie, aby dokończyć czyszczenie.',
    PAYMENT_LEDGER_CONFLICT: 'Historia płatności zmieniła się w tym samym czasie. Spróbuj ponownie.',
    PAYMENT_LEDGER_INVALID: 'Historia płatności użytkownika jest uszkodzona.',
    PAYMENT_STORAGE_UNAVAILABLE: 'Magazyn płatności jest chwilowo niedostępny.',
    STRIPE_NOT_CONFIGURED: 'Dodaj klucze Stripe w zmiennych środowiskowych Netlify.',
    REQUEST_TOO_LARGE: 'Przesłano zbyt dużo danych.',
    SAME_ORIGIN_REQUIRED: 'Ze względów bezpieczeństwa odśwież panel i spróbuj ponownie.',
    SESSION_CHECK_UNAVAILABLE: 'Nie udało się potwierdzić bieżącej sesji administratora.',
    SESSION_REPLACED: 'To konto zalogowało się na innym urządzeniu. Zaloguj się ponownie.',
    SUBMISSION_NOT_FOUND: 'Nie znaleziono tego zgłoszenia.',
    USER_ALREADY_EXISTS_OR_INVITE_REJECTED: 'Konto już istnieje albo Identity odrzuciło zaproszenie.',
    USER_NOT_FOUND: 'Nie znaleziono tego użytkownika.'
  });

  const elements = {
    body: document.body,
    content: document.getElementById('markdown-sections'),
    title: document.getElementById('dashboard-title'),
    intro: document.getElementById('dashboard-intro'),
    message: document.getElementById('dashboard-message'),
    resourceCount: document.getElementById('resource-count'),
    nav: document.getElementById('course-nav'),
    topbar: document.querySelector('.topbar'),
    search: document.getElementById('resource-search'),
    emptySearch: document.getElementById('empty-search'),
    clearSearch: document.getElementById('clear-search'),
    menuButton: document.getElementById('menu-button'),
    themeToggle: document.getElementById('theme-toggle'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    logoutButton: document.getElementById('logout-button'),
    profileDialog: document.getElementById('profile-dialog'),
    profileForm: document.getElementById('profile-form'),
    profileFirstName: document.getElementById('profile-first-name'),
    profileLastName: document.getElementById('profile-last-name'),
    profileMessage: document.getElementById('profile-message'),
    profileSave: document.getElementById('profile-save'),
    profilePasswordForm: document.getElementById('profile-password-form'),
    profilePasswordEmail: document.getElementById('profile-password-email'),
    profileCurrentPassword: document.getElementById('profile-current-password'),
    profileNewPassword: document.getElementById('profile-new-password'),
    profileConfirmPassword: document.getElementById('profile-confirm-password'),
    profilePasswordMessage: document.getElementById('profile-password-message'),
    profilePasswordSubmit: document.getElementById('profile-password-submit'),
    profileResetProgress: document.getElementById('profile-reset-progress'),
    profileProgressMessage: document.getElementById('profile-progress-message'),
    profileClose: document.getElementById('profile-close'),
    profileCancel: document.getElementById('profile-cancel'),
    adminButton: document.getElementById('admin-panel-button'),
    contentStudioLink: document.getElementById('content-studio-link'),
    adminDialog: document.getElementById('admin-dialog'),
    adminClose: document.getElementById('admin-close'),
    adminSearch: document.getElementById('admin-user-search'),
    adminRefresh: document.getElementById('admin-refresh'),
    adminExportJson: document.getElementById('admin-export-json'),
    adminExportXml: document.getElementById('admin-export-xml'),
    adminStatus: document.getElementById('admin-status'),
    adminUserList: document.getElementById('admin-user-list'),
    adminEmpty: document.getElementById('admin-empty'),
    adminTabs: Array.from(document.querySelectorAll('[data-admin-tab]')),
    adminPanels: Array.from(document.querySelectorAll('[data-admin-panel]')),
    adminInviteForm: document.getElementById('admin-invite-form'),
    adminInviteEmail: document.getElementById('admin-invite-email'),
    adminInviteFirstName: document.getElementById('admin-invite-first-name'),
    adminInviteLastName: document.getElementById('admin-invite-last-name'),
    adminInviteRole: document.getElementById('admin-invite-role'),
    adminInviteIsAdmin: document.getElementById('admin-invite-is-admin'),
    adminInviteMessage: document.getElementById('admin-invite-message'),
    adminInviteSubmit: document.getElementById('admin-invite-submit'),
    adminFormFilter: document.getElementById('admin-form-filter'),
    adminFormsRefresh: document.getElementById('admin-forms-refresh'),
    adminFormsExport: document.getElementById('admin-forms-export'),
    adminFormsStatus: document.getElementById('admin-forms-status'),
    adminSubmissionList: document.getElementById('admin-submission-list'),
    adminFormsEmpty: document.getElementById('admin-forms-empty'),
    adminDashboardSource: document.getElementById('admin-dashboard-source'),
    adminDashboardReload: document.getElementById('admin-dashboard-reload'),
    adminDashboardRestore: document.getElementById('admin-dashboard-restore'),
    adminDashboardPreviewButton: document.getElementById('admin-dashboard-preview-button'),
    adminDashboardSave: document.getElementById('admin-dashboard-save'),
    adminDashboardStatus: document.getElementById('admin-dashboard-status'),
    adminDashboardPreview: document.getElementById('admin-dashboard-preview'),
    adminContentConnection: document.getElementById('admin-content-connection'),
    adminContentRepositorySelect: document.getElementById('admin-content-repository-select'),
    adminContentRepository: document.getElementById('admin-content-repository'),
    adminContentLessons: document.getElementById('admin-content-lessons'),
    adminContentPrompts: document.getElementById('admin-content-prompts'),
    adminContentStatus: document.getElementById('admin-content-status'),
    adminContentRefresh: document.getElementById('admin-content-refresh'),
    adminContentCopyEnv: document.getElementById('admin-content-copy-env'),
    adminContentEnvTemplate: document.getElementById('admin-content-env-template'),
    adminContentConfigList: document.getElementById('admin-content-config-list'),
    adminContentConfigStatus: document.getElementById('admin-content-config-status'),
    adminContentConfigAdd: document.getElementById('admin-content-config-add'),
    adminContentConfigSave: document.getElementById('admin-content-config-save'),
    adminContentConfigSaveDeploy: document.getElementById('admin-content-config-save-deploy'),
    adminContentConfigDeploy: document.getElementById('admin-content-config-deploy'),
    adminProgressGlobalTracking: document.getElementById('admin-progress-global-tracking'),
    adminProgressGlobalShow: document.getElementById('admin-progress-global-show'),
    adminProgressRecordOpens: document.getElementById('admin-progress-record-opens'),
    adminProgressSaveSettings: document.getElementById('admin-progress-save-settings'),
    adminProgressMetrics: document.getElementById('admin-progress-metrics'),
    adminProgressSearch: document.getElementById('admin-progress-search'),
    adminProgressFilter: document.getElementById('admin-progress-filter'),
    adminProgressSort: document.getElementById('admin-progress-sort'),
    adminProgressRefresh: document.getElementById('admin-progress-refresh'),
    adminProgressStatus: document.getElementById('admin-progress-status'),
    adminProgressUserList: document.getElementById('admin-progress-user-list'),
    adminProgressMore: document.getElementById('admin-progress-more'),
    adminProgressDetail: document.getElementById('admin-progress-detail'),
    adminProgressGlobalReport: document.getElementById('admin-progress-global-report'),
    adminProgressAudit: document.getElementById('admin-progress-audit'),
    adminAiConfigForm: document.getElementById('admin-ai-config-form'),
    adminAiConfigId: document.getElementById('admin-ai-config-id'),
    adminAiName: document.getElementById('admin-ai-name'),
    adminAiProvider: document.getElementById('admin-ai-provider'),
    adminAiModel: document.getElementById('admin-ai-model'),
    adminAiModelList: document.getElementById('admin-ai-model-list'),
    adminAiDescription: document.getElementById('admin-ai-description'),
    adminAiEditorTitle: document.getElementById('admin-ai-editor-title'),
    adminAiStatus: document.getElementById('admin-ai-status'),
    adminAiSave: document.getElementById('admin-ai-save'),
    adminAiNew: document.getElementById('admin-ai-new'),
    adminAiRefresh: document.getElementById('admin-ai-refresh'),
    adminAiModelsRefresh: document.getElementById('admin-ai-models-refresh'),
    adminAiSecretBox: document.getElementById('admin-ai-secret-box'),
    adminAiSecretState: document.getElementById('admin-ai-secret-state'),
    adminAiSecret: document.getElementById('admin-ai-secret'),
    adminAiSecretActions: document.getElementById('admin-ai-secret-actions'),
    adminAiSecretSave: document.getElementById('admin-ai-secret-save'),
    adminAiSecretRemove: document.getElementById('admin-ai-secret-remove'),
    adminAiModuleChat: document.getElementById('admin-ai-module-chat'),
    adminAiModuleGrader: document.getElementById('admin-ai-module-grader'),
    adminAiModuleForms: document.getElementById('admin-ai-module-forms'),
    adminAiModuleOther: document.getElementById('admin-ai-module-other'),
    adminAiList: document.getElementById('admin-ai-list'),
    adminAiEmpty: document.getElementById('admin-ai-empty'),
    adminAiAudit: document.getElementById('admin-ai-audit'),
    adminAiAuditList: document.getElementById('admin-ai-audit-list'),
    adminAiUsagePeriod: document.getElementById('admin-ai-usage-period'),
    adminAiUsageRefresh: document.getElementById('admin-ai-usage-refresh'),
    adminAiUsageStatus: document.getElementById('admin-ai-usage-status'),
    adminAiUsageSummary: document.getElementById('admin-ai-usage-summary'),
    adminAiUsageTimezone: document.getElementById('admin-ai-usage-timezone'),
    adminAiUsageCurrency: document.getElementById('admin-ai-usage-currency'),
    adminAiUsageShowUser: document.getElementById('admin-ai-usage-show-user'),
    adminAiWarning1: document.getElementById('admin-ai-warning-1'),
    adminAiWarning2: document.getElementById('admin-ai-warning-2'),
    adminAiWarning3: document.getElementById('admin-ai-warning-3'),
    adminAiLimitScope: document.getElementById('admin-ai-limit-scope'),
    adminAiLimitScopeIdWrap: document.getElementById('admin-ai-limit-scope-id-wrap'),
    adminAiLimitScopeId: document.getElementById('admin-ai-limit-scope-id'),
    adminAiLimitModuleWrap: document.getElementById('admin-ai-limit-module-wrap'),
    adminAiLimitModuleId: document.getElementById('admin-ai-limit-module-id'),
    adminAiLimitUserModeWrap: document.getElementById('admin-ai-limit-user-mode-wrap'),
    adminAiLimitUserMode: document.getElementById('admin-ai-limit-user-mode'),
    adminAiConfigPolicy: document.getElementById('admin-ai-config-policy'),
    adminAiPriceInput: document.getElementById('admin-ai-price-input'),
    adminAiPriceOutput: document.getElementById('admin-ai-price-output'),
    adminAiFallback: document.getElementById('admin-ai-fallback'),
    adminAiLimitGrid: document.getElementById('admin-ai-limit-grid'),
    adminAiUsageSave: document.getElementById('admin-ai-usage-save'),
    adminAiUsageProviders: document.getElementById('admin-ai-usage-providers'),
    adminAiUsageModels: document.getElementById('admin-ai-usage-models'),
    adminAiUsageConfigs: document.getElementById('admin-ai-usage-configs'),
    adminAiUsageModules: document.getElementById('admin-ai-usage-modules'),
    adminAiUsageUsers: document.getElementById('admin-ai-usage-users'),
    adminAiUsersSearch: document.getElementById('admin-ai-users-search'),
    adminAiUsersCount: document.getElementById('admin-ai-users-count'),
    adminAiUsersMore: document.getElementById('admin-ai-users-more'),
    adminAiUserDetail: document.getElementById('admin-ai-user-detail'),
    adminAiUsageAudit: document.getElementById('admin-ai-usage-audit'),
    adminAiUsageAuditList: document.getElementById('admin-ai-usage-audit-list'),
    adminPricesForm: document.getElementById('admin-prices-form'),
    adminPaymentCurrency: document.getElementById('admin-payment-currency'),
    adminPaymentDisabled: document.getElementById('admin-payment-disabled'),
    adminPaymentBlockStacking: document.getElementById('admin-payment-block-stacking'),
    adminPriceHour: document.getElementById('admin-price-hour'),
    adminPriceDay: document.getElementById('admin-price-day'),
    adminPriceWeek: document.getElementById('admin-price-week'),
    adminPriceMonth: document.getElementById('admin-price-month'),
    adminPriceHalfyear: document.getElementById('admin-price-halfyear'),
    adminPriceYear: document.getElementById('admin-price-year'),
    adminEnabledHour: document.getElementById('admin-enabled-hour'),
    adminEnabledDay: document.getElementById('admin-enabled-day'),
    adminEnabledWeek: document.getElementById('admin-enabled-week'),
    adminEnabledMonth: document.getElementById('admin-enabled-month'),
    adminEnabledHalfyear: document.getElementById('admin-enabled-halfyear'),
    adminEnabledYear: document.getElementById('admin-enabled-year'),
    adminPricesStatus: document.getElementById('admin-prices-status'),
    adminPricesReload: document.getElementById('admin-prices-reload'),
    adminPricesSave: document.getElementById('admin-prices-save'),
    profileButtons: [
      document.getElementById('sidebar-profile-button'),
      document.getElementById('top-profile-button')
    ].filter(Boolean)
  };

  let currentUser = null;
  let totalResources = 0;
  let lastProfileTrigger = null;
  let lastAdminTrigger = null;
  let activeNavigationId = '';
  let navigationFrameId = null;
  let navigationIntentId = '';
  let navigationIntentDeadline = 0;
  let navigationIntentTimeout = 0;
  let navigationInitialized = false;
  let dashboardLoadId = 0;
  let adminUsers = [];
  let adminForms = [];
  let adminSubmissions = [];
  let adminFormsLoaded = false;
  let adminFormsRequestId = 0;
  let adminDashboardLoaded = false;
  let adminDashboardEtag = null;
  let adminDashboardSourceKind = 'static';
  let adminDashboardBaseline = '';
  let adminContentLoaded = false;
  let adminContentRepositories = [];
  let adminContentRepositoryId = '';
  let adminContentStatusRequestId = 0;
  let adminContentConfigLoaded = false;
  let adminContentConfigBusy = false;
  let adminContentConfigPendingDeploy = false;
  let adminContentConfigDeployQueued = false;
  let adminContentConfigBaseTokenReserved = false;
  let adminContentConfigBaseline = '';
  let adminContentConfigDrafts = [];
  let adminPricesLoaded = false;
  let adminPricesEtag = null;
  let adminProgressLoaded = false;
  let adminProgressUsers = [];
  let adminProgressUsersCursor = '';
  let adminProgressVisibleCount = ADMIN_PROGRESS_PAGE_SIZE;
  let adminProgressLoadingMore = false;
  let adminProgressActiveIds = new Set();
  let adminProgressReport = null;
  let adminProgressCatalog = null;
  let adminProgressAuditEntries = [];
  let adminProgressAuditCursor = '';
  let adminProgressAuditLoadingMore = false;
  let adminAiLoaded = false;
  let adminAiSettings = null;
  let adminAiUsageLoaded = false;
  let adminAiUsageSettings = null;
  let adminAiUsageReport = null;
  let adminAiLimitSelection = { scope: 'global', id: '' };
  let adminAiUserUsageRows = new Map();
  let adminAiUserUsagePeriod = '';
  let adminAiUserVisibleCount = ADMIN_AI_USERS_PAGE_SIZE;
  let adminAiUserUsageRequestId = 0;
  const adminAiUserUsagePending = new Set();

  function preferredTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme, persist) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    const dark = next === 'dark';
    const label = dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw';
    const themeColor = document.getElementById('theme-color');
    if (themeColor) themeColor.setAttribute('content', dark ? '#090f18' : '#edf2f7');
    if (elements.themeToggle) {
      elements.themeToggle.setAttribute('aria-label', label);
      elements.themeToggle.setAttribute('aria-pressed', String(dark));
      elements.themeToggle.title = label;
    }
    if (persist) {
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (_) {}
    }
  }

  function initializeTheme() {
    let theme = document.documentElement.dataset.theme;
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') theme = saved;
      else theme = preferredTheme();
    } catch (_) {
      theme = preferredTheme();
    }
    applyTheme(theme, false);
  }

  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  }

  function isMobileSidebar() {
    return Boolean(window.matchMedia && window.matchMedia(MOBILE_SIDEBAR_QUERY).matches);
  }

  function updateMenuButton() {
    const expanded = isMobileSidebar()
      ? elements.body.classList.contains('menu-open')
      : document.documentElement.dataset.sidebar !== 'collapsed';
    const label = isMobileSidebar()
      ? (expanded ? 'Zamknij menu' : 'Otwórz menu')
      : (expanded ? 'Zwiń menu boczne' : 'Rozwiń menu boczne');
    elements.menuButton.setAttribute('aria-expanded', String(expanded));
    elements.menuButton.setAttribute('aria-label', label);
    elements.menuButton.title = label;
  }

  function setSidebarCollapsed(collapsed, persist) {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
    if (persist) {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
      } catch (_) {}
    }
    updateMenuButton();
  }

  function initializeSidebar() {
    const collapsed = document.documentElement.dataset.sidebar === 'collapsed';
    setSidebarCollapsed(collapsed, false);
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pl')
      .trim();
  }

  function slugify(value, fallback) {
    const slug = normalizeText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || fallback;
  }

  function parseMarkdown(source) {
    if (!window.ChemDashboardParser || typeof window.ChemDashboardParser.parse !== 'function') {
      throw new Error('Parser dashboardu nie został załadowany.');
    }
    return window.ChemDashboardParser.parse(source);
  }

  function dashboardProgressCatalog(model) {
    if (!window.ChemDashboardParser || typeof window.ChemDashboardParser.toProgressCatalog !== 'function') {
      throw new Error('Generator katalogu postępu nie został załadowany.');
    }
    return window.ChemDashboardParser.toProgressCatalog(model);
  }

  async function syncDashboardProgressCatalog(model) {
    const payload = await adminProgressRequest('PUT', {
      action: 'catalog',
      catalog: dashboardProgressCatalog(model)
    });
    if (!payload?.catalog) throw new Error('Serwer nie potwierdził aktualnego katalogu postępu.');
    adminProgressCatalog = payload.catalog;
    adminProgressLoaded = false;
    return payload;
  }

  function hasRequiredHelpSection(model) {
    return Boolean(model && Array.isArray(model.sections) && model.sections.some(
      (section) => normalizeText(section && section.title) === 'pomoc i konto'
    ));
  }

  function ensureRequiredHelpSection(content) {
    const text = String(content || '').replace(/\r\n?/g, '\n').trim();
    if (!text) return text;
    return hasRequiredHelpSection(parseMarkdown(text))
      ? text
      : `${text}\n\n${REQUIRED_HELP_SECTION}`;
  }

  function ensureRequiredDashboardModel(model) {
    if (hasRequiredHelpSection(model)) return model;
    const helpSection = parseMarkdown(REQUIRED_HELP_SECTION).sections[0];
    return {
      ...model,
      sections: [...model.sections, helpSection]
    };
  }

  function safeUrl(rawHref) {
    try {
      const url = new URL(rawHref, window.location.origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      const external = url.origin !== window.location.origin;
      if (!external && /^\/members\/module\/filmv1\/?$/i.test(url.pathname)) {
        url.pathname = '/members/module/film/';
      }
      return {
        href: external ? url.href : `${url.pathname}${url.search}${url.hash}`,
        pathname: url.pathname.toLocaleLowerCase('pl'),
        external
      };
    } catch (_) {
      return null;
    }
  }

  function classifyResource(pathname) {
    if (/\/(?:film|yt)\//.test(pathname)) return { kind: 'video', icon: '▶' };
    if (/\/slides\//.test(pathname)) return { kind: 'document', icon: '▤' };
    if (/\/pdf\//.test(pathname)) return { kind: 'document', icon: 'PDF' };
    if (/\/presentation\//.test(pathname)) return { kind: 'document', icon: '▥' };
    if (/\/lesson\//.test(pathname)) return { kind: 'exercise', icon: 'L' };
    if (/\/quiz\//.test(pathname)) return { kind: 'exercise', icon: 'Q' };
    if (/\/exam\//.test(pathname)) return { kind: 'exercise', icon: 'E' };
    if (/\/(forms|chat)\//.test(pathname)) return { kind: 'exercise', icon: pathname.includes('/chat/') ? '✦' : '✓' };
    if (/\/(kalkulator|classic)\//.test(pathname)) return { kind: 'calculator', icon: '±' };
    if (/\/(bitpaper|whiteboard)\//.test(pathname)) return { kind: 'exercise', icon: '✎' };
    if (/\/atonom\//.test(pathname)) return { kind: 'exercise', icon: '⚛' };
    if (/\/contact\//.test(pathname)) return { kind: 'contact', icon: '✉' };
    if (/^\/time\/?$/.test(pathname)) return { kind: 'contact', icon: '◷' };
    return { kind: 'default', icon: '↗' };
  }

  function createResourceCard(item, sectionTitle, groupTitle) {
    const parsedUrl = safeUrl(item.href);
    if (!parsedUrl) return null;

    const resource = classifyResource(parsedUrl.pathname);
    const card = document.createElement('article');
    card.className = 'resource-card';
    card.dataset.kind = resource.kind;
    card.dataset.progressId = item.id || '';
    card.dataset.search = normalizeText(
      `${sectionTitle} ${groupTitle || ''} ${item.title} ${item.description} ${item.searchText || ''}`
    );

    const icon = document.createElement('span');
    icon.className = 'card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = resource.icon;
    if (resource.icon.length > 1) icon.classList.add('is-text-icon');

    const title = document.createElement('h3');
    title.textContent = item.title;

    const description = document.createElement('p');
    description.textContent = item.description || 'Otwórz materiał kursowy.';

    const openLabel = document.createElement('span');
    openLabel.className = 'card-open';
    openLabel.append(document.createTextNode('Otwórz'));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    openLabel.append(arrow);

    const link = document.createElement('a');
    link.className = 'card-link';
    if (!parsedUrl.external && item.id && /^\/members\/module\//.test(parsedUrl.pathname)) {
      const trackedUrl = new URL(parsedUrl.href, window.location.origin);
      trackedUrl.searchParams.set('material', item.id);
      link.href = `${trackedUrl.pathname}${trackedUrl.search}${trackedUrl.hash}`;
    } else {
      link.href = parsedUrl.href;
    }
    link.setAttribute('aria-label', `Otwórz: ${item.title}`);
    if (parsedUrl.external) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const externalMark = document.createElement('span');
      externalMark.className = 'external-mark';
      externalMark.setAttribute('aria-hidden', 'true');
      externalMark.textContent = '↗';
      card.append(externalMark);
    }
    const destinationTracksItself = !parsedUrl.external && /^\/members\/module\//.test(parsedUrl.pathname);
    if (item.id && !destinationTracksItself) {
      link.addEventListener('click', () => {
        window.ChemProgress?.send({
          materialId: item.id,
          materialType: item.type || 'other',
          action: 'open',
          opened: true
        }, { keepalive: true }).catch(() => {});
      });
    }

    const progressHost = document.createElement('div');
    progressHost.className = 'card-progress-host';
    progressHost.dataset.progressHost = item.id || '';
    card.append(icon, title, description, progressHost, openLabel, link);
    return card;
  }

  function setSequenceCardState(card, locked, aggregate, prerequisiteTitle) {
    const link = card.querySelector('.card-link');
    const label = card.querySelector('.card-open');
    if (!link || !label) return;
    if (!link.dataset.sequenceHref && link.getAttribute('href')) {
      link.dataset.sequenceHref = link.getAttribute('href');
    }
    card.classList.toggle('is-sequence-locked', Boolean(locked));
    card.dataset.sequenceLocked = locked ? 'true' : 'false';
    if (locked) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.tabIndex = 0;
      link.setAttribute('aria-label', `Zablokowane: ${card.dataset.sequenceTitle || 'materiał'}`);
      label.replaceChildren(document.createTextNode('Najpierw ukończ poprzedni krok '));
      const lock = document.createElement('span');
      lock.setAttribute('aria-hidden', 'true');
      lock.textContent = '🔒';
      label.append(lock);
      card.title = prerequisiteTitle ? `Najpierw ukończ: ${prerequisiteTitle}` : 'Najpierw ukończ poprzedni krok.';
      return;
    }
    if (link.dataset.sequenceHref) link.setAttribute('href', link.dataset.sequenceHref);
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.setAttribute('aria-label', `Otwórz: ${card.dataset.sequenceTitle || 'materiał'}`);
    const action = aggregate?.status === 'completed'
      ? 'Otwórz ponownie'
      : ['opened', 'in_progress'].includes(aggregate?.status) ? 'Kontynuuj' : 'Rozpocznij';
    label.replaceChildren(document.createTextNode(`${action} `));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    label.append(arrow);
    card.removeAttribute('title');
  }

  function createAccordionGroup(group, sectionTitle, parentTitles = [], depth = 0) {
    const groupPath = [...parentTitles, group.title];
    const cards = group.items
      .map((item) => createResourceCard(item, sectionTitle, groupPath.join(' › ')))
      .filter(Boolean);
    const childGroups = (group.groups || [])
      .map((child) => createAccordionGroup(child, sectionTitle, groupPath, depth + 1));
    const totalCardCount = cards.length +
      childGroups.reduce((sum, child) => sum + child.cardCount, 0);

    const details = document.createElement('details');
    details.className = 'resource-accordion';
    const sequential = group.navigation === 'sequential';
    details.classList.toggle('is-sequential', sequential);
    details.open = sequential;
    details.dataset.progressId = group.id || '';
    details.dataset.accordionDepth = String(depth);
    details.addEventListener('toggle', () => {
      if (!details.open || !group.id) return;
      window.ChemProgress?.open({ materialId: group.id, materialType: group.type || 'other' }).catch(() => {});
    });

    const summary = document.createElement('summary');
    const copy = document.createElement('span');
    copy.className = 'accordion-copy';
    const title = document.createElement('strong');
    title.textContent = group.title;
    copy.append(title);
    if (group.description.length) {
      const description = document.createElement('span');
      description.textContent = group.description.join(' ');
      copy.append(description);
    }

    const meta = document.createElement('span');
    meta.className = 'accordion-meta';
    const total = document.createElement('span');
    total.dataset.accordionTotal = String(totalCardCount);
    total.textContent = resourceLabel(totalCardCount);
    const chevron = document.createElement('span');
    chevron.className = 'accordion-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '⌄';
    meta.append(total, chevron);
    summary.append(copy, meta);
    details.append(summary);

    if (sequential) {
      const sequenceLabel = document.createElement('span');
      sequenceLabel.className = 'sequence-label';
      sequenceLabel.textContent = 'Po kolei';
      copy.append(sequenceLabel);
      cards.forEach((card, index) => {
        const item = group.items[index];
        card.dataset.sequenceParent = group.id || '';
        card.dataset.sequenceIndex = String(index);
        card.dataset.sequenceTitle = item?.title || '';
        const step = document.createElement('span');
        step.className = 'sequence-step';
        step.textContent = String(index + 1);
        step.setAttribute('aria-label', `Krok ${index + 1} z ${cards.length}`);
        card.prepend(step);
        const link = card.querySelector('.card-link');
        link?.addEventListener('click', (event) => {
          if (card.dataset.sequenceLocked !== 'true') return;
          event.preventDefault();
          event.stopImmediatePropagation();
          elements.message.hidden = false;
          elements.message.className = 'dashboard-message';
          elements.message.textContent = card.title || 'Najpierw ukończ poprzedni krok organizera.';
        }, true);
        link?.addEventListener('click', async (event) => {
          if (card.dataset.sequenceLocked === 'true'
            || item?.type !== 'presentation'
            || event.button !== 0
            || event.metaKey
            || event.ctrlKey
            || event.shiftKey
            || event.altKey) return;
          const destination = link.getAttribute('href');
          if (!destination) return;
          event.preventDefault();
          const label = card.querySelector('.card-open');
          if (label) label.textContent = 'Otwieram i zaliczam…';
          const save = window.ChemProgress?.send({
            materialId: item.id,
            materialType: 'presentation',
            action: 'complete',
            opened: true
          }, { keepalive: true }).catch(() => null);
          if (save) {
            await Promise.race([
              save,
              new Promise((resolve) => window.setTimeout(resolve, 1800))
            ]);
          }
          window.location.assign(destination);
        });
        setSequenceCardState(card, index > 0, null, group.items[index - 1]?.title || '');
      });
    }

    const body = document.createElement('div');
    body.className = 'accordion-body';
    const groupProgress = document.createElement('div');
    groupProgress.className = 'container-progress-host';
    groupProgress.dataset.progressHost = group.id || '';
    body.append(groupProgress);
    group.notices.forEach((noticeText) => {
      const notice = document.createElement('p');
      notice.className = 'section-notice';
      notice.textContent = noticeText;
      body.append(notice);
    });

    if (cards.length) {
      const grid = document.createElement('div');
      grid.className = 'card-grid';
      cards.forEach((card) => grid.append(card));
      body.append(grid);
    }

    if (childGroups.length) {
      const children = document.createElement('div');
      children.className = 'accordion-children';
      childGroups.forEach((child) => children.append(child.element));
      body.append(children);
    }

    if (!cards.length && !childGroups.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-section';
      empty.textContent = 'Materiały w tej liście pojawią się wkrótce.';
      body.append(empty);
    }
    details.append(body);
    return { element: details, cardCount: totalCardCount };
  }

  function createSection(section, index, usedIds) {
    let id = slugify(section.title, `dzial-${index + 1}`);
    let suffix = 2;
    while (usedIds.has(id) || id === 'start') {
      id = `${slugify(section.title, `dzial-${index + 1}`)}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const sectionElement = document.createElement('section');
    sectionElement.className = 'course-section';
    sectionElement.id = id;
    sectionElement.dataset.sectionTitle = normalizeText(section.title);
    sectionElement.dataset.progressId = section.id || '';

    const headingRow = document.createElement('div');
    headingRow.className = 'section-heading';
    const headingCopy = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = section.title;
    headingCopy.append(heading);

    if (section.description.length) {
      const description = document.createElement('p');
      description.textContent = section.description.join(' ');
      headingCopy.append(description);
    }

    const validCards = section.items
      .map((item) => createResourceCard(item, section.title))
      .filter(Boolean);
    const groups = (section.groups || []).map((group) => createAccordionGroup(group, section.title));
    const sectionCardCount = validCards.length + groups.reduce((sum, group) => sum + group.cardCount, 0);

    const total = document.createElement('span');
    total.className = 'section-total';
    total.dataset.sectionTotal = String(sectionCardCount);
    total.textContent = resourceLabel(sectionCardCount);
    const sectionProgress = document.createElement('div');
    sectionProgress.className = 'section-progress-host';
    sectionProgress.dataset.progressHost = section.id || '';
    headingCopy.append(sectionProgress);
    headingRow.append(headingCopy, total);
    sectionElement.append(headingRow);

    section.notices.forEach((noticeText) => {
      const notice = document.createElement('p');
      notice.className = 'section-notice';
      notice.textContent = noticeText;
      sectionElement.append(notice);
    });

    if (validCards.length) {
      const grid = document.createElement('div');
      grid.className = 'card-grid';
      validCards.forEach((card) => grid.append(card));
      sectionElement.append(grid);
    }

    groups.forEach((group) => sectionElement.append(group.element));

    if (!sectionCardCount && !groups.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-section';
      empty.textContent = 'Materiały w tym dziale pojawią się wkrótce.';
      sectionElement.append(empty);
    }

    return { id, title: section.title, element: sectionElement, cardCount: sectionCardCount };
  }

  function resourceLabel(count) {
    if (count === 1) return '1 materiał';
    const lastTwo = count % 100;
    const last = count % 10;
    if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} materiały`;
    return `${count} materiałów`;
  }

  function polishCountLabel(count, singular, pluralFew, pluralMany) {
    if (count === 1) return `1 ${singular}`;
    const lastTwo = count % 100;
    const last = count % 10;
    if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} ${pluralFew}`;
    return `${count} ${pluralMany}`;
  }

  function renderNavigation(sections) {
    elements.nav.querySelectorAll('.nav-skeleton, .nav-item:not([data-static-nav])').forEach((node) => node.remove());
    sections.forEach((section) => {
      const link = document.createElement('a');
      link.className = 'nav-item';
      link.href = `#${section.id}`;
      link.dataset.sectionLink = section.id;
      const dot = document.createElement('span');
      dot.className = 'nav-dot';
      dot.setAttribute('aria-hidden', 'true');
      link.append(dot, document.createTextNode(section.title));
      elements.nav.append(link);
    });
  }

  function renderDashboard(model, forceProgress = false) {
    model = ensureRequiredDashboardModel(model);
    elements.title.textContent = model.title;
    elements.intro.textContent = model.intro.length
      ? model.intro.join(' ')
      : 'Wybierz dział i przejdź do nauki.';

    if (model.notices.length) {
      elements.message.textContent = model.notices.join(' ');
      elements.message.className = 'dashboard-message';
      elements.message.hidden = false;
    } else {
      elements.message.hidden = true;
    }

    const fragment = document.createDocumentFragment();
    const usedIds = new Set();
    const renderedSections = model.sections.map((section, index) => createSection(section, index, usedIds));
    renderedSections.forEach(({ element }) => fragment.append(element));

    totalResources = renderedSections.reduce((sum, section) => sum + section.cardCount, 0);
    elements.content.replaceChildren(fragment);
    elements.content.setAttribute('aria-busy', 'false');
    updateResourceCount(totalResources, totalResources, false);
    renderNavigation(renderedSections);
    filterResources();
    setupSectionTracking();
    hydrateDashboardProgress(model, forceProgress);
  }

  async function resetStudentProgress(materialId, title, trigger) {
    const api = window.ChemProgress;
    if (!api) return false;
    const courseReset = !materialId;
    const question = courseReset
      ? 'Zresetować cały Twój postęp kursu? Tej operacji nie można cofnąć.'
      : `Zresetować Twój postęp materiału „${title || 'Materiał'}”?`;
    if (!window.confirm(question)) return null;
    const previousText = trigger?.textContent || '';
    if (trigger) {
      trigger.disabled = true;
      trigger.textContent = 'Resetowanie…';
    }
    try {
      if (courseReset) await api.resetAll();
      else await api.reset(materialId);
      await hydrateDashboardProgress(null, true);
      return true;
    } catch (error) {
      console.warn('Nie udało się zresetować postępu', error?.code || error?.message || error);
      return false;
    } finally {
      if (trigger?.isConnected) {
        trigger.disabled = false;
        trigger.textContent = previousText;
      }
    }
  }

  function studentResetButton(label, materialId, title) {
    const button = document.createElement('button');
    button.className = 'student-progress-reset';
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', materialId ? `Resetuj postęp: ${title}` : 'Resetuj cały mój postęp kursu');
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const reset = await resetStudentProgress(materialId, title, button);
      if (reset) {
        elements.message.hidden = false;
        elements.message.className = 'dashboard-message';
        elements.message.textContent = materialId
          ? `Zresetowano Twój postęp materiału „${title}”.`
          : 'Zresetowano cały Twój postęp kursu.';
      }
    });
    return button;
  }

  async function hydrateDashboardProgress(model, force) {
    const api = window.ChemProgress;
    if (!api) return;
    try {
      const state = await api.load({ force: Boolean(force) });
      const nodes = state?.aggregate?.nodes || {};
      const records = state?.records || {};
      const access = state?.access || {};
      const materialProgress = (id) => nodes[id] || records[id] || null;
      document.querySelectorAll('[data-sequence-parent]').forEach((card) => {
        const id = card.dataset.progressId;
        const index = Number(card.dataset.sequenceIndex) || 0;
        const siblings = Array.from(document.querySelectorAll('[data-sequence-parent]'))
          .filter((item) => item.dataset.sequenceParent === card.dataset.sequenceParent)
          .sort((left, right) => Number(left.dataset.sequenceIndex) - Number(right.dataset.sequenceIndex));
        const previous = siblings.slice(0, index);
        const fallbackLocked = previous.some((item) => materialProgress(item.dataset.progressId)?.status !== 'completed');
        const sequenceAccess = access[id];
        const currentCatalogSequence = siblings.every((item, siblingIndex) => {
          const itemAccess = access[item.dataset.progressId];
          return itemAccess?.sequenceId === card.dataset.sequenceParent
            && itemAccess.step === siblingIndex + 1
            && itemAccess.totalSteps === siblings.length;
        });
        const locked = currentCatalogSequence ? sequenceAccess?.allowed === false : fallbackLocked;
        const prerequisite = (currentCatalogSequence ? sequenceAccess?.prerequisiteTitle : '')
          || previous.find((item) => materialProgress(item.dataset.progressId)?.status !== 'completed')?.dataset.sequenceTitle
          || '';
        setSequenceCardState(card, locked, materialProgress(id), prerequisite);
      });
      document.querySelectorAll('[data-progress-host]').forEach((host) => {
        const id = host.dataset.progressHost;
        const aggregate = materialProgress(id);
        host.replaceChildren();
        if (!aggregate || aggregate.tracked === false || aggregate.showProgress === false || aggregate.trackedCount <= 0) {
          host.hidden = true;
          return;
        }
        host.hidden = false;
        host.append(api.progressView(aggregate.record || aggregate, { compact: true }));
        if (aggregate.record) host.append(studentResetButton('Resetuj', id, aggregate.title));
      });
      const courseHost = document.getElementById('course-progress');
      const course = state?.aggregate?.course;
      if (courseHost) {
        courseHost.replaceChildren();
        courseHost.hidden = !course || course.tracked === false || course.showProgress === false || course.trackedCount <= 0;
        if (!courseHost.hidden) {
          const title = document.createElement('strong');
          title.textContent = 'Twój postęp kursu';
          courseHost.append(title, api.progressView(course));
          if (Object.keys(state?.records || {}).length) {
            const actions = document.createElement('div');
            actions.className = 'course-progress-actions';
            actions.append(studentResetButton('Resetuj postęp', '', 'Kurs'));
            courseHost.append(actions);
          }
        }
      }
    } catch (error) {
      console.warn('Nie udało się wczytać pasków postępu', error?.code || error?.message || error);
    }
  }

  function showContentError(error) {
    elements.content.hidden = false;
    elements.emptySearch.hidden = true;
    elements.content.replaceChildren();
    elements.content.setAttribute('aria-busy', 'false');
    const errorSection = document.createElement('section');
    errorSection.className = 'empty-section';
    const heading = document.createElement('h2');
    heading.textContent = 'Nie udało się wczytać materiałów';
    const text = document.createElement('p');
    text.textContent = 'Odśwież stronę. Jeśli problem się powtórzy, skorzystaj z formularza pomocy.';
    const retry = document.createElement('button');
    retry.className = 'button button-primary';
    retry.type = 'button';
    retry.textContent = 'Spróbuj ponownie';
    retry.addEventListener('click', loadDashboard);
    errorSection.append(heading, text, retry);
    elements.content.append(errorSection);
    elements.message.className = 'dashboard-message is-error';
    elements.message.textContent = error instanceof Error ? error.message : 'Wystąpił błąd wczytywania.';
    elements.message.hidden = false;
    elements.nav.querySelectorAll('.nav-skeleton').forEach((node) => node.remove());
  }

  async function fetchStaticDashboard(cacheBust = false) {
    const contentUrl = cacheBust
      ? `${CONTENT_URL}?restore=${Date.now()}`
      : CONTENT_URL;
    const response = await fetch(contentUrl, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/markdown, text/plain;q=0.9' }
    });
    if (!response.ok) throw new Error(`Materiały są chwilowo niedostępne (${response.status}).`);
    if (new URL(response.url, window.location.origin).pathname.startsWith('/login/')) {
      throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    }
    const markdown = await response.text();
    if (/^\s*<!doctype\s+html/i.test(markdown) || /^\s*<html[\s>]/i.test(markdown)) {
      throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    }
    return markdown;
  }

  async function fetchActiveDashboard() {
    let token = '';
    try { token = await getUserToken(false); } catch (_) {}
    if (token) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(ADMIN_DASHBOARD_URL, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload && payload.source === 'static') return fetchStaticDashboard();
          if (payload && typeof payload.content === 'string') return payload.content;
          throw new Error('Serwer zwrócił nieprawidłową treść dashboardu.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Sesja wygasła albo dostęp do kursu został zakończony.');
        }
        // Starsza odpowiedź 404 oraz chwilowa niedostępność Functions/Blobs nie
        // blokują statycznej wersji awaryjnej.
      } catch (error) {
        if (error && /Sesja wygasła|dostęp do kursu/.test(error.message || '')) throw error;
      } finally {
        window.clearTimeout(timeout);
      }
    }
    return fetchStaticDashboard();
  }

  async function loadDashboard() {
    const loadId = ++dashboardLoadId;
    elements.content.setAttribute('aria-busy', 'true');
    try {
      const markdown = await fetchActiveDashboard();
      const model = parseMarkdown(markdown);
      if (!model.sections.length) throw new Error('Plik materiałów nie zawiera jeszcze żadnego działu.');
      if (loadId !== dashboardLoadId) return;
      renderDashboard(model);
    } catch (error) {
      if (loadId !== dashboardLoadId) return;
      showContentError(error);
    }
  }

  function updateResourceCount(visible, total, filtering) {
    if (!elements.resourceCount) return;
    elements.resourceCount.textContent = filtering
      ? `${resourceLabel(visible)} z ${total}`
      : `${resourceLabel(total)} w panelu`;
  }

  function filterResources() {
    const query = normalizeText(elements.search.value);
    let visibleCards = 0;

    document.querySelectorAll('.course-section').forEach((section) => {
      let sectionMatches = 0;
      section.querySelectorAll('.resource-card').forEach((card) => {
        const matches = !query || card.dataset.search.includes(query);
        card.hidden = !matches;
        if (matches) sectionMatches += 1;
      });
      section.querySelectorAll('.resource-accordion').forEach((accordion) => {
        const matchingCards = Array.from(accordion.querySelectorAll('.resource-card'))
          .filter((card) => !card.hidden).length;
        accordion.hidden = Boolean(query) && matchingCards === 0;
        if (query && matchingCards > 0) accordion.open = true;
        const total = accordion.querySelector('[data-accordion-total]');
        if (total && query) total.textContent = `${matchingCards} z ${total.dataset.accordionTotal}`;
        else if (total) total.textContent = resourceLabel(Number(total.dataset.accordionTotal));
      });
      section.hidden = Boolean(query) && sectionMatches === 0;
      visibleCards += sectionMatches;
      const total = section.querySelector('[data-section-total]');
      if (total && query) total.textContent = `${sectionMatches} z ${total.dataset.sectionTotal}`;
      else if (total) total.textContent = resourceLabel(Number(total.dataset.sectionTotal));
    });

    elements.emptySearch.hidden = !query || visibleCards > 0;
    elements.content.hidden = Boolean(query) && visibleCards === 0;
    updateResourceCount(visibleCards, totalResources, Boolean(query));
    requestNavigationSync();
  }

  function setActiveNavigation(id) {
    if (!id) return;
    let activeLink = null;
    elements.nav.querySelectorAll('.nav-item').forEach((link) => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('is-active', active);
      if (active) {
        activeLink = link;
        link.setAttribute('aria-current', 'location');
      }
      else link.removeAttribute('aria-current');
    });
    if (!activeLink || activeNavigationId === id) return;
    activeNavigationId = id;
    if (typeof activeLink.scrollIntoView === 'function') {
      activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function navigationSections() {
    return [
      document.getElementById('start'),
      ...document.querySelectorAll('.course-section')
    ].filter((section) => section && !section.hidden);
  }

  function navigationActivationLine() {
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const topbarBottom = elements.topbar
      ? Math.max(0, elements.topbar.getBoundingClientRect().bottom)
      : 0;
    return Math.min(
      viewportHeight - 40,
      Math.max(topbarBottom + 28, viewportHeight * 0.28)
    );
  }

  function isPageEnd() {
    const root = document.documentElement;
    const scrollTop = window.scrollY || window.pageYOffset || root.scrollTop || 0;
    const scrollHeight = Math.max(root.scrollHeight, document.body.scrollHeight);
    return Math.ceil(scrollTop + (window.innerHeight || root.clientHeight || 0)) >= scrollHeight - 2;
  }

  function clearNavigationIntent() {
    navigationIntentId = '';
    navigationIntentDeadline = 0;
    if (navigationIntentTimeout) {
      window.clearTimeout(navigationIntentTimeout);
      navigationIntentTimeout = 0;
    }
  }

  function startNavigationIntent(id) {
    if (!id) return;
    clearNavigationIntent();
    navigationIntentId = id;
    navigationIntentDeadline = Date.now() + 1500;
    setActiveNavigation(id);
    navigationIntentTimeout = window.setTimeout(() => {
      if (navigationIntentId !== id) return;
      clearNavigationIntent();
      requestNavigationSync();
    }, 1520);
  }

  function navigationIntentReached(sections, activationLine, atPageEnd) {
    const target = sections.find((section) => section.id === navigationIntentId);
    if (!target) return true;
    const rect = target.getBoundingClientRect();
    if (rect.top <= activationLine && rect.bottom > activationLine) return true;
    return atPageEnd && target === sections[sections.length - 1];
  }

  function syncActiveNavigation() {
    const sections = navigationSections();
    if (!sections.length) return;
    const activationLine = navigationActivationLine();
    const atPageEnd = isPageEnd();

    if (navigationIntentId) {
      if (
        Date.now() < navigationIntentDeadline &&
        !navigationIntentReached(sections, activationLine, atPageEnd)
      ) {
        setActiveNavigation(navigationIntentId);
        return;
      }
      clearNavigationIntent();
    }

    const snapshots = sections.map((section) => ({
      id: section.id,
      hidden: section.hidden,
      top: section.getBoundingClientRect().top
    }));
    const tracker = window.ChemDashboardNavigation;
    const activeId = tracker && typeof tracker.pickActiveSection === 'function'
      ? tracker.pickActiveSection(snapshots, activationLine, atPageEnd)
      : snapshots[0].id;
    setActiveNavigation(activeId);
  }

  function requestNavigationSync() {
    if (navigationFrameId !== null) return;
    const schedule = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 16);
    navigationFrameId = schedule(() => {
      navigationFrameId = null;
      syncActiveNavigation();
    });
  }

  function sectionIdFromHash() {
    const rawHash = String(window.location.hash || '').replace(/^#/, '');
    if (!rawHash) return '';
    let id = rawHash;
    try { id = decodeURIComponent(rawHash); } catch (_) {}
    const target = document.getElementById(id);
    if (!target) return '';
    const matchingLink = Array.from(elements.nav.querySelectorAll('.nav-item'))
      .some((link) => link.getAttribute('href') === `#${id}`);
    return matchingLink ? id : '';
  }

  function revealNavigationTarget(id) {
    const target = document.getElementById(id);
    if (!target || !target.hidden) return target;
    if (elements.search.value) {
      elements.search.value = '';
      filterResources();
    }
    return target;
  }

  function handleNavigationClick(event) {
    const clicked = event.target instanceof Element
      ? event.target.closest('.nav-item')
      : null;
    if (!clicked || !elements.nav.contains(clicked)) return;
    closeMenu();
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = clicked.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    let id = href.slice(1);
    try { id = decodeURIComponent(id); } catch (_) {}
    if (!revealNavigationTarget(id)) return;
    startNavigationIntent(id);
  }

  function handleLocationNavigation() {
    const id = sectionIdFromHash();
    if (id) {
      revealNavigationTarget(id);
      startNavigationIntent(id);
    } else {
      clearNavigationIntent();
    }
    requestNavigationSync();
  }

  function cancelNavigationIntent() {
    if (!navigationIntentId) return;
    clearNavigationIntent();
    requestNavigationSync();
  }

  function setupSectionTracking() {
    if (!navigationInitialized) {
      navigationInitialized = true;
      const id = sectionIdFromHash();
      const target = id ? revealNavigationTarget(id) : null;
      if (target) {
        startNavigationIntent(id);
        const schedule = typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : (callback) => window.setTimeout(callback, 0);
        schedule(() => {
          if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start' });
          requestNavigationSync();
        });
        return;
      }
    }
    requestNavigationSync();
  }

  function openMenu() {
    elements.body.classList.add('menu-open');
    updateMenuButton();
  }

  function closeMenu() {
    elements.body.classList.remove('menu-open');
    updateMenuButton();
  }

  function displayNameFor(user, profile) {
    if (profile && typeof profile.fullName === 'string' && profile.fullName.trim()) return profile.fullName.trim();
    const metadata = user && user.user_metadata ? user.user_metadata : {};
    const name = metadata.full_name || metadata.name || '';
    if (typeof name === 'string' && name.trim()) return name.trim();
    if (user && typeof user.email === 'string' && user.email.includes('@')) return user.email.split('@')[0];
    return 'Kursant';
  }

  function initialsFor(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toLocaleUpperCase('pl');
  }

  function accessLabelFor(user) {
    const appMetadata = user && user.app_metadata ? user.app_metadata : {};
    const roles = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
    if (roles.includes('admin')) return 'Dostęp administratora';

    const timed = appMetadata.timed_access;
    if (timed && timed.expires_at) {
      const expiration = new Date(timed.expires_at);
      if (Number.isFinite(expiration.getTime()) && expiration.getTime() > Date.now()) {
        return `Dostęp do ${new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(expiration)}`;
      }
    }
    if (roles.includes('active')) return 'Konto aktywne';
    return 'Konto kursanta';
  }

  function isAdminUser(user) {
    const appMetadata = user && user.app_metadata ? user.app_metadata : {};
    return Array.isArray(appMetadata.roles) && appMetadata.roles.includes('admin');
  }

  function updateAdminVisibility(user) {
    const visible = isAdminUser(user || currentUser);
    if (elements.adminButton) elements.adminButton.hidden = !visible;
    if (elements.contentStudioLink) elements.contentStudioLink.hidden = !visible;
    if (!visible && elements.adminDialog && elements.adminDialog.open) closeAdminPanel();
  }

  function updateProfileDisplay(user, profile) {
    if (!user && !profile) return;
    if (user) currentUser = user;
    const activeUser = user || currentUser;
    const metadata = activeUser && activeUser.user_metadata ? activeUser.user_metadata : {};
    const name = displayNameFor(activeUser, profile);
    const email = profile && typeof profile.email === 'string'
      ? profile.email
      : activeUser && typeof activeUser.email === 'string' ? activeUser.email : '';
    const initials = initialsFor(name);
    const accessLabel = accessLabelFor(activeUser);

    let firstName = profile && typeof profile.firstName === 'string' ? profile.firstName.trim() : '';
    let lastName = profile && typeof profile.lastName === 'string' ? profile.lastName.trim() : '';
    if (!firstName) firstName = String(metadata.first_name || metadata.firstName || metadata.given_name || '').trim();
    if (!lastName) lastName = String(metadata.last_name || metadata.lastName || metadata.family_name || '').trim();
    if ((!firstName || !lastName) && name && name !== 'Kursant') {
      const parts = name.split(/\s+/).filter(Boolean);
      if (!firstName) firstName = parts.shift() || '';
      if (!lastName) lastName = parts.join(' ');
    }

    document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = name; });
    document.querySelectorAll('[data-user-email]').forEach((node) => { node.textContent = email; });
    document.querySelectorAll('[data-user-initials]').forEach((node) => { node.textContent = initials; });
    document.querySelectorAll('[data-access-label]').forEach((node) => { node.textContent = accessLabel; });
    updateAdminVisibility(activeUser);
    const editingName = document.activeElement === elements.profileFirstName || document.activeElement === elements.profileLastName;
    if (!elements.profileDialog.open || !editingName) {
      elements.profileFirstName.value = firstName;
      elements.profileLastName.value = lastName;
    }
  }

  function openProfile(event) {
    lastProfileTrigger = event && event.currentTarget ? event.currentTarget : null;
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    const profile = auth && typeof auth.getProfile === 'function' ? auth.getProfile() : null;
    if (user || profile) updateProfileDisplay(user, profile);
    elements.profileMessage.textContent = '';
    elements.profileMessage.className = 'form-message';
    clearProfilePasswordFields();
    elements.profilePasswordMessage.textContent = '';
    elements.profilePasswordMessage.className = 'form-message';
    elements.profileProgressMessage.textContent = '';
    elements.profileProgressMessage.className = 'form-message profile-progress-message';
    elements.profilePasswordEmail.value = user && typeof user.email === 'string' ? user.email : '';
    if (typeof elements.profileDialog.showModal === 'function') elements.profileDialog.showModal();
    else elements.profileDialog.setAttribute('open', '');
    window.setTimeout(() => elements.profileFirstName.focus(), 0);
  }

  function closeProfile() {
    clearProfilePasswordFields();
    elements.profilePasswordMessage.textContent = '';
    elements.profilePasswordMessage.className = 'form-message';
    if (typeof elements.profileDialog.close === 'function') elements.profileDialog.close();
    else elements.profileDialog.removeAttribute('open');
    if (lastProfileTrigger) lastProfileTrigger.focus();
  }

  async function saveProfile(event) {
    event.preventDefault();
    const firstName = elements.profileFirstName.value.replace(/\s+/g, ' ').trim();
    const lastName = elements.profileLastName.value.replace(/\s+/g, ' ').trim();
    if (firstName.length < 2 || lastName.length < 2) {
      elements.profileMessage.textContent = 'Imię i nazwisko muszą mieć co najmniej 2 znaki.';
      elements.profileMessage.className = 'form-message is-error';
      (firstName.length < 2 ? elements.profileFirstName : elements.profileLastName).focus();
      return;
    }

    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    if ((!auth || typeof auth.updateProfile !== 'function') && (!user || typeof user.update !== 'function')) {
      elements.profileMessage.textContent = 'Nie udało się odczytać sesji. Odśwież stronę i spróbuj ponownie.';
      elements.profileMessage.className = 'form-message is-error';
      return;
    }

    const oldButtonText = elements.profileSave.textContent;
    elements.profileSave.disabled = true;
    elements.profileSave.textContent = 'Zapisywanie…';
    elements.profileMessage.textContent = '';

    try {
      let profile = null;
      let updatedUser = user;
      if (auth && typeof auth.updateProfile === 'function') {
        profile = await auth.updateProfile({ firstName, lastName });
        updatedUser = (typeof auth.getUser === 'function' && auth.getUser()) || user;
      } else {
        const fullName = `${firstName} ${lastName}`;
        const metadata = Object.assign({}, user.user_metadata || {}, {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          name: fullName
        });
        updatedUser = await user.update({ data: metadata });
      }
      updateProfileDisplay(updatedUser || (identity && identity.currentUser()) || user, profile);
      elements.profileMessage.className = 'form-message';
      elements.profileMessage.textContent = 'Zapisano zmiany.';
    } catch (error) {
      elements.profileMessage.className = 'form-message is-error';
      elements.profileMessage.textContent = error && error.message
        ? error.message
        : 'Nie udało się zapisać profilu. Sprawdź połączenie i spróbuj ponownie.';
    } finally {
      elements.profileSave.disabled = false;
      elements.profileSave.textContent = oldButtonText;
    }
  }

  async function resetProfileProgress() {
    elements.profileProgressMessage.textContent = '';
    elements.profileProgressMessage.className = 'form-message profile-progress-message';
    const reset = await resetStudentProgress('', 'Kurs', elements.profileResetProgress);
    if (reset) {
      elements.profileProgressMessage.textContent = 'Twój postęp kursu został zresetowany.';
    } else if (reset === false) {
      elements.profileProgressMessage.textContent = 'Nie zresetowano postępu.';
      elements.profileProgressMessage.className = 'form-message profile-progress-message is-error';
    }
  }

  function clearProfilePasswordFields() {
    elements.profileCurrentPassword.value = '';
    elements.profileNewPassword.value = '';
    elements.profileConfirmPassword.value = '';
  }

  async function changeProfilePassword(event) {
    event.preventDefault();
    const currentPassword = elements.profileCurrentPassword.value;
    const newPassword = elements.profileNewPassword.value;
    const confirmPassword = elements.profileConfirmPassword.value;
    elements.profilePasswordMessage.textContent = '';
    elements.profilePasswordMessage.className = 'form-message';

    if (!currentPassword) {
      elements.profilePasswordMessage.textContent = 'Wpisz obecne hasło.';
      elements.profilePasswordMessage.className = 'form-message is-error';
      elements.profileCurrentPassword.focus();
      return;
    }
    if (newPassword.length < 10) {
      elements.profilePasswordMessage.textContent = 'Nowe hasło musi mieć co najmniej 10 znaków.';
      elements.profilePasswordMessage.className = 'form-message is-error';
      elements.profileNewPassword.focus();
      return;
    }
    if (newPassword === currentPassword) {
      elements.profilePasswordMessage.textContent = 'Nowe hasło musi być inne niż obecne.';
      elements.profilePasswordMessage.className = 'form-message is-error';
      elements.profileNewPassword.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      elements.profilePasswordMessage.textContent = 'Powtórzone hasło nie jest identyczne.';
      elements.profilePasswordMessage.className = 'form-message is-error';
      elements.profileConfirmPassword.focus();
      return;
    }

    const auth = window.ChemAuth;
    if (!auth || typeof auth.changePassword !== 'function') {
      elements.profilePasswordMessage.textContent = 'Zmiana hasła jest chwilowo niedostępna. Odśwież stronę i spróbuj ponownie.';
      elements.profilePasswordMessage.className = 'form-message is-error';
      return;
    }

    const oldButtonText = elements.profilePasswordSubmit.textContent;
    elements.profilePasswordSubmit.disabled = true;
    elements.profilePasswordSubmit.textContent = 'Sprawdzanie i zapisywanie…';
    try {
      await auth.changePassword({ currentPassword, newPassword });
      currentUser = (typeof auth.getUser === 'function' && auth.getUser()) || currentUser;
      clearProfilePasswordFields();
      elements.profilePasswordMessage.textContent = 'Hasło zostało zmienione.';
      elements.profilePasswordMessage.className = 'form-message is-success';
    } catch (error) {
      elements.profilePasswordMessage.textContent = error && error.message
        ? error.message
        : 'Nie udało się zmienić hasła. Spróbuj ponownie.';
      elements.profilePasswordMessage.className = 'form-message is-error';
    } finally {
      elements.profilePasswordSubmit.disabled = false;
      elements.profilePasswordSubmit.textContent = oldButtonText;
    }
  }

  function adminProfileFrom(rawUser) {
    const source = rawUser && typeof rawUser === 'object' ? rawUser : {};
    const userMetadata = source.user_metadata && typeof source.user_metadata === 'object' ? source.user_metadata : {};
    const appMetadata = source.app_metadata && typeof source.app_metadata === 'object' ? source.app_metadata : {};
    const fullName = String(source.fullName || source.full_name || userMetadata.full_name || userMetadata.name || '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    let firstName = String(source.firstName || source.first_name || userMetadata.first_name || userMetadata.firstName || '').trim();
    let lastName = String(source.lastName || source.last_name || userMetadata.last_name || userMetadata.lastName || '').trim();
    if (!firstName && nameParts.length) firstName = nameParts.shift() || '';
    if (!lastName && nameParts.length) lastName = nameParts.join(' ');
    const rawRoles = Array.isArray(source.roles) ? source.roles : Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
    const rawTimedAccess = source.timedAccess && typeof source.timedAccess === 'object'
      ? source.timedAccess
      : source.timed_access && typeof source.timed_access === 'object'
        ? source.timed_access
        : appMetadata.timed_access && typeof appMetadata.timed_access === 'object' ? appMetadata.timed_access : null;
    const timedRole = rawTimedAccess && String(rawTimedAccess.role || '').trim();
    const timedExpiresAt = rawTimedAccess && String(rawTimedAccess.expiresAt || rawTimedAccess.expires_at || '').trim();

    return {
      id: String(source.id || source.user_id || '').trim(),
      email: String(source.email || '').trim(),
      firstName,
      lastName,
      roles: Array.from(new Set(rawRoles.filter((role) => ADMIN_ROLE_VALUES.has(role)))),
      timedAccess: timedRole && COURSE_ROLE_VALUES.has(timedRole)
        ? {
            role: timedRole,
            assignedAt: String(rawTimedAccess.assignedAt || rawTimedAccess.assigned_at || '').trim(),
            expiresAt: timedExpiresAt,
            active: rawTimedAccess.active !== false
          }
        : null,
      confirmedAt: String(source.confirmedAt || source.confirmed_at || '').trim(),
      createdAt: String(source.createdAt || source.created_at || '').trim(),
      updatedAt: String(source.updatedAt || source.updated_at || '').trim(),
      lastSignInAt: String(source.lastSignInAt || source.last_sign_in_at || '').trim(),
      paymentDetails: null,
      paymentDetailsLoaded: false
    };
  }

  function adminDisplayName(user) {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    return fullName || user.email || 'Użytkownik bez nazwy';
  }

  function adminDateLabel(value, fallback = 'Brak danych') {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return fallback;
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function remainingAccessLabel(user) {
    const expiresAt = user && user.timedAccess ? Date.parse(user.timedAccess.expiresAt || '') : 0;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      if (user && user.roles.includes('active')) return 'Dostęp stały';
      if (user && user.roles.includes('admin')) return 'Administrator';
      return 'Brak aktywnego dostępu';
    }
    const totalHours = Math.max(1, Math.ceil((expiresAt - Date.now()) / (60 * 60 * 1000)));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return days ? `${days} d ${hours} godz. pozostało` : `${hours} godz. pozostało`;
  }

  function setAdminStatus(message, type) {
    setPanelStatus(elements.adminStatus, message, type);
  }

  function setPanelStatus(element, message, type) {
    if (!element) return;
    element.textContent = message || '';
    element.className = `admin-status${type ? ` is-${type}` : ''}`;
  }

  async function getUserToken(requireAdmin) {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    if (requireAdmin && !isAdminUser(user)) throw new Error('Ta funkcja jest dostępna tylko dla administratora.');
    if (!user || typeof user.jwt !== 'function') throw new Error('Nie udało się odczytać sesji administratora.');
    const token = await user.jwt();
    if (!token) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
    return token;
  }

  async function getAdminToken() {
    return getUserToken(true);
  }

  async function readAdminResponse(response) {
    let payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const fallback = response.status === 403
        ? 'Nie masz uprawnień do zarządzania kontami.'
        : response.status === 401
          ? 'Sesja administratora wygasła. Zaloguj się ponownie.'
          : `Nie udało się wykonać operacji (${response.status}).`;
      const code = payload && typeof payload.error === 'string' ? payload.error : '';
      const serverMessage = payload && typeof payload.message === 'string' ? payload.message : '';
      throw new Error(ADMIN_ERROR_MESSAGES[code] || serverMessage || fallback);
    }
    return payload;
  }

  function createAccessControls(selected, userId) {
    const controls = document.createElement('div');
    controls.className = 'admin-access-controls';
    const safeId = slugify(userId, 'user');

    const accessLabel = document.createElement('label');
    accessLabel.className = 'admin-access-field';
    accessLabel.htmlFor = `access-${safeId}`;
    const accessCaption = document.createElement('span');
    accessCaption.className = 'field-label';
    accessCaption.textContent = 'Dostęp do kursu';
    const accessSelect = document.createElement('select');
    accessSelect.className = 'text-field admin-access-select';
    accessSelect.id = `access-${safeId}`;
    accessSelect.name = 'accessRole';
    const selectedAccess = ACCESS_ROLE_OPTIONS.find((role) => role.value && selected.includes(role.value));
    ACCESS_ROLE_OPTIONS.forEach((role) => {
      const option = document.createElement('option');
      option.value = role.value;
      option.textContent = role.label;
      option.selected = role.value === (selectedAccess ? selectedAccess.value : '');
      accessSelect.append(option);
    });
    accessLabel.append(accessCaption, accessSelect);

    const adminLabel = document.createElement('label');
    adminLabel.className = 'admin-toggle';
    adminLabel.htmlFor = `admin-${safeId}`;
    const adminInput = document.createElement('input');
    adminInput.id = `admin-${safeId}`;
    adminInput.name = 'isAdmin';
    adminInput.type = 'checkbox';
    adminInput.checked = selected.includes('admin');
    const currentId = currentUser && String(currentUser.id || currentUser.user_id || '').trim();
    const isOwnAdminAccount = Boolean(currentId && currentId === userId && adminInput.checked);
    if (isOwnAdminAccount) adminInput.disabled = true;
    const adminMark = document.createElement('span');
    adminMark.className = 'admin-toggle-mark';
    adminMark.setAttribute('aria-hidden', 'true');
    const adminCopy = document.createElement('span');
    adminCopy.className = 'admin-toggle-copy';
    const adminTitle = document.createElement('strong');
    adminTitle.textContent = 'Administrator';
    const adminHint = document.createElement('small');
    adminHint.textContent = isOwnAdminAccount ? 'Twoja rola jest chroniona' : 'Dostęp do tego panelu';
    adminCopy.append(adminTitle, adminHint);
    adminLabel.append(adminInput, adminMark, adminCopy);

    controls.append(accessLabel, adminLabel);
    return controls;
  }

  function createAdminUserCard(user) {
    const article = document.createElement('details');
    article.className = 'admin-user-card';
    article.dataset.userId = user.id;
    article.dataset.search = normalizeText(`${user.firstName} ${user.lastName} ${user.email}`);

    const header = document.createElement('summary');
    header.className = 'admin-user-heading';
    const avatar = document.createElement('span');
    avatar.className = 'avatar admin-user-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = initialsFor(adminDisplayName(user));
    const headingCopy = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = adminDisplayName(user);
    const email = document.createElement('p');
    email.textContent = user.email || 'Brak adresu e-mail';
    const summaryMeta = document.createElement('div');
    summaryMeta.className = 'admin-user-summary-meta';
    const accessSummary = document.createElement('span');
    accessSummary.dataset.adminAccessSummary = 'true';
    accessSummary.textContent = remainingAccessLabel(user);
    const createdSummary = document.createElement('span');
    createdSummary.textContent = `Konto: ${adminDateLabel(user.createdAt, 'brak daty')}`;
    summaryMeta.append(accessSummary, createdSummary);
    headingCopy.append(heading, email, summaryMeta);
    const chevron = document.createElement('span');
    chevron.className = 'admin-user-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '⌄';
    header.append(avatar, headingCopy, chevron);

    const remove = document.createElement('button');
    remove.className = 'admin-delete-button';
    remove.type = 'button';
    remove.textContent = 'Usuń konto';
    const currentId = currentUser && String(currentUser.id || currentUser.user_id || '').trim();
    const isOwnAccount = Boolean(currentId && currentId === user.id);
    remove.disabled = isOwnAccount;
    remove.title = isOwnAccount ? 'Nie możesz usunąć własnego konta' : `Usuń konto ${adminDisplayName(user)}`;
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', () => deleteAdminUser(user, remove));

    const form = document.createElement('form');
    form.className = 'admin-user-form';
    form.dataset.userId = user.id;

    const names = document.createElement('div');
    names.className = 'profile-name-grid';
    const createNameField = (labelText, name, value, autocomplete) => {
      const label = document.createElement('label');
      const labelSpan = document.createElement('span');
      labelSpan.className = 'field-label';
      labelSpan.textContent = labelText;
      const input = document.createElement('input');
      input.className = 'text-field';
      input.name = name;
      input.type = 'text';
      input.value = value;
      input.maxLength = 80;
      input.autocomplete = autocomplete;
      input.required = true;
      label.append(labelSpan, input);
      return label;
    };
    names.append(
      createNameField('Imię', 'firstName', user.firstName, 'off'),
      createNameField('Nazwisko', 'lastName', user.lastName, 'off')
    );

    const facts = document.createElement('div');
    facts.className = 'admin-account-facts';
    const createFact = (labelText, value) => {
      const fact = document.createElement('div');
      fact.className = 'admin-account-fact';
      const label = document.createElement('span');
      label.textContent = labelText;
      const content = document.createElement('strong');
      content.textContent = value;
      fact.append(label, content);
      return fact;
    };
    facts.append(
      createFact('Utworzono', adminDateLabel(user.createdAt)),
      createFact('Ostatnie logowanie', adminDateLabel(user.lastSignInAt)),
      createFact('Pozostały czas', remainingAccessLabel(user))
    );

    const roleFieldset = document.createElement('fieldset');
    roleFieldset.className = 'admin-roles';
    const legend = document.createElement('legend');
    legend.textContent = 'Uprawnienia';
    roleFieldset.append(legend, createAccessControls(user.roles, user.id));

    const timedStatus = createTimedAccessStatus(user);

    const footer = document.createElement('footer');
    footer.className = 'admin-user-footer';
    const message = document.createElement('p');
    message.className = 'admin-user-message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    const save = document.createElement('button');
    save.className = 'button button-primary';
    save.type = 'submit';
    save.textContent = 'Zapisz użytkownika';
    const aiLimits = document.createElement('button');
    aiLimits.className = 'button button-secondary';
    aiLimits.type = 'button';
    aiLimits.textContent = 'AI / Limity';
    aiLimits.addEventListener('click', () => openAdminAiUserLimits(user.id));
    const footerActions = document.createElement('div');
    footerActions.className = 'admin-user-footer-actions';
    footerActions.append(aiLimits, remove, save);
    footer.append(message, footerActions);

    form.append(facts, names, roleFieldset);
    if (timedStatus) form.append(timedStatus);
    const paymentHistory = document.createElement('section');
    paymentHistory.className = 'admin-payment-history';
    paymentHistory.dataset.paymentHistory = 'true';
    paymentHistory.innerHTML = '<p class="admin-payment-empty">Rozwiń konto, aby wczytać historię płatności.</p>';
    form.append(paymentHistory);
    form.append(footer);
    form.addEventListener('submit', (event) => saveAdminUser(event, user));
    article.addEventListener('toggle', () => {
      if (article.open && !user.paymentDetailsLoaded) loadAdminPaymentDetails(user, article);
    });
    article.append(header, form);
    return article;
  }

  function createTimedAccessStatus(user) {
    const role = user.roles.find((candidate) => !['admin', 'active'].includes(candidate));
    if (!role) return null;
    const container = document.createElement('div');
    container.className = 'admin-timed-status';
    container.dataset.timedStatus = 'true';
    const copy = document.createElement('span');
    const timed = user.timedAccess && user.timedAccess.role === role ? user.timedAccess : null;
    const expiresAt = timed ? new Date(timed.expiresAt) : null;
    const hasDate = Boolean(expiresAt && Number.isFinite(expiresAt.getTime()));
    const expired = Boolean(hasDate && expiresAt.getTime() <= Date.now());
    if (!hasDate) {
      copy.textContent = 'Okres dostępu rozpocznie się przy następnym logowaniu użytkownika.';
    } else if (expired) {
      container.classList.add('is-expired');
      copy.textContent = `Dostęp wygasł ${new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(expiresAt)}.`;
      const renew = document.createElement('button');
      renew.className = 'button button-secondary admin-renew-button';
      renew.type = 'button';
      renew.textContent = 'Odnów ten okres';
      renew.addEventListener('click', () => renewAdminTimedAccess(user, renew));
      container.append(copy, renew);
      return container;
    } else {
      copy.textContent = `Dostęp aktywny do ${new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(expiresAt)}.`;
    }
    container.append(copy);
    return container;
  }

  function refreshTimedAccessStatus(card, user) {
    const existing = card.querySelector('[data-timed-status]');
    const next = createTimedAccessStatus(user);
    if (existing && next) existing.replaceWith(next);
    else if (existing) existing.remove();
    else if (next) {
      const footer = card.querySelector('.admin-user-footer');
      if (footer) footer.before(next);
    }
  }

  function normalizePaymentDetails(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const access = source.access && typeof source.access === 'object' ? source.access : {};
    return {
      version: Number.isFinite(Number(source.version)) ? Number(source.version) : 0,
      access: {
        role: String(access.role || ''),
        assignedAt: String(access.assignedAt || ''),
        expiresAt: String(access.expiresAt || ''),
        active: Boolean(access.active),
        remainingMs: Math.max(0, Number(access.remainingMs) || 0)
      },
      history: Array.isArray(source.history) ? source.history.filter((event) => event && typeof event === 'object') : []
    };
  }

  function paymentAmountLabel(event) {
    const amount = Number(event && event.amount);
    if (!Number.isFinite(amount)) return '';
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: String(event && event.currency || 'pln').toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount / 100);
  }

  function renderAdminPaymentDetails(user, card) {
    const container = card.querySelector('[data-payment-history]');
    if (!container) return;
    const details = user.paymentDetails || normalizePaymentDetails(null);
    const fragment = document.createDocumentFragment();
    const heading = document.createElement('div');
    heading.className = 'admin-payment-history-heading';
    const title = document.createElement('strong');
    title.textContent = `Historia płatności i dostępu (${details.history.length})`;
    heading.append(title);

    const hasPurchase = details.history.some((event) => event.type === 'purchase');
    if (hasPurchase && details.access.active) {
      const revoke = document.createElement('button');
      revoke.className = 'admin-revoke-payment';
      revoke.type = 'button';
      revoke.textContent = 'Odbierz płatny dostęp';
      revoke.addEventListener('click', () => revokeAdminPaymentAccess(user, card, revoke));
      heading.append(revoke);
    }
    fragment.append(heading);

    if (!details.history.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-payment-empty';
      empty.textContent = 'Brak zakupów Stripe i operacji odebrania dostępu.';
      fragment.append(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'admin-payment-history-list';
      details.history.forEach((event) => {
        const row = document.createElement('div');
        row.className = 'admin-payment-event';
        const label = document.createElement('strong');
        const plan = ACCESS_ROLE_OPTIONS.find((option) => option.value === event.plan);
        label.textContent = event.type === 'purchase'
          ? `Zakup: ${plan ? plan.label : event.plan || 'pakiet'}`
          : 'Dostęp odebrany przez administratora';
        const value = document.createElement('span');
        value.textContent = event.type === 'purchase'
          ? `${paymentAmountLabel(event)} · ${adminDateLabel(event.paidAt || event.recordedAt)}`
          : adminDateLabel(event.recordedAt);
        row.append(label, value);
        if (event.id) {
          const id = document.createElement('code');
          id.textContent = event.id;
          row.append(id);
        }
        list.append(row);
      });
      fragment.append(list);
    }
    container.replaceChildren(fragment);
  }

  async function loadAdminPaymentDetails(user, card) {
    const container = card.querySelector('[data-payment-history]');
    if (container) container.innerHTML = '<p class="admin-payment-empty">Wczytywanie historii płatności…</p>';
    try {
      const token = await getAdminToken();
      const response = await fetch(`${PAYMENT_ADMIN_URL}?userId=${encodeURIComponent(user.id)}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await readAdminResponse(response);
      user.paymentDetails = normalizePaymentDetails(payload);
      user.paymentDetailsLoaded = true;
      renderAdminPaymentDetails(user, card);
    } catch (error) {
      user.paymentDetailsLoaded = false;
      if (container) {
        const message = document.createElement('p');
        message.className = 'admin-payment-empty';
        message.textContent = error && error.message ? error.message : 'Nie udało się wczytać historii płatności.';
        container.replaceChildren(message);
      }
    }
  }

  async function revokeAdminPaymentAccess(user, card, button) {
    if (!window.confirm(`Odebrać płatny dostęp kontu ${adminDisplayName(user)}? To nie zwraca automatycznie pieniędzy w Stripe.`)) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Odbieranie…';
    try {
      const token = await getAdminToken();
      const response = await fetch(PAYMENT_ADMIN_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'revoke', userId: user.id })
      });
      const payload = await readAdminResponse(response);
      user.paymentDetails = normalizePaymentDetails(payload);
      user.paymentDetailsLoaded = true;
      const preservePermanentAccess = user.roles.includes('active') && !user.timedAccess;
      user.roles = user.roles.filter((role) => role === 'admin' || (preservePermanentAccess && role === 'active'));
      user.timedAccess = null;
      renderAdminPaymentDetails(user, card);
      refreshTimedAccessStatus(card, user);
      const summary = card.querySelector('[data-admin-access-summary]');
      if (summary) summary.textContent = remainingAccessLabel(user);
      const message = card.querySelector('.admin-user-message');
      message.className = 'admin-user-message is-success';
      message.textContent = 'Dostęp został odebrany. Zwrot pieniędzy, jeśli jest potrzebny, wykonaj osobno w Stripe.';
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      const message = card.querySelector('.admin-user-message');
      message.className = 'admin-user-message is-error';
      message.textContent = error && error.message ? error.message : 'Nie udało się odebrać dostępu.';
    }
  }

  function renderAdminUsers() {
    const query = normalizeText(elements.adminSearch.value);
    const filtered = adminUsers.filter((user) => !query || normalizeText(`${user.firstName} ${user.lastName} ${user.email}`).includes(query));
    const fragment = document.createDocumentFragment();
    filtered.forEach((user) => fragment.append(createAdminUserCard(user)));
    elements.adminUserList.replaceChildren(fragment);
    elements.adminEmpty.hidden = filtered.length > 0;
    if (query) setAdminStatus(`${filtered.length} z ${adminUsers.length} kont`, 'info');
    else setAdminStatus(adminUsers.length ? `${adminUsers.length} kont w systemie` : '', 'info');
  }

  function setAdminExportDisabled(disabled) {
    elements.adminExportJson.disabled = disabled;
    elements.adminExportXml.disabled = disabled;
  }

  function adminContactRecord(user) {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    return {
      email: clean(user && user.email),
      firstName: clean(user && user.firstName),
      lastName: clean(user && user.lastName)
    };
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function serializeAdminContacts(format, contacts, exportedAt) {
    if (format === 'json') {
      return JSON.stringify({
        exportedAt,
        count: contacts.length,
        contacts
      }, null, 2);
    }

    const rows = contacts.map((contact) => [
      '  <contact>',
      `    <email>${escapeXml(contact.email)}</email>`,
      `    <firstName>${escapeXml(contact.firstName)}</firstName>`,
      `    <lastName>${escapeXml(contact.lastName)}</lastName>`,
      '  </contact>'
    ].join('\n')).join('\n');
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<contacts exportedAt="${escapeXml(exportedAt)}" count="${contacts.length}">`,
      rows,
      '</contacts>'
    ].join('\n');
  }

  function downloadAdminContacts(format) {
    if (format !== 'json' && format !== 'xml') return;
    if (!adminUsers.length) {
      setAdminStatus('Najpierw wczytaj listę użytkowników.', 'error');
      return;
    }

    const contacts = adminUsers
      .map(adminContactRecord)
      .sort((left, right) => (
        left.lastName.localeCompare(right.lastName, 'pl', { sensitivity: 'base' })
        || left.firstName.localeCompare(right.firstName, 'pl', { sensitivity: 'base' })
        || left.email.localeCompare(right.email, 'pl', { sensitivity: 'base' })
      ));
    const exportedAt = new Date().toISOString();
    const content = serializeAdminContacts(format, contacts, exportedAt);
    const mimeType = format === 'json' ? 'application/json;charset=utf-8' : 'application/xml;charset=utf-8';
    const blobUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    const timestamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
    link.href = blobUrl;
    link.download = `chemdisk-kontakty-${timestamp}.${format}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    setAdminStatus(`Pobrano ${contacts.length} kontaktów w pliku ${format.toUpperCase()}.`, 'info');
  }

  async function loadAdminUsers() {
    elements.adminUserList.setAttribute('aria-busy', 'true');
    elements.adminUserList.replaceChildren();
    elements.adminEmpty.hidden = true;
    elements.adminRefresh.disabled = true;
    setAdminExportDisabled(true);
    setAdminStatus('Wczytywanie kont użytkowników…', 'loading');
    try {
      const token = await getAdminToken();
      const collected = [];
      let page = 1;
      let hasMore = false;
      do {
        const response = await fetch(`${ADMIN_USERS_URL}?page=${page}&perPage=100`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
        const payload = await readAdminResponse(response);
        const rawUsers = Array.isArray(payload) ? payload : payload && Array.isArray(payload.users) ? payload.users : [];
        collected.push(...rawUsers);
        hasMore = Boolean(payload && payload.pagination && payload.pagination.hasMore);
        page += 1;
        if (hasMore) setAdminStatus(`Wczytywanie kont użytkowników… ${collected.length}`, 'loading');
      } while (hasMore && page <= 100);

      if (hasMore) throw new Error('Lista kont jest zbyt długa, aby wyświetlić ją w całości.');
      const uniqueUsers = new Map();
      collected.map(adminProfileFrom).filter((user) => user.id).forEach((user) => uniqueUsers.set(user.id, user));
      adminUsers = Array.from(uniqueUsers.values());
      renderAdminUsers();
      setAdminExportDisabled(adminUsers.length === 0);
      if (adminProgressLoaded) {
        reconcileAdminProgressUsers();
        renderAdminProgressUsers();
        renderAdminProgressMetrics(adjustedAdminProgressReport());
        renderAdminProgressGlobal(adjustedAdminProgressReport());
      }
    } catch (error) {
      adminUsers = [];
      elements.adminEmpty.hidden = true;
      setAdminStatus(error && error.message ? error.message : 'Nie udało się wczytać użytkowników.', 'error');
    } finally {
      elements.adminUserList.setAttribute('aria-busy', 'false');
      elements.adminRefresh.disabled = false;
    }
  }

  async function saveAdminUser(event, originalUser) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('.admin-user-message');
    const save = form.querySelector('button[type="submit"]');
    const firstName = String(form.elements.firstName.value || '').replace(/\s+/g, ' ').trim();
    const lastName = String(form.elements.lastName.value || '').replace(/\s+/g, ' ').trim();
    const roles = [];
    const accessRole = String(form.elements.accessRole.value || '');
    if (COURSE_ROLE_VALUES.has(accessRole)) roles.push(accessRole);
    if (form.elements.isAdmin.checked) roles.unshift('admin');

    if (firstName.length < 2 || lastName.length < 2) {
      message.textContent = 'Imię i nazwisko muszą mieć co najmniej 2 znaki.';
      message.className = 'admin-user-message is-error';
      form.elements[firstName.length < 2 ? 'firstName' : 'lastName'].focus();
      return;
    }

    save.disabled = true;
    save.textContent = 'Zapisywanie…';
    message.textContent = '';
    message.className = 'admin-user-message';
    try {
      const token = await getAdminToken();
      const originalRoles = Array.from(new Set(originalUser.roles)).sort();
      const selectedRoles = Array.from(new Set(roles)).sort();
      const rolesChanged = originalRoles.length !== selectedRoles.length
        || originalRoles.some((role, index) => role !== selectedRoles[index]);
      const body = { id: originalUser.id, firstName, lastName };
      if (rolesChanged) body.roles = roles;
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const payload = await readAdminResponse(response);
      const returned = payload && payload.user ? adminProfileFrom(payload.user) : null;
      originalUser.firstName = returned && returned.firstName ? returned.firstName : firstName;
      originalUser.lastName = returned && returned.lastName ? returned.lastName : lastName;
      originalUser.roles = returned ? returned.roles : roles;
      originalUser.timedAccess = returned ? returned.timedAccess : originalUser.timedAccess;
      const card = form.closest('.admin-user-card');
      card.dataset.search = normalizeText(`${originalUser.firstName} ${originalUser.lastName} ${originalUser.email}`);
      card.querySelector('.admin-user-heading h3').textContent = adminDisplayName(originalUser);
      card.querySelector('.admin-user-avatar').textContent = initialsFor(adminDisplayName(originalUser));
      refreshTimedAccessStatus(card, originalUser);
      const accessSummary = card.querySelector('[data-admin-access-summary]');
      if (accessSummary) accessSummary.textContent = remainingAccessLabel(originalUser);
      const factValues = card.querySelectorAll('.admin-account-fact strong');
      if (factValues[2]) factValues[2].textContent = remainingAccessLabel(originalUser);
      message.textContent = payload && payload.sessionRefreshRequired
        ? 'Zapisano. Nowe uprawnienia pojawią się po odświeżeniu sesji użytkownika.'
        : 'Zmiany zostały zapisane.';
      message.className = 'admin-user-message is-success';
    } catch (error) {
      message.textContent = error && error.message ? error.message : 'Nie udało się zapisać zmian.';
      message.className = 'admin-user-message is-error';
    } finally {
      save.disabled = false;
      save.textContent = 'Zapisz użytkownika';
    }
  }

  async function renewAdminTimedAccess(user, button) {
    const timedRole = user.roles.find((role) => !['admin', 'active'].includes(role));
    if (!timedRole) return;
    const roleLabel = ACCESS_ROLE_OPTIONS.find((option) => option.value === timedRole)?.label || timedRole;
    if (!window.confirm(`Przygotować nowy okres „${roleLabel}” dla konta ${adminDisplayName(user)}? Rozpocznie się przy następnym logowaniu.`)) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Odnawianie…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: user.id, roles: user.roles })
      });
      const payload = await readAdminResponse(response);
      const returned = payload && payload.user ? adminProfileFrom(payload.user) : null;
      if (returned) {
        user.roles = returned.roles;
        user.timedAccess = returned.timedAccess;
      } else {
        user.timedAccess = null;
      }
      const card = button.closest('.admin-user-card');
      refreshTimedAccessStatus(card, user);
      const message = card.querySelector('.admin-user-message');
      message.className = 'admin-user-message is-success';
      message.textContent = 'Odnowienie jest gotowe. Nowy okres rozpocznie się przy następnym logowaniu.';
    } catch (error) {
      const card = button.closest('.admin-user-card');
      const message = card.querySelector('.admin-user-message');
      message.className = 'admin-user-message is-error';
      message.textContent = error && error.message ? error.message : 'Nie udało się odnowić dostępu.';
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  async function inviteAdminUser(event) {
    event.preventDefault();
    const firstName = String(elements.adminInviteFirstName.value || '').replace(/\s+/g, ' ').trim();
    const lastName = String(elements.adminInviteLastName.value || '').replace(/\s+/g, ' ').trim();
    const email = String(elements.adminInviteEmail.value || '').trim().toLocaleLowerCase('pl');
    const roles = [];
    const accessRole = String(elements.adminInviteRole.value || '');
    if (COURSE_ROLE_VALUES.has(accessRole)) roles.push(accessRole);
    if (elements.adminInviteIsAdmin.checked) roles.unshift('admin');

    elements.adminInviteMessage.className = 'admin-user-message';
    elements.adminInviteMessage.textContent = '';
    if (!elements.adminInviteForm.reportValidity()) return;
    if (firstName.length < 2 || lastName.length < 2) {
      elements.adminInviteMessage.className = 'admin-user-message is-error';
      elements.adminInviteMessage.textContent = 'Imię i nazwisko muszą mieć co najmniej 2 znaki.';
      (firstName.length < 2 ? elements.adminInviteFirstName : elements.adminInviteLastName).focus();
      return;
    }

    const originalText = elements.adminInviteSubmit.textContent;
    elements.adminInviteSubmit.disabled = true;
    elements.adminInviteSubmit.textContent = 'Wysyłanie…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, firstName, lastName, roles })
      });
      const payload = await readAdminResponse(response);
      const invited = payload && payload.user ? adminProfileFrom(payload.user) : null;
      if (invited && invited.id) {
        adminUsers = [invited, ...adminUsers.filter((user) => user.id !== invited.id)];
        renderAdminUsers();
      }
      elements.adminInviteForm.reset();
      elements.adminInviteMessage.className = 'admin-user-message is-success';
      elements.adminInviteMessage.textContent = `Zaproszenie wysłano na ${email}.`;
    } catch (error) {
      elements.adminInviteMessage.className = 'admin-user-message is-error';
      elements.adminInviteMessage.textContent = error && error.message ? error.message : 'Nie udało się wysłać zaproszenia.';
    } finally {
      elements.adminInviteSubmit.disabled = false;
      elements.adminInviteSubmit.textContent = originalText;
    }
  }

  async function deleteAdminUser(user, button) {
    const label = adminDisplayName(user);
    if (!window.confirm(`Usunąć konto „${label}” (${user.email}) i jego historię płatności z ChemDisk? Tej operacji nie można cofnąć. Dane transakcji pozostaną w Stripe.`)) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_USERS_URL, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: user.id })
      });
      await readAdminResponse(response);
      adminUsers = adminUsers.filter((entry) => entry.id !== user.id);
      renderAdminUsers();
      setAdminStatus(`Usunięto konto ${label}.`, 'info');
    } catch (error) {
      setAdminStatus(error && error.message ? error.message : 'Nie udało się usunąć konta.', 'error');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function normalizeAdminForm(rawForm) {
    const source = rawForm && typeof rawForm === 'object' ? rawForm : {};
    const id = String(source.id || source.formId || source.form_id || '').trim();
    const name = String(source.name || source.title || source.formName || source.form_name || '').trim();
    const countValue = source.submissionCount ?? source.submission_count ?? source.count;
    const submissionCount = Number.isFinite(Number(countValue)) ? Math.max(0, Number(countValue)) : null;
    return { id, name: name || 'Formularz bez nazwy', submissionCount };
  }

  function normalizeAdminSubmission(rawSubmission) {
    const source = rawSubmission && typeof rawSubmission === 'object' ? rawSubmission : {};
    const data = source.data && typeof source.data === 'object' && !Array.isArray(source.data)
      ? source.data
      : source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields) ? source.fields : {};
    const mergedData = { ...data };
    [
      ['name', source.name],
      ['email', source.email],
      ['first_name', source.firstName || source.first_name],
      ['last_name', source.lastName || source.last_name],
      ['company', source.company],
      ['summary', source.summary],
      ['body', source.body]
    ].forEach(([key, value]) => {
      if (value != null && value !== '' && mergedData[key] == null) mergedData[key] = value;
    });
    const selectedForm = adminForms.find((form) => form.id === elements.adminFormFilter.value);
    return {
      id: String(source.id || source.submissionId || source.submission_id || '').trim(),
      number: source.number == null ? null : Number(source.number),
      createdAt: String(source.createdAt || source.created_at || '').trim(),
      formName: String(source.formName || source.form_name || source.title || (selectedForm && selectedForm.name) || '').trim(),
      deleteToken: String(source.deleteToken || source.delete_token || '').trim(),
      data: mergedData
    };
  }

  function submissionDateLabel(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Data niedostępna';
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function submissionFieldLabel(key) {
    const labels = {
      email: 'E-mail',
      form_name: 'Formularz',
      internal_note: 'Wiadomość wewnętrzna',
      message: 'Wiadomość',
      name: 'Imię i nazwisko'
    };
    return labels[key] || String(key || '').replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('pl'));
  }

  function submissionFieldValue(value) {
    if (value == null) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try { return JSON.stringify(value, null, 2); } catch (_) { return '[Nie można wyświetlić wartości]'; }
  }

  function createSubmissionCard(submission) {
    const article = document.createElement('article');
    article.className = 'admin-submission-card';
    article.dataset.submissionId = submission.id;

    const heading = document.createElement('header');
    heading.className = 'admin-submission-heading';
    const copy = document.createElement('div');
    const name = String(submission.data.name || submission.data.email || '').trim();
    const title = document.createElement('h3');
    title.textContent = name || (submission.number ? `Zgłoszenie #${submission.number}` : 'Zgłoszenie formularza');
    const meta = document.createElement('p');
    meta.textContent = [submission.formName, submissionDateLabel(submission.createdAt)].filter(Boolean).join(' · ');
    copy.append(title, meta);
    const remove = document.createElement('button');
    remove.className = 'admin-delete-button';
    remove.type = 'button';
    remove.textContent = 'Usuń';
    remove.setAttribute('aria-label', `Usuń: ${title.textContent}`);
    remove.addEventListener('click', () => deleteAdminSubmission(submission, remove));
    heading.append(copy, remove);

    const fields = document.createElement('dl');
    fields.className = 'admin-submission-fields';
    const ignoredFields = new Set(['form-name', 'form_name', 'g-recaptcha-response']);
    Object.entries(submission.data).forEach(([key, value]) => {
      if (ignoredFields.has(key)) return;
      const field = document.createElement('div');
      field.className = 'admin-submission-field';
      const term = document.createElement('dt');
      term.textContent = submissionFieldLabel(key);
      const description = document.createElement('dd');
      description.textContent = submissionFieldValue(value);
      field.append(term, description);
      fields.append(field);
    });
    if (!fields.children.length) {
      const field = document.createElement('div');
      field.className = 'admin-submission-field';
      const term = document.createElement('dt');
      term.textContent = 'Treść';
      const description = document.createElement('dd');
      description.textContent = 'To zgłoszenie nie zawiera pól do wyświetlenia.';
      field.append(term, description);
      fields.append(field);
    }
    article.append(heading, fields);
    return article;
  }

  function renderAdminSubmissions() {
    const fragment = document.createDocumentFragment();
    adminSubmissions.forEach((submission) => fragment.append(createSubmissionCard(submission)));
    elements.adminSubmissionList.replaceChildren(fragment);
    elements.adminFormsEmpty.hidden = adminSubmissions.length > 0;
    setPanelStatus(
      elements.adminFormsStatus,
      adminSubmissions.length ? polishCountLabel(adminSubmissions.length, 'zgłoszenie', 'zgłoszenia', 'zgłoszeń') : '',
      'info'
    );
  }

  function renderAdminFormOptions(selectedId) {
    const previous = selectedId || elements.adminFormFilter.value;
    const fragment = document.createDocumentFragment();
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = adminForms.length ? 'Wybierz formularz' : 'Brak formularzy';
    fragment.append(emptyOption);
    adminForms.forEach((form) => {
      const option = document.createElement('option');
      option.value = form.id;
      option.textContent = form.submissionCount == null ? form.name : `${form.name} (${form.submissionCount})`;
      fragment.append(option);
    });
    elements.adminFormFilter.replaceChildren(fragment);
    const nextId = adminForms.some((form) => form.id === previous) ? previous : (adminForms[0] ? adminForms[0].id : '');
    elements.adminFormFilter.value = nextId;
    return nextId;
  }

  async function loadAdminForms() {
    const requestId = ++adminFormsRequestId;
    elements.adminFormsRefresh.disabled = true;
    elements.adminFormFilter.disabled = true;
    elements.adminSubmissionList.replaceChildren();
    elements.adminFormsEmpty.hidden = true;
    setPanelStatus(elements.adminFormsStatus, 'Wczytywanie formularzy…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_FORMS_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      const payload = await readAdminResponse(response);
      if (requestId !== adminFormsRequestId) return;
      adminForms = (payload && Array.isArray(payload.forms) ? payload.forms : [])
        .map(normalizeAdminForm)
        .filter((form) => form.id);
      const selectedId = renderAdminFormOptions();
      adminFormsLoaded = true;
      if (selectedId) await loadAdminSubmissions(selectedId, token, requestId);
      else {
        adminSubmissions = [];
        renderAdminSubmissions();
      }
    } catch (error) {
      if (requestId !== adminFormsRequestId) return;
      adminFormsLoaded = false;
      adminForms = [];
      adminSubmissions = [];
      renderAdminFormOptions('');
      elements.adminFormsEmpty.hidden = true;
      setPanelStatus(elements.adminFormsStatus, error && error.message ? error.message : 'Nie udało się wczytać formularzy.', 'error');
    } finally {
      if (requestId !== adminFormsRequestId) return;
      elements.adminFormsRefresh.disabled = false;
      elements.adminFormFilter.disabled = false;
      elements.adminSubmissionList.setAttribute('aria-busy', 'false');
    }
  }

  async function loadAdminSubmissions(formId, existingToken, inheritedRequestId) {
    const requestId = inheritedRequestId || ++adminFormsRequestId;
    if (!formId) {
      adminSubmissions = [];
      renderAdminSubmissions();
      return;
    }
    elements.adminSubmissionList.setAttribute('aria-busy', 'true');
    elements.adminSubmissionList.replaceChildren();
    elements.adminFormsEmpty.hidden = true;
    setPanelStatus(elements.adminFormsStatus, 'Wczytywanie zgłoszeń…', 'loading');
    try {
      const token = existingToken || await getAdminToken();
      const collected = [];
      let page = 1;
      let hasMore = false;
      do {
        const query = new URLSearchParams({ formId, page: String(page), perPage: '50' });
        const response = await fetch(`${ADMIN_FORMS_URL}?${query}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
        });
        const payload = await readAdminResponse(response);
        if (requestId !== adminFormsRequestId) return;
        const submissions = payload && Array.isArray(payload.submissions) ? payload.submissions : [];
        collected.push(...submissions);
        hasMore = Boolean(payload && payload.pagination && payload.pagination.hasMore);
        page += 1;
        if (hasMore) setPanelStatus(elements.adminFormsStatus, `Wczytywanie zgłoszeń… ${collected.length}`, 'loading');
      } while (hasMore && page <= 100);
      if (hasMore) throw new Error('Lista zgłoszeń jest zbyt długa, aby wyświetlić ją w całości.');
      adminSubmissions = collected.map(normalizeAdminSubmission).filter((submission) => submission.id && submission.deleteToken);
      renderAdminSubmissions();
    } catch (error) {
      if (requestId !== adminFormsRequestId) return;
      adminSubmissions = [];
      elements.adminFormsEmpty.hidden = true;
      setPanelStatus(elements.adminFormsStatus, error && error.message ? error.message : 'Nie udało się wczytać zgłoszeń.', 'error');
    } finally {
      if (requestId !== adminFormsRequestId) return;
      elements.adminSubmissionList.setAttribute('aria-busy', 'false');
    }
  }

  async function exportAllAdminFormSubmissions() {
    const button = elements.adminFormsExport;
    if (!button || button.disabled) return;
    const originalText = button.textContent;
    button.disabled = true;
    elements.adminFormsRefresh.disabled = true;
    button.textContent = 'Pobieranie…';
    setPanelStatus(elements.adminFormsStatus, 'Przygotowywanie pełnego eksportu formularzy…', 'loading');
    try {
      const token = await getAdminToken();
      const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
      const formsResponse = await fetch(ADMIN_FORMS_URL, {
        method: 'GET',
        cache: 'no-store',
        headers
      });
      const formsPayload = await readAdminResponse(formsResponse);
      const forms = (formsPayload && Array.isArray(formsPayload.forms) ? formsPayload.forms : [])
        .map((source) => {
          const normalized = normalizeAdminForm(source);
          return {
            ...normalized,
            paths: Array.isArray(source && source.paths)
              ? source.paths.map((path) => String(path || '')).filter(Boolean)
              : [],
            createdAt: String(source && (source.createdAt || source.created_at) || '')
          };
        })
        .filter((form) => form.id);

      const exportedForms = [];
      let totalSubmissions = 0;
      for (let formIndex = 0; formIndex < forms.length; formIndex += 1) {
        const form = forms[formIndex];
        const submissions = [];
        let page = 1;
        let hasMore = false;
        do {
          setPanelStatus(
            elements.adminFormsStatus,
            `Pobieranie formularza ${formIndex + 1} z ${forms.length}: ${form.name} · ${submissions.length} odpowiedzi`,
            'loading'
          );
          const query = new URLSearchParams({
            formId: form.id,
            page: String(page),
            perPage: '50'
          });
          const response = await fetch(`${ADMIN_FORMS_URL}?${query}`, {
            method: 'GET',
            cache: 'no-store',
            headers
          });
          const payload = await readAdminResponse(response);
          const pageSubmissions = payload && Array.isArray(payload.submissions)
            ? payload.submissions
            : [];
          pageSubmissions.forEach((rawSubmission) => {
            const submission = normalizeAdminSubmission(rawSubmission);
            if (!submission.id) return;
            submissions.push({
              id: submission.id,
              number: submission.number,
              createdAt: submission.createdAt,
              formName: form.name,
              data: submission.data
            });
          });
          hasMore = Boolean(payload && payload.pagination && payload.pagination.hasMore);
          page += 1;
        } while (hasMore && page <= 10_000);
        if (hasMore) {
          throw new Error(`Formularz „${form.name}” przekracza limit pełnego eksportu.`);
        }
        totalSubmissions += submissions.length;
        exportedForms.push({ ...form, submissions });
      }

      const exportedAt = new Date().toISOString();
      const content = JSON.stringify({
        exportedAt,
        formCount: exportedForms.length,
        submissionCount: totalSubmissions,
        forms: exportedForms
      }, null, 2);
      const blobUrl = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `chemdisk-formularze-${exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setPanelStatus(
        elements.adminFormsStatus,
        `Pobrano ${exportedForms.length} formularzy i ${totalSubmissions} odpowiedzi w jednym pliku JSON.`,
        'info'
      );
    } catch (error) {
      setPanelStatus(
        elements.adminFormsStatus,
        error && error.message ? error.message : 'Nie udało się pobrać wszystkich formularzy.',
        'error'
      );
    } finally {
      button.disabled = false;
      elements.adminFormsRefresh.disabled = false;
      button.textContent = originalText;
    }
  }

  async function deleteAdminSubmission(submission, button) {
    const person = String(submission.data.name || submission.data.email || '').trim();
    const suffix = person ? ` od ${person}` : '';
    if (!window.confirm(`Trwale usunąć to zgłoszenie${suffix}? Tej operacji nie można cofnąć.`)) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '…';
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_FORMS_URL, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ submissionId: submission.id, deleteToken: submission.deleteToken })
      });
      await readAdminResponse(response);
      adminSubmissions = adminSubmissions.filter((entry) => entry.id !== submission.id);
      renderAdminSubmissions();
      setPanelStatus(elements.adminFormsStatus, 'Zgłoszenie zostało trwale usunięte.', 'info');
    } catch (error) {
      setPanelStatus(elements.adminFormsStatus, error && error.message ? error.message : 'Nie udało się usunąć zgłoszenia.', 'error');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function renderAdminDashboardPreview(content) {
    const model = ensureRequiredDashboardModel(parseMarkdown(content));
    const fragment = document.createDocumentFragment();
    const heading = document.createElement('h3');
    heading.textContent = model.title;
    const summary = document.createElement('p');
    const count = model.sections.reduce((sum, section) => sum + validDashboardItemCount(section), 0);
    summary.textContent = `${polishCountLabel(model.sections.length, 'dział', 'działy', 'działów')} · ${resourceLabel(count)}`;
    const sections = document.createElement('div');
    sections.className = 'admin-preview-sections';
    model.sections.forEach((section) => {
      const validCount = validDashboardItemCount(section);
      const card = document.createElement('div');
      card.className = 'admin-preview-section';
      const title = document.createElement('strong');
      title.textContent = section.title;
      const details = document.createElement('span');
      const groupCount = accordionGroupCount(section.groups);
      const groupLabel = groupCount
        ? ` · ${polishCountLabel(groupCount, 'harmonijka', 'harmonijki', 'harmonijek')}`
        : '';
      details.textContent = `${resourceLabel(validCount)}${groupLabel}`;
      card.append(title, details);
      sections.append(card);
    });
    fragment.append(heading, summary, sections);
    elements.adminDashboardPreview.replaceChildren(fragment);
    return model;
  }

  function validDashboardItemCount(section) {
    const direct = (section.items || []).filter((item) => safeUrl(item.href)).length;
    const grouped = (section.groups || []).reduce((sum, group) => sum + validGroupItemCount(group), 0);
    return direct + grouped;
  }

  function validGroupItemCount(group) {
    const direct = (group.items || []).filter((item) => safeUrl(item.href)).length;
    return direct + (group.groups || []).reduce((sum, child) => sum + validGroupItemCount(child), 0);
  }

  function accordionGroupCount(groups) {
    return (groups || []).reduce(
      (sum, group) => sum + 1 + accordionGroupCount(group.groups),
      0
    );
  }

  function validateDashboardEditorContent(content) {
    const rawText = String(content || '').replace(/\r\n?/g, '\n').trim();
    if (!rawText) throw new Error('Dashboard nie może być pusty.');
    const text = ensureRequiredHelpSection(rawText);
    if (new TextEncoder().encode(text).byteLength > 256 * 1024) throw new Error('Dashboard jest zbyt duży.');
    const model = parseMarkdown(text);
    if (!model.sections.length) throw new Error('Dodaj co najmniej jeden dział rozpoczynający się od ##.');
    const cardCount = model.sections.reduce((sum, section) => sum + validDashboardItemCount(section), 0);
    if (!cardCount) throw new Error('Dodaj co najmniej jedną kartę materiału w wybranym dziale.');
    return { text, model };
  }

  function setAdminDashboardBusy(busy) {
    [
      elements.adminDashboardReload,
      elements.adminDashboardRestore,
      elements.adminDashboardPreviewButton,
      elements.adminDashboardSave
    ].forEach((button) => { if (button) button.disabled = Boolean(busy); });
    if (!busy) {
      elements.adminDashboardPreviewButton.disabled = !adminDashboardLoaded;
      elements.adminDashboardSave.disabled = !adminDashboardLoaded;
      elements.adminDashboardRestore.disabled = !adminDashboardLoaded;
    }
  }

  async function loadAdminDashboardEditor() {
    setAdminDashboardBusy(true);
    setPanelStatus(elements.adminDashboardStatus, 'Wczytywanie dashboardu…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_DASHBOARD_URL, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      let content = '';
      if (response.status === 404) {
        content = await fetchStaticDashboard();
        adminDashboardEtag = null;
        adminDashboardSourceKind = 'static';
      } else {
        const payload = await readAdminResponse(response);
        if (payload && payload.source === 'static') {
          content = await fetchStaticDashboard();
          adminDashboardEtag = null;
          adminDashboardSourceKind = 'static';
        } else {
          if (!payload || typeof payload.content !== 'string') throw new Error('Serwer zwrócił nieprawidłową treść dashboardu.');
          content = payload.content;
          adminDashboardEtag = typeof payload.etag === 'string' ? payload.etag : null;
          adminDashboardSourceKind = 'blob';
        }
      }
      const editorContent = ensureRequiredHelpSection(content);
      elements.adminDashboardSource.value = editorContent;
      adminDashboardBaseline = editorContent;
      adminDashboardLoaded = true;
      renderAdminDashboardPreview(editorContent);
      setPanelStatus(
        elements.adminDashboardStatus,
        adminDashboardSourceKind === 'blob'
          ? 'Wczytano aktywną wersję zapisaną w Netlify.'
          : 'Wczytano pełny dashboard.md z wdrożenia wraz ze wszystkimi przykładowymi klockami.',
        'info'
      );
    } catch (error) {
      adminDashboardLoaded = false;
      adminDashboardEtag = null;
      adminDashboardSourceKind = 'static';
      adminDashboardBaseline = '';
      elements.adminDashboardSource.value = '';
      elements.adminDashboardPreview.replaceChildren();
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie udało się wczytać dashboardu.', 'error');
    } finally {
      setAdminDashboardBusy(false);
    }
  }

  function previewAdminDashboard() {
    try {
      const { text } = validateDashboardEditorContent(elements.adminDashboardSource.value);
      renderAdminDashboardPreview(text);
      setPanelStatus(elements.adminDashboardStatus, 'Podgląd został odświeżony. Zmiany nie są jeszcze opublikowane.', 'info');
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie można utworzyć podglądu.', 'error');
    }
  }

  async function saveAdminDashboard() {
    if (!adminDashboardLoaded) {
      setPanelStatus(elements.adminDashboardStatus, 'Najpierw wczytaj aktywny dashboard.', 'error');
      return;
    }
    let text;
    let model;
    try {
      ({ text, model } = validateDashboardEditorContent(elements.adminDashboardSource.value));
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error.message, 'error');
      return;
    }
    setAdminDashboardBusy(true);
    setPanelStatus(elements.adminDashboardStatus, 'Publikowanie zmian…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(ADMIN_DASHBOARD_URL, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: text, expectedEtag: adminDashboardEtag })
      });
      const payload = await readAdminResponse(response);
      adminDashboardEtag = payload && typeof payload.etag === 'string' ? payload.etag : adminDashboardEtag;
      adminDashboardSourceKind = 'blob';
      adminDashboardBaseline = text;
      elements.adminDashboardSource.value = text;
      renderAdminDashboardPreview(text);
      try {
        await syncDashboardProgressCatalog(model);
        renderDashboard(model, true);
        setPanelStatus(
          elements.adminDashboardStatus,
          'Dashboard został opublikowany. Postęp obejmuje teraz wyłącznie materiały znajdujące się w aktualnym dashboardzie.',
          'info'
        );
      } catch (progressError) {
        renderDashboard(model);
        setPanelStatus(
          elements.adminDashboardStatus,
          `Dashboard zapisano, ale nie udało się zsynchronizować postępu: ${progressError?.message || 'spróbuj opublikować ponownie.'}`,
          'error'
        );
      }
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie udało się opublikować dashboardu.', 'error');
    } finally {
      setAdminDashboardBusy(false);
    }
  }

  async function restoreStaticDashboard() {
    if (!adminDashboardLoaded) return;
    const removesOverride = adminDashboardSourceKind === 'blob';
    const confirmation = removesOverride
      ? 'Przywrócić dashboard.md z ostatniego wdrożenia? Aktywna wersja zapisana w Netlify zostanie usunięta.'
      : 'Wczytać ponownie dashboard.md z wdrożenia i zsynchronizować z nim statusy postępu?';
    if (!window.confirm(confirmation)) return;
    setAdminDashboardBusy(true);
    setPanelStatus(elements.adminDashboardStatus, 'Przywracanie wersji z wdrożenia…', 'loading');
    try {
      if (removesOverride) {
        const token = await getAdminToken();
        const response = await fetch(ADMIN_DASHBOARD_URL, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ expectedEtag: adminDashboardEtag })
        });
        await readAdminResponse(response);
      }
      const content = await fetchStaticDashboard(true);
      adminDashboardEtag = null;
      adminDashboardSourceKind = 'static';
      const editorContent = ensureRequiredHelpSection(content);
      const model = parseMarkdown(editorContent);
      adminDashboardBaseline = editorContent;
      elements.adminDashboardSource.value = editorContent;
      renderAdminDashboardPreview(editorContent);
      try {
        const synced = await syncDashboardProgressCatalog(model);
        renderDashboard(model, true);
        setPanelStatus(
          elements.adminDashboardStatus,
          `Przywrócono pełny dashboard.md i zsynchronizowano postęp. Usunięte materiały: ${Number(synced.removedCount) || 0}.`,
          'info'
        );
      } catch (progressError) {
        renderDashboard(model);
        setPanelStatus(
          elements.adminDashboardStatus,
          `Przywrócono dashboard.md, ale nie udało się zsynchronizować postępu: ${progressError?.message || 'spróbuj ponownie.'}`,
          'error'
        );
      }
    } catch (error) {
      setPanelStatus(elements.adminDashboardStatus, error && error.message ? error.message : 'Nie udało się przywrócić pliku.', 'error');
    } finally {
      setAdminDashboardBusy(false);
    }
  }

  async function loadAdminContentStatus(force) {
    const requestId = ++adminContentStatusRequestId;
    const library = window.ChemContentLibrary;
    if (!library || typeof library.status !== 'function') {
      setPanelStatus(elements.adminContentStatus, 'Brakuje klienta biblioteki materiałów.', 'error');
      return;
    }
    elements.adminContentRefresh.disabled = true;
    setPanelStatus(elements.adminContentStatus, 'Sprawdzanie połączenia z prywatnym repozytorium…', 'loading');
    try {
      if (!adminContentRepositories.length) {
        adminContentRepositories = await library.repositories();
      }
      if (requestId !== adminContentStatusRequestId) return;
      if (!adminContentRepositories.length) throw new Error('Nie skonfigurowano żadnego repozytorium.');
      if (!adminContentRepositories.some((repository) => repository.id === adminContentRepositoryId)) {
        const fallback = adminContentRepositories.find((repository) => repository.default)
          || adminContentRepositories[0];
        adminContentRepositoryId = fallback.id;
      }
      elements.adminContentRepositorySelect.replaceChildren(
        ...adminContentRepositories.map((repository) => {
          const option = document.createElement('option');
          option.value = repository.id;
          option.textContent = repository.label || repository.repository;
          return option;
        })
      );
      elements.adminContentRepositorySelect.value = adminContentRepositoryId;
      elements.adminContentRepositorySelect.disabled = adminContentRepositories.length < 2;
      const payload = await library.status({
        refresh: Boolean(force),
        repositoryId: adminContentRepositoryId
      });
      if (requestId !== adminContentStatusRequestId) return;
      const configuration = payload && payload.configuration ? payload.configuration : {};
      const counts = payload && payload.counts ? payload.counts : {};
      elements.adminContentLessons.textContent = String(Number(counts.lessons) || 0);
      elements.adminContentPrompts.textContent = String(Number(counts.prompts) || 0);
      if (configuration.repository) {
        const suffix = [
          configuration.ref ? `gałąź ${configuration.ref}` : '',
          configuration.root ? `katalog ${configuration.root}` : ''
        ].filter(Boolean).join(' · ');
        elements.adminContentRepository.textContent = `${configuration.repository}${suffix ? ` · ${suffix}` : ''}`;
      } else {
        elements.adminContentRepository.textContent = 'Brak poprawnej konfiguracji wybranego repozytorium.';
      }

      if (payload.connection === 'ready') {
        elements.adminContentConnection.textContent = 'Połączono — materiały są dostępne';
        elements.adminContentConnection.dataset.state = 'ready';
        setPanelStatus(
          elements.adminContentStatus,
          'Lista jest pobierana na bieżąco z GitHuba. Zmiana pliku nie wymaga deployu aplikacji.',
          'info'
        );
      } else if (payload.connection === 'not_configured') {
        elements.adminContentConnection.textContent = 'Wymaga konfiguracji';
        elements.adminContentConnection.dataset.state = 'error';
        setPanelStatus(
          elements.adminContentStatus,
          'Dodaj token i konfigurację repozytorium w zmiennych środowiskowych Netlify.',
          'error'
        );
      } else {
        const message = ADMIN_ERROR_MESSAGES[payload.error]
          || library.ERROR_MESSAGES[payload.error]
          || 'Nie udało się połączyć z prywatnym repozytorium.';
        elements.adminContentConnection.textContent = 'Błąd połączenia';
        elements.adminContentConnection.dataset.state = 'error';
        setPanelStatus(elements.adminContentStatus, message, 'error');
      }
      adminContentLoaded = true;
    } catch (error) {
      if (requestId !== adminContentStatusRequestId) return;
      adminContentLoaded = false;
      elements.adminContentConnection.textContent = 'Błąd połączenia';
      elements.adminContentConnection.dataset.state = 'error';
      setPanelStatus(
        elements.adminContentStatus,
        error && error.message ? error.message : 'Nie udało się sprawdzić repozytorium.',
        'error'
      );
    } finally {
      if (requestId === adminContentStatusRequestId) elements.adminContentRefresh.disabled = false;
    }
  }

  async function copyContentEnvironmentTemplate() {
    const text = elements.adminContentEnvTemplate.textContent;
    try {
      await navigator.clipboard.writeText(text);
      setPanelStatus(elements.adminContentStatus, 'Skopiowano szablon zmiennych. Wstaw właściwy token wyłącznie w Netlify.', 'info');
    } catch (_) {
      setPanelStatus(elements.adminContentStatus, 'Nie udało się skopiować. Zaznacz szablon i skopiuj go ręcznie.', 'error');
    }
  }

  function contentRepositoryDraft(value) {
    return {
      id: typeof value?.id === 'string' ? value.id : '',
      label: typeof value?.label === 'string' ? value.label : '',
      repository: typeof value?.repository === 'string' ? value.repository : '',
      ref: typeof value?.ref === 'string' && value.ref ? value.ref : 'main',
      root: typeof value?.root === 'string' ? value.root : '',
      default: Boolean(value?.default),
      tokenConfigured: Boolean(value?.tokenConfigured),
      tokenEnv: typeof value?.tokenEnv === 'string' ? value.tokenEnv : '',
      secret: typeof value?.secret === 'string' ? value.secret : ''
    };
  }

  function contentTokenEnvironmentName(draft) {
    if (draft?.tokenEnv) return draft.tokenEnv;
    const id = String(draft?.id || '').trim().toUpperCase().replace(/-/g, '_');
    if (draft?.default && !adminContentConfigBaseTokenReserved) return 'GITHUB_CONTENT_TOKEN';
    return /^[A-Z0-9][A-Z0-9_]{0,39}$/.test(id)
      ? `GITHUB_CONTENT_TOKEN_${id}`
      : 'GITHUB_CONTENT_TOKEN_<ID>';
  }

  function createContentConfigField(label, field, value, options = {}) {
    const wrapper = document.createElement('label');
    if (options.wide) wrapper.className = 'is-wide';
    const title = document.createElement('span');
    title.className = 'field-label';
    title.textContent = label;
    const input = document.createElement('input');
    input.type = options.type || 'text';
    input.value = value || '';
    input.placeholder = options.placeholder || '';
    input.maxLength = options.maxLength || 200;
    input.autocomplete = options.type === 'password' ? 'new-password' : 'off';
    input.spellcheck = false;
    input.autocapitalize = 'none';
    if (options.required) input.required = true;
    if (options.pattern) input.pattern = options.pattern;
    input.dataset.contentField = field;
    if (options.description) input.setAttribute('aria-description', options.description);
    wrapper.append(title, input);
    return wrapper;
  }

  function renderAdminContentConfigurator() {
    const fragment = document.createDocumentFragment();
    adminContentConfigDrafts.forEach((draft, index) => {
      const row = document.createElement('fieldset');
      row.className = 'admin-content-config-row';
      row.dataset.contentRepositoryIndex = String(index);
      const legend = document.createElement('legend');
      legend.textContent = draft.label || draft.repository || `Repozytorium ${index + 1}`;

      const heading = document.createElement('div');
      heading.className = 'admin-content-config-row-heading';
      const explanation = document.createElement('small');
      explanation.textContent = `Zmienna Netlify: ${contentTokenEnvironmentName(draft)}`;
      const tokenState = document.createElement('span');
      const tokenReady = draft.tokenConfigured || Boolean(draft.secret);
      tokenState.className = `admin-content-token-state${tokenReady ? ' is-ready' : ''}${adminContentConfigPendingDeploy ? ' is-pending' : ''}`;
      tokenState.textContent = adminContentConfigPendingDeploy
        ? (adminContentConfigDeployQueued ? 'Deploy w toku' : 'Wymaga deployu')
        : draft.tokenConfigured
          ? 'Token zapisany'
          : draft.secret
            ? 'Token wpisany'
            : 'Token lub ENV wymagany';
      heading.append(explanation, tokenState);

      const grid = document.createElement('div');
      grid.className = 'admin-content-config-grid';
      grid.append(
        createContentConfigField('ID (małe litery)', 'id', draft.id, { placeholder: 'default', maxLength: 40, required: true, pattern: '[a-z0-9][a-z0-9-]{0,39}' }),
        createContentConfigField('Nazwa widoczna w panelu', 'label', draft.label, { placeholder: 'Chemia organiczna', maxLength: 80, required: true }),
        createContentConfigField('Gałąź', 'ref', draft.ref, { placeholder: 'main', maxLength: 200, required: true }),
        createContentConfigField('Repozytorium owner/nazwa', 'repository', draft.repository, { placeholder: 'Kuczis-Media/chemia-organiczna', maxLength: 140, wide: true, required: true, pattern: '[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' }),
        createContentConfigField('Katalog główny (opcjonalnie)', 'root', draft.root, { placeholder: 'kurs', maxLength: 300 }),
        createContentConfigField('Fine-grained token (Personal+)', 'secret', draft.secret || '', {
          type: 'password',
          placeholder: draft.tokenConfigured ? 'Pozostaw puste, aby zachować' : 'Personal+: github_pat_… · Free: ustaw ENV ręcznie',
          maxLength: 500,
          wide: true
        })
      );

      const actions = document.createElement('div');
      actions.className = 'admin-content-config-row-actions';
      const defaultLabel = document.createElement('label');
      defaultLabel.className = 'admin-content-default';
      const defaultInput = document.createElement('input');
      defaultInput.type = 'radio';
      defaultInput.name = 'admin-content-default-repository';
      defaultInput.checked = draft.default;
      defaultInput.dataset.contentField = 'default';
      defaultLabel.append(defaultInput, document.createTextNode(' Repozytorium domyślne'));
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'admin-content-config-button-group';
      const testButton = document.createElement('button');
      testButton.className = 'button button-secondary';
      testButton.type = 'button';
      testButton.dataset.contentAction = 'test';
      testButton.textContent = 'Sprawdź dostęp';
      const removeButton = document.createElement('button');
      removeButton.className = 'button button-secondary button-danger-soft';
      removeButton.type = 'button';
      removeButton.dataset.contentAction = 'remove';
      removeButton.disabled = adminContentConfigDrafts.length === 1;
      removeButton.textContent = 'Usuń z konfiguracji';
      buttonGroup.append(testButton, removeButton);
      actions.append(defaultLabel, buttonGroup);
      row.append(legend, heading, grid, actions);
      fragment.append(row);
    });
    elements.adminContentConfigList.replaceChildren(fragment);
    setAdminContentConfigBusy(adminContentConfigBusy);
  }

  function collectAdminContentDrafts() {
    const rows = Array.from(elements.adminContentConfigList.querySelectorAll('[data-content-repository-index]'));
    return rows.map((row, index) => {
      const previous = adminContentConfigDrafts[index] || {};
      const rawValue = (field) => row.querySelector(`[data-content-field="${field}"]`)?.value || '';
      const value = (field) => rawValue(field).trim();
      const id = value('id').toLowerCase();
      const sameIdentity = id === String(previous.id || '').toLowerCase();
      return {
        id,
        label: value('label'),
        repository: value('repository'),
        ref: value('ref') || 'main',
        root: value('root').replace(/^\/+|\/+$/g, ''),
        default: Boolean(row.querySelector('[data-content-field="default"]')?.checked),
        tokenConfigured: sameIdentity && Boolean(previous.tokenConfigured),
        tokenEnv: sameIdentity ? previous.tokenEnv || '' : '',
        secret: rawValue('secret')
      };
    });
  }

  function contentConfigSignature(entries) {
    return JSON.stringify((entries || []).map((entry) => ({
      id: String(entry.id || '').trim().toLowerCase(),
      label: String(entry.label || '').trim(),
      repository: String(entry.repository || '').trim(),
      ref: String(entry.ref || 'main').trim() || 'main',
      root: String(entry.root || '').trim().replace(/^\/+|\/+$/g, ''),
      default: Boolean(entry.default)
    })));
  }

  function contentConfigHasUnsavedChanges() {
    const drafts = collectAdminContentDrafts();
    return drafts.some((entry) => entry.secret) || contentConfigSignature(drafts) !== adminContentConfigBaseline;
  }

  function validateAdminContentDrafts(drafts, onlyIndex) {
    const rows = Array.from(elements.adminContentConfigList.querySelectorAll('[data-content-repository-index]'));
    rows.forEach((row) => row.querySelectorAll('[data-content-field]').forEach((input) => input.removeAttribute('aria-invalid')));
    const indexes = Number.isInteger(onlyIndex) ? [onlyIndex] : drafts.map((_, index) => index);
    const seenIds = new Set();
    let firstInvalid = null;
    let message = '';
    const invalidate = (index, field, text) => {
      if (firstInvalid) return;
      firstInvalid = rows[index]?.querySelector(`[data-content-field="${field}"]`) || null;
      firstInvalid?.setAttribute('aria-invalid', 'true');
      message = `Repozytorium ${index + 1}: ${text}`;
    };
    for (const index of indexes) {
      const draft = drafts[index];
      if (!draft) continue;
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(draft.id)) invalidate(index, 'id', 'ID może zawierać tylko małe litery, cyfry i myślniki.');
      else if (draft.id === 'default' && !draft.default) invalidate(index, 'default', 'ID „default” jest zarezerwowane dla repozytorium domyślnego. Zmień ID albo zaznacz ten wpis jako domyślny.');
      else if (!Number.isInteger(onlyIndex) && seenIds.has(draft.id)) invalidate(index, 'id', 'ID musi być unikalne.');
      seenIds.add(draft.id);
      if (!draft.label || draft.label.length > 80 || /[\u0000-\u001f\u007f]/.test(draft.label)) invalidate(index, 'label', 'uzupełnij poprawną nazwę.');
      const parts = draft.repository.split('/');
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(draft.repository)
        || draft.repository.length > 140 || parts[0]?.length > 39 || parts[1]?.length > 100
        || ['.', '..'].includes(parts[0]) || ['.', '..'].includes(parts[1])) {
        invalidate(index, 'repository', 'wpisz repozytorium w formacie owner/nazwa.');
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(draft.ref)) invalidate(index, 'ref', 'gałąź jest nieprawidłowa.');
      if (draft.root && (draft.root.length > 300 || !/^(?:[A-Za-z0-9][A-Za-z0-9_.-]*\/)*[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(draft.root))) {
        invalidate(index, 'root', 'katalog może zawierać tylko bezpieczne segmenty ścieżki.');
      }
      if (draft.secret && (draft.secret.length < 20 || draft.secret.length > 500 || /[\s\u0000-\u001f\u007f]/.test(draft.secret))) {
        invalidate(index, 'secret', 'token musi mieć od 20 do 500 znaków i nie może zawierać odstępów.');
      }
    }
    if (!Number.isInteger(onlyIndex) && drafts.filter((entry) => entry.default).length !== 1) {
      message = 'Wybierz dokładnie jedno repozytorium domyślne.';
      firstInvalid = rows[0]?.querySelector('[data-content-field="default"]') || null;
      firstInvalid?.setAttribute('aria-invalid', 'true');
    }
    if (!firstInvalid && !message) return true;
    setPanelStatus(elements.adminContentConfigStatus, message || 'Popraw konfigurację repozytoriów.', 'error');
    firstInvalid?.focus();
    return false;
  }

  function markAdminContentDraftDirty() {
    if (adminContentConfigBusy || adminContentConfigPendingDeploy) return;
    setPanelStatus(
      elements.adminContentConfigStatus,
      contentConfigHasUnsavedChanges() ? 'Masz niezapisane zmiany.' : 'Brak niezapisanych zmian.',
      'info'
    );
  }

  function setAdminContentConfigBusy(busy) {
    adminContentConfigBusy = Boolean(busy);
    const locked = adminContentConfigBusy || adminContentConfigPendingDeploy;
    [elements.adminContentConfigAdd, elements.adminContentConfigSave, elements.adminContentConfigSaveDeploy]
      .filter(Boolean)
      .forEach((button) => { button.disabled = locked; });
    if (elements.adminContentConfigDeploy) elements.adminContentConfigDeploy.disabled = adminContentConfigBusy || adminContentConfigDeployQueued;
    if (elements.adminContentConfigList) {
      elements.adminContentConfigList.setAttribute('aria-busy', adminContentConfigBusy ? 'true' : 'false');
      elements.adminContentConfigList.querySelectorAll('button, input').forEach((control) => {
        if (control.dataset.contentAction === 'remove' && adminContentConfigDrafts.length === 1) control.disabled = true;
        else control.disabled = locked;
      });
    }
  }

  async function contentConfiguratorRequest(body) {
    const token = await getAdminToken();
    const response = await fetch(ADMIN_CONTENT_REPOSITORIES_URL, {
      method: body ? 'POST' : 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return readAdminResponse(response);
  }

  async function loadAdminContentConfigurator(force) {
    if (adminContentConfigLoaded && !force) return;
    setAdminContentConfigBusy(true);
    setPanelStatus(elements.adminContentConfigStatus, 'Wczytywanie konfiguracji repozytoriów…', 'loading');
    try {
      const payload = await contentConfiguratorRequest(null);
      const repositories = Array.isArray(payload?.repositories) ? payload.repositories : [];
      adminContentConfigBaseTokenReserved = repositories.some((repository) => (
        repository?.tokenEnv === 'GITHUB_CONTENT_TOKEN' && (repository.tokenConfigured || repository.repository)
      ));
      adminContentConfigDrafts = repositories.map(contentRepositoryDraft);
      if (!adminContentConfigDrafts.length) {
        adminContentConfigDrafts = [contentRepositoryDraft({ id: 'default', label: 'Materiały główne', ref: 'main', default: true })];
      }
      if (!adminContentConfigDrafts.some((entry) => entry.default)) adminContentConfigDrafts[0].default = true;
      adminContentConfigPendingDeploy = false;
      adminContentConfigDeployQueued = false;
      renderAdminContentConfigurator();
      adminContentConfigBaseline = contentConfigSignature(adminContentConfigDrafts);
      adminContentConfigLoaded = true;
      const message = payload?.configurationInvalid
        ? 'Dotychczasowa zmienna GITHUB_CONTENT_REPOSITORIES jest nieprawidłowa. Popraw listę i zapisz ją ponownie.'
        : payload?.netlifyConfigured
          ? 'Konfigurator jest gotowy. Sekrety zapisane wcześniej nie są odczytywane do przeglądarki.'
          : 'Dodaj jednorazowo NETLIFY_API_TOKEN w ustawieniach Netlify, aby zapis i deploy działały z panelu.';
      setPanelStatus(elements.adminContentConfigStatus, message, payload?.configurationInvalid ? 'error' : 'info');
    } catch (error) {
      adminContentConfigLoaded = false;
      setPanelStatus(elements.adminContentConfigStatus, error?.message || 'Nie udało się wczytać konfiguratora.', 'error');
    } finally {
      setAdminContentConfigBusy(false);
    }
  }

  function addAdminContentRepository() {
    adminContentConfigDrafts = collectAdminContentDrafts();
    if (adminContentConfigDrafts.length >= 20) {
      setPanelStatus(elements.adminContentConfigStatus, 'Możesz dodać maksymalnie 20 repozytoriów.', 'error');
      return;
    }
    const used = new Set(adminContentConfigDrafts.map((entry) => entry.id));
    let number = adminContentConfigDrafts.length + 1;
    while (used.has(`repo-${number}`)) number += 1;
    adminContentConfigDrafts.push(contentRepositoryDraft({ id: `repo-${number}`, label: `Repozytorium ${number}`, ref: 'main' }));
    renderAdminContentConfigurator();
    setPanelStatus(elements.adminContentConfigStatus, 'Masz niezapisane zmiany.', 'info');
    elements.adminContentConfigList.querySelector(`[data-content-repository-index="${adminContentConfigDrafts.length - 1}"] input`)?.focus();
  }

  async function testAdminContentRepository(index, button) {
    adminContentConfigDrafts = collectAdminContentDrafts();
    const repository = adminContentConfigDrafts[index];
    if (!repository) return;
    if (!validateAdminContentDrafts(adminContentConfigDrafts, index)) return;
    setAdminContentConfigBusy(true);
    if (button) button.textContent = 'Sprawdzanie…';
    setPanelStatus(elements.adminContentConfigStatus, `Sprawdzanie ${repository.repository || repository.label || 'repozytorium'}…`, 'loading');
    try {
      await contentConfiguratorRequest({ action: 'test', repository: {
        id: repository.id,
        label: repository.label,
        repository: repository.repository,
        ref: repository.ref,
        root: repository.root,
        default: repository.default,
        secret: repository.secret
      } });
      setPanelStatus(elements.adminContentConfigStatus, `Odczyt repozytorium, gałęzi i katalogu ${repository.repository} działa.`, 'info');
    } catch (error) {
      setPanelStatus(elements.adminContentConfigStatus, error?.message || 'Test połączenia nie powiódł się.', 'error');
    } finally {
      if (button) button.textContent = 'Sprawdź dostęp';
      setAdminContentConfigBusy(false);
    }
  }

  function showContentDeploymentStatus(deployment, prefix) {
    const status = elements.adminContentConfigStatus;
    status.className = 'admin-status is-info';
    status.replaceChildren(document.createTextNode(`${prefix ? `${prefix} ` : ''}Deploy został dodany do kolejki Netlify. Po jego zakończeniu odśwież stronę przed kolejną zmianą. `));
    if (deployment?.adminUrl) {
      const link = document.createElement('a');
      link.className = 'admin-content-config-deploy-link';
      link.href = deployment.adminUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Zobacz status deployu';
      status.append(link);
    }
  }

  async function saveAdminContentRepositories(deploy) {
    adminContentConfigDrafts = collectAdminContentDrafts();
    if (!validateAdminContentDrafts(adminContentConfigDrafts)) return;
    if (deploy && !window.confirm('Zapisać repozytoria w ENV i uruchomić nowy deploy Netlify?')) return;
    setAdminContentConfigBusy(true);
    setPanelStatus(elements.adminContentConfigStatus, deploy ? 'Sprawdzanie repozytoriów, zapis ENV i uruchamianie deployu…' : 'Sprawdzanie repozytoriów i zapisywanie ENV…', 'loading');
    try {
      const payload = await contentConfiguratorRequest({
        action: deploy ? 'save-and-deploy' : 'save',
        repositories: adminContentConfigDrafts.map(({ id, label, repository, ref, root, default: isDefault, secret }) => ({
          id, label, repository, ref, root, default: isDefault, secret
        }))
      });
      adminContentConfigDrafts = (payload.repositories || []).map(contentRepositoryDraft);
      adminContentConfigBaseTokenReserved = adminContentConfigDrafts.some((repository) => repository.tokenEnv === 'GITHUB_CONTENT_TOKEN');
      adminContentConfigPendingDeploy = true;
      adminContentConfigDeployQueued = Boolean(payload.deployment);
      adminContentConfigBaseline = contentConfigSignature(adminContentConfigDrafts);
      renderAdminContentConfigurator();
      adminContentRepositories = [];
      adminContentLoaded = false;
      const scopeWarning = Array.isArray(payload.scopes) && payload.scopes.includes('all')
        ? ' Granularny zakres Functions jest dostępny dopiero na Pro/Enterprise, dlatego na tym planie ENV używa domyślnego zakresu wszystkich usług.'
        : '';
      if (payload.deployment) {
        showContentDeploymentStatus(payload.deployment, `Konfiguracja została zapisana.${scopeWarning}`);
      } else if (typeof payload.deploymentError === 'string' && payload.deploymentError) {
        const deploymentMessage = ADMIN_ERROR_MESSAGES[payload.deploymentError] || 'Netlify nie uruchomił deployu.';
        setPanelStatus(elements.adminContentConfigStatus, `ENV zostało zapisane, ale deploy nie wystartował: ${deploymentMessage} Popraw przyczynę i kliknij „Uruchom tylko deploy”.${scopeWarning}`, 'error');
      } else {
        setPanelStatus(elements.adminContentConfigStatus, `Konfiguracja została zapisana w ENV. Formularz pozostanie zablokowany do deployu, ponieważ działające Functions nadal mają poprzednie ENV. Kliknij „Uruchom tylko deploy”.${scopeWarning}`, 'info');
      }
    } catch (error) {
      setPanelStatus(elements.adminContentConfigStatus, error?.message || 'Nie udało się zapisać repozytoriów.', 'error');
    } finally {
      setAdminContentConfigBusy(false);
    }
  }

  async function deployAdminContentConfiguration() {
    if (contentConfigHasUnsavedChanges()) {
      setPanelStatus(elements.adminContentConfigStatus, 'Masz niezapisane zmiany. Najpierw zapisz ENV, aby deploy ich nie pominął.', 'error');
      return;
    }
    if (!window.confirm('Uruchomić nowy deploy Netlify z aktualnie zapisanymi zmiennymi ENV?')) return;
    setAdminContentConfigBusy(true);
    setPanelStatus(elements.adminContentConfigStatus, 'Uruchamianie deployu Netlify…', 'loading');
    try {
      const payload = await contentConfiguratorRequest({ action: 'deploy' });
      adminContentConfigDeployQueued = true;
      if (adminContentConfigPendingDeploy) renderAdminContentConfigurator();
      showContentDeploymentStatus(payload.deployment, '');
    } catch (error) {
      setPanelStatus(elements.adminContentConfigStatus, error?.message || 'Nie udało się uruchomić deployu.', 'error');
    } finally {
      setAdminContentConfigBusy(false);
    }
  }

  function handleAdminContentConfigClick(event) {
    const button = event.target.closest('[data-content-action]');
    if (!button || adminContentConfigBusy || adminContentConfigPendingDeploy) return;
    const row = button.closest('[data-content-repository-index]');
    const index = Number(row?.dataset.contentRepositoryIndex);
    if (!Number.isInteger(index)) return;
    if (button.dataset.contentAction === 'test') {
      testAdminContentRepository(index, button);
      return;
    }
    if (button.dataset.contentAction === 'remove') {
      adminContentConfigDrafts = collectAdminContentDrafts();
      const removedDefault = Boolean(adminContentConfigDrafts[index]?.default);
      adminContentConfigDrafts.splice(index, 1);
      if (removedDefault && adminContentConfigDrafts.length) adminContentConfigDrafts[0].default = true;
      renderAdminContentConfigurator();
      setPanelStatus(elements.adminContentConfigStatus, 'Usunięto pozycję tylko z wersji roboczej. Zapisz ENV, aby opublikować zmianę.', 'info');
      const nextIndex = Math.min(index, adminContentConfigDrafts.length - 1);
      elements.adminContentConfigList.querySelector(`[data-content-repository-index="${nextIndex}"] input`)?.focus();
    }
  }

  function setAdminPricesBusy(busy) {
    if (elements.adminPricesReload) elements.adminPricesReload.disabled = Boolean(busy);
    if (elements.adminPricesSave) elements.adminPricesSave.disabled = Boolean(busy);
    if (elements.adminPaymentCurrency) elements.adminPaymentCurrency.disabled = Boolean(busy);
    if (elements.adminPaymentDisabled) elements.adminPaymentDisabled.disabled = Boolean(busy);
    if (elements.adminPaymentBlockStacking) elements.adminPaymentBlockStacking.disabled = Boolean(busy);
    adminPaymentPlanEntries().forEach((entry) => {
      if (entry.input) entry.input.disabled = Boolean(busy);
      if (entry.enabled) entry.enabled.disabled = Boolean(busy);
    });
  }

  function adminPaymentPlanEntries() {
    return [
      { id: 'hour', input: elements.adminPriceHour, enabled: elements.adminEnabledHour },
      { id: 'day', input: elements.adminPriceDay, enabled: elements.adminEnabledDay },
      { id: 'week', input: elements.adminPriceWeek, enabled: elements.adminEnabledWeek },
      { id: 'month', input: elements.adminPriceMonth, enabled: elements.adminEnabledMonth },
      { id: 'halfyear', input: elements.adminPriceHalfyear, enabled: elements.adminEnabledHalfyear },
      { id: 'year', input: elements.adminPriceYear, enabled: elements.adminEnabledYear }
    ];
  }

  function setAdminPriceInputs(payload) {
    const plans = payload && Array.isArray(payload.plans) ? payload.plans : [];
    const byId = new Map((plans || []).map((plan) => [plan.id, plan]));
    adminPaymentPlanEntries().forEach((entry) => {
      const plan = byId.get(entry.id);
      if (entry.input && plan && Number.isSafeInteger(plan.amount)) {
        entry.input.value = (plan.amount / 100).toFixed(2);
      }
      if (entry.enabled) entry.enabled.checked = Boolean(plan && plan.enabled);
    });
    if (elements.adminPaymentCurrency) elements.adminPaymentCurrency.value = String(payload.currency || 'pln');
    if (elements.adminPaymentDisabled) {
      elements.adminPaymentDisabled.checked = payload.paymentsEnabled === false;
    }
    if (elements.adminPaymentBlockStacking) {
      elements.adminPaymentBlockStacking.checked = payload.stackingEnabled === false;
    }
  }

  async function loadAdminPrices() {
    setAdminPricesBusy(true);
    setPanelStatus(elements.adminPricesStatus, 'Wczytywanie cen…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(`${PAYMENT_CONFIG_URL}?admin=1`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await readAdminResponse(response);
      if (!payload || !Array.isArray(payload.plans)) throw new Error('Serwer zwrócił nieprawidłową konfigurację cen.');
      setAdminPriceInputs(payload);
      adminPricesEtag = typeof payload.etag === 'string' ? payload.etag : null;
      adminPricesLoaded = true;
      setPanelStatus(
        elements.adminPricesStatus,
        payload.paymentsEnabled === false
          ? 'Oferta wczytana. Płatności są obecnie wyłączone przez administratora.'
          : payload.checkoutAvailable
          ? `Ceny wczytane. Stripe działa w trybie ${payload.testMode ? 'testowym' : 'produkcyjnym'}.`
          : 'Ceny wczytane, ale klucze Stripe lub webhook nie są jeszcze w pełni skonfigurowane.',
        payload.paymentsEnabled === false || payload.checkoutAvailable ? 'info' : 'error'
      );
    } catch (error) {
      adminPricesLoaded = false;
      adminPricesEtag = null;
      setPanelStatus(elements.adminPricesStatus, error && error.message ? error.message : 'Nie udało się wczytać cen.', 'error');
    } finally {
      setAdminPricesBusy(false);
    }
  }

  function priceInputToCents(input) {
    const normalized = String(input.value || '').replace(',', '.').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const amount = Math.round(Number(normalized) * 100);
    return Number.isSafeInteger(amount) && amount >= 100 && amount <= 1_000_000 ? amount : null;
  }

  async function saveAdminPrices(event) {
    event.preventDefault();
    if (!adminPricesLoaded) {
      setPanelStatus(elements.adminPricesStatus, 'Najpierw wczytaj aktualne ceny.', 'error');
      return;
    }
    const prices = {};
    const enabledPlans = [];
    for (const entry of adminPaymentPlanEntries()) {
      const amount = priceInputToCents(entry.input);
      if (amount == null) {
        setPanelStatus(elements.adminPricesStatus, 'Każda cena musi wynosić od 1,00 do 10 000,00 jednostek wybranej waluty i mieć najwyżej dwa miejsca po przecinku.', 'error');
        entry.input.focus();
        return;
      }
      prices[entry.id] = amount;
      if (entry.enabled && entry.enabled.checked) enabledPlans.push(entry.id);
    }
    const currency = String(elements.adminPaymentCurrency.value || '').toLowerCase();
    const paymentsEnabled = !elements.adminPaymentDisabled.checked;
    const stackingEnabled = !elements.adminPaymentBlockStacking.checked;

    setAdminPricesBusy(true);
    setPanelStatus(elements.adminPricesStatus, 'Zapisywanie cen…', 'loading');
    try {
      const token = await getAdminToken();
      const response = await fetch(PAYMENT_CONFIG_URL, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currency,
          enabledPlans,
          expectedEtag: adminPricesEtag,
          paymentsEnabled,
          prices,
          stackingEnabled
        })
      });
      const payload = await readAdminResponse(response);
      adminPricesEtag = typeof payload.etag === 'string' ? payload.etag : adminPricesEtag;
      setAdminPriceInputs(payload);
      setPanelStatus(elements.adminPricesStatus, 'Oferta zapisana. Waluta, dostępne pakiety i zasady przedłużania obowiązują już dla nowych płatności.', 'info');
      if (window.ChemPayments && typeof window.ChemPayments.renderAll === 'function') {
        window.ChemPayments.renderAll(true);
      }
    } catch (error) {
      setPanelStatus(elements.adminPricesStatus, error && error.message ? error.message : 'Nie udało się zapisać cen.', 'error');
    } finally {
      setAdminPricesBusy(false);
    }
  }

  function adminProgressPercent(value) {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    if (percent === 0) return '0%';
    if (percent < 1) return '<1%';
    if (percent < 10) return `${String(Math.round(percent * 10) / 10).replace('.', ',')}%`;
    return `${Math.round(percent)}%`;
  }

  function reconcileAdminProgressUsers() {
    const rows = new Map(adminProgressUsers.map((user) => [user.id, user]));
    const parentIds = new Set((adminProgressCatalog?.nodes || []).map((node) => node.parentId).filter(Boolean));
    const trackedLeaves = (adminProgressCatalog?.nodes || []).filter((node) => !parentIds.has(node.id)).length;
    adminUsers.forEach((user) => {
      const existing = rows.get(user.id);
      const identityName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      if (existing) {
        if (!existing.name) existing.name = identityName;
        if (!existing.email) existing.email = user.email || '';
        return;
      }
      rows.set(user.id, {
        id: user.id,
        name: identityName,
        email: user.email || '',
        progressPercent: 0,
        completed: 0,
        started: 0,
        notOpened: trackedLeaves,
        lastActivityAt: null
      });
    });
    adminProgressUsers = [...rows.values()];
  }

  function adjustedAdminProgressReport() {
    const report = adminProgressReport || {};
    const missing = adminUsers.filter((user) => !adminProgressActiveIds.has(user.id)).length;
    if (!missing) return report;
    const sourceUsers = Math.max(0, Number(report.users) || 0);
    const users = sourceUsers + missing;
    return {
      ...report,
      users,
      averageProgress: users ? ((Number(report.averageProgress) || 0) * sourceUsers) / users : 0,
      distribution: {
        ...(report.distribution || {}),
        '0-25': Number(report.distribution?.['0-25'] || 0) + missing
      },
      mostUnopened: (report.mostUnopened || [])
        .map((item) => ({ ...item, notOpened: Number(item.notOpened || 0) + missing }))
        .sort((left, right) => right.notOpened - left.notOpened)
    };
  }

  function filteredAdminProgressUsers() {
    const query = normalizeText(elements.adminProgressSearch?.value || '');
    const filter = elements.adminProgressFilter?.value || 'all';
    const sort = elements.adminProgressSort?.value || 'lastActivityAt';
    let rows = adminProgressUsers.filter((user) => {
      if (query && !normalizeText(`${user.name} ${user.email} ${user.id}`).includes(query)) return false;
      if (filter === 'completed') return user.progressPercent >= 100;
      if (filter === 'started') return user.progressPercent > 0 && user.progressPercent < 100;
      if (filter === 'not_started') return user.progressPercent <= 0;
      return true;
    });
    rows = [...rows].sort((left, right) => {
      if (sort === 'progressPercent') return right.progressPercent - left.progressPercent;
      return String(right[sort] || '').localeCompare(String(left[sort] || ''), 'pl', { sensitivity: 'base' });
    });
    return rows;
  }

  function renderAdminProgressUsers() {
    const rows = filteredAdminProgressUsers();
    const visibleRows = rows.slice(0, adminProgressVisibleCount);
    const cards = visibleRows.map((user) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-progress-user';
      const identity = document.createElement('span');
      identity.append(
        Object.assign(document.createElement('strong'), { textContent: user.name || user.email || user.id }),
        Object.assign(document.createElement('small'), { textContent: `${user.email || 'Brak e-maila'} · ${user.id}` })
      );
      const stats = document.createElement('span');
      stats.className = 'admin-progress-user-stats';
      stats.append(
        Object.assign(document.createElement('strong'), { textContent: adminProgressPercent(user.progressPercent) }),
        Object.assign(document.createElement('small'), { textContent: `${user.completed} ukończonych · ${user.started} rozpoczętych · ${user.notOpened} nieotwartych` })
      );
      const activity = document.createElement('time');
      activity.textContent = adminDateLabel(user.lastActivityAt, 'Brak aktywności');
      button.append(identity, stats, activity);
      button.addEventListener('click', () => loadAdminProgressUser(user.id));
      return button;
    });
    elements.adminProgressUserList?.replaceChildren(...cards);
    if (elements.adminProgressMore) {
      const hiddenRows = visibleRows.length < rows.length;
      elements.adminProgressMore.hidden = !hiddenRows && !adminProgressUsersCursor;
      elements.adminProgressMore.disabled = adminProgressLoadingMore;
      elements.adminProgressMore.textContent = adminProgressLoadingMore
        ? 'Wczytywanie…'
        : hiddenRows
          ? `Pokaż więcej (${visibleRows.length} z ${rows.length})`
          : 'Pobierz kolejne konta';
    }
  }

  async function loadMoreAdminProgressUsers() {
    if (adminProgressLoadingMore) return;
    adminProgressLoadingMore = true;
    renderAdminProgressUsers();
    try {
      if (adminProgressUsersCursor) {
        const payload = await adminProgressRequest(
          'GET',
          null,
          `?view=users&limit=${ADMIN_PROGRESS_PAGE_SIZE}&cursor=${encodeURIComponent(adminProgressUsersCursor)}`
        );
        const page = Array.isArray(payload.users) ? payload.users : [];
        const rows = new Map(adminProgressUsers.map((user) => [user.id, user]));
        page.forEach((user) => {
          if (user?.id) {
            rows.set(user.id, user);
            adminProgressActiveIds.add(user.id);
          }
        });
        adminProgressUsers = [...rows.values()];
        adminProgressUsersCursor = typeof payload.cursor === 'string' ? payload.cursor : '';
        adminProgressCatalog = payload.catalog || adminProgressCatalog;
        reconcileAdminProgressUsers();
      }
      adminProgressVisibleCount += ADMIN_PROGRESS_PAGE_SIZE;
      setPanelStatus(
        elements.adminProgressStatus,
        adminProgressUsersCursor
          ? 'Wczytano kolejną partię. Następne konta są dostępne na żądanie.'
          : 'Wczytano wszystkie dostępne rekordy postępu.',
        'success'
      );
    } catch (error) {
      setPanelStatus(elements.adminProgressStatus, error?.message || 'Nie udało się wczytać kolejnych kont.', 'error');
    } finally {
      adminProgressLoadingMore = false;
      renderAdminProgressUsers();
    }
  }

  function renderAdminProgressMetrics(report) {
    if (!elements.adminProgressMetrics) return;
    const values = [
      ['Średni postęp', adminProgressPercent(report?.averageProgress)],
      ['Uczniowie', String(report?.users || 0)],
      ['Rozpoczęcia', String(report?.starts || 0)],
      ['Ukończenia', String(report?.completions || 0)]
    ];
    elements.adminProgressMetrics.replaceChildren(...values.map(([label, value]) => {
      const card = document.createElement('span');
      card.append(
        Object.assign(document.createElement('strong'), { textContent: value }),
        Object.assign(document.createElement('small'), { textContent: label })
      );
      return card;
    }));
  }

  function adminProgressCountShare(count, total) {
    const value = Math.max(0, Number(count) || 0);
    const all = Math.max(0, Number(total) || 0);
    return all ? Math.round((value / all) * 100) : 0;
  }

  function adminProgressStopLabel(item) {
    if (item?.commonStop == null || item.commonStop === '') return '';
    const node = adminProgressCatalog?.nodes?.find((candidate) => candidate.id === item.materialId);
    if (node?.type === 'lesson') {
      const step = node.settings?.steps?.find((candidate) => candidate.id === item.commonStop);
      return `Najczęstszy ostatni krok: ${step?.title || item.commonStop}`;
    }
    if (node?.type === 'presentation') return `Najczęstszy ostatni slajd: ${item.commonStop}`;
    if (node?.type === 'video') {
      const seconds = Math.max(0, Math.round(Number(item.commonStop) || 0));
      return `Najczęstsza ostatnia pozycja: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return `Najczęstszy punkt zatrzymania: ${item.commonStop}`;
  }

  function createAdminProgressRanking(title, description, items, valueKey, emptyLabel) {
    const section = document.createElement('section');
    section.className = 'admin-progress-insight-card';
    const header = document.createElement('header');
    header.append(
      Object.assign(document.createElement('h4'), { textContent: title }),
      Object.assign(document.createElement('p'), { textContent: description })
    );
    section.append(header);
    const rows = (items || []).filter((item) => Number(item?.[valueKey]) > 0).slice(0, 5);
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-progress-report-empty';
      empty.textContent = emptyLabel;
      section.append(empty);
      return section;
    }
    const list = document.createElement('ol');
    list.className = 'admin-progress-ranking';
    rows.forEach((item, index) => {
      const row = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'admin-progress-ranking-position';
      rank.textContent = String(index + 1);
      const copy = document.createElement('span');
      copy.className = 'admin-progress-ranking-copy';
      copy.append(Object.assign(document.createElement('strong'), { textContent: item.title || item.materialId || 'Materiał' }));
      const stopLabel = valueKey === 'abandoned' ? adminProgressStopLabel(item) : '';
      if (stopLabel) copy.append(Object.assign(document.createElement('small'), { textContent: stopLabel }));
      const value = document.createElement('strong');
      value.className = 'admin-progress-ranking-value';
      value.textContent = String(Number(item[valueKey]) || 0);
      value.title = valueKey === 'notOpened' ? 'Liczba uczniów bez otwarcia' : 'Liczba uczniów bez ukończenia';
      row.append(rank, copy, value);
      list.append(row);
    });
    section.append(list);
    return section;
  }

  function renderAdminProgressGlobal(report) {
    if (!elements.adminProgressGlobalReport) return;
    const distribution = report?.distribution || {};
    const section = document.createElement('section');
    section.className = 'admin-progress-report-block admin-progress-global-report';
    const heading = document.createElement('header');
    heading.className = 'admin-progress-report-heading';
    heading.append(
      Object.assign(document.createElement('h3'), { textContent: 'Jak uczniowie przechodzą kurs' }),
      Object.assign(document.createElement('p'), { textContent: `Każde z ${Number(report?.users) || 0} kont trafia do jednego przedziału według aktualnego postępu całego kursu. Konto bez aktywności znajduje się w grupie 0–25%.` })
    );
    section.append(heading);

    const distributionGrid = document.createElement('div');
    distributionGrid.className = 'admin-progress-distribution';
    [
      ['0-25', '0–25%', 'Początek'],
      ['25-50', '25–50%', 'Pierwsza połowa'],
      ['50-75', '50–75%', 'Druga połowa'],
      ['75-100', '75–100%', 'Blisko ukończenia']
    ].forEach(([key, range, label], index) => {
      const count = Number(distribution[key]) || 0;
      const share = adminProgressCountShare(count, report?.users);
      const card = document.createElement('article');
      card.className = `admin-progress-distribution-card is-range-${index + 1}`;
      const top = document.createElement('span');
      top.append(
        Object.assign(document.createElement('small'), { textContent: range }),
        Object.assign(document.createElement('strong'), { textContent: String(count) })
      );
      const bar = document.createElement('span');
      bar.className = 'admin-progress-distribution-bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', `${label}: ${share}% wszystkich kont`);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(share));
      const fill = document.createElement('span');
      fill.style.width = `${share}%`;
      bar.append(fill);
      card.append(
        top,
        Object.assign(document.createElement('p'), { textContent: label }),
        bar,
        Object.assign(document.createElement('small'), { textContent: `${share}% wszystkich kont` })
      );
      distributionGrid.append(card);
    });
    section.append(distributionGrid);

    const explanation = document.createElement('div');
    explanation.className = 'admin-progress-report-note';
    explanation.append(
      Object.assign(document.createElement('strong'), { textContent: 'Jak czytać te dane?' }),
      Object.assign(document.createElement('p'), { textContent: 'Średni postęp u góry jest średnią wyników wszystkich kont. Rozpoczęcie oznacza co najmniej jedno zarejestrowane otwarcie, a ukończenie — 100% postępu kursu. Lista pozostawionych materiałów jest wskaźnikiem pomocniczym: liczy materiały otwarte, ale jeszcze nieukończone; nie jest dowodem, że uczeń z nich zrezygnował.' })
    );
    section.append(explanation);

    const insights = document.createElement('div');
    insights.className = 'admin-progress-insight-grid';
    insights.append(
      createAdminProgressRanking(
        'Najczęściej nieotwierane',
        'Liczba kont, na których materiał nie ma ani jednego zarejestrowanego otwarcia.',
        report?.mostUnopened, 'notOpened', 'Wszystkie raportowane materiały zostały już przez kogoś otwarte.'
      ),
      createAdminProgressRanking(
        'Otwarte, ale nieukończone',
        'Materiały rozpoczęte bez statusu ukończenia. Punkt zatrzymania pokazujemy tylko wtedy, gdy odtwarzacz przekazał wiarygodną pozycję.',
        report?.mostAbandoned, 'abandoned', 'Brak otwartych materiałów pozostawionych bez ukończenia.'
      )
    );
    section.append(insights);
    elements.adminProgressGlobalReport.replaceChildren(section);
  }

  function adminProgressIdentityLabel(userId) {
    if (!userId) return '';
    const user = adminUsers.find((candidate) => candidate.id === userId);
    const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';
    const progressUser = adminProgressUsers.find((candidate) => candidate.id === userId);
    return name || user?.email || progressUser?.name || progressUser?.email || userId;
  }

  function adminProgressMaterialLabel(materialId) {
    if (!materialId) return '';
    return adminProgressCatalog?.nodes?.find((node) => node.id === materialId)?.title || materialId;
  }

  function adminProgressAuditActionLabel(action) {
    return ({
      'progress.catalog.update': 'Zmieniono konfigurację postępu',
      'progress.lesson_manifest.update': 'Zaktualizowano strukturę lekcji',
      'progress.preference.update': 'Zmieniono zasady pomijania kroków',
      'progress.mark_completed': 'Oznaczono materiał jako ukończony',
      'progress.mark_incomplete': 'Oznaczono materiał jako nieukończony',
      'progress.set_step': 'Ustawiono bieżący krok lekcji',
      'progress.unlock_step': 'Ręcznie odblokowano krok',
      'progress.lock_step': 'Ręcznie zablokowano krok',
      'progress.reset.material': 'Zresetowano materiał',
      'progress.reset.section': 'Zresetowano sekcję',
      'progress.reset.department': 'Zresetowano dział',
      'progress.reset.course': 'Zresetowano cały kurs',
      'exam.attempt.reset': 'Zresetowano próbę egzaminu'
    })[action] || 'Wykonano operację administracyjną';
  }

  function adminProgressSkipModeLabel(mode) {
    return ({ DEFAULT: 'według lekcji', ALLOW: 'dozwolone', DENY: 'zabronione' })[mode] || 'według lekcji';
  }

  function adminProgressAuditChangeLabel(entry) {
    const previous = entry?.previousValue || {};
    const next = entry?.newValue || {};
    if (entry.action === 'progress.catalog.update') {
      const removed = Number(next.removedCount) || 0;
      return `Materiały w katalogu: ${Number(previous.nodeCount) || 0} → ${Number(next.nodeCount) || 0}${removed ? ` · usunięte: ${removed}` : ''}.`;
    }
    if (entry.action === 'progress.lesson_manifest.update') {
      return `Plik: ${next.filename || previous.filename || '—'} · liczba kroków: ${Number(next.stepCount) || 0}.`;
    }
    if (entry.action === 'progress.preference.update') {
      return `Pomijanie kroków: ${adminProgressSkipModeLabel(previous.skipMode)} → ${adminProgressSkipModeLabel(next.skipMode)}.`;
    }
    if (entry.action === 'progress.mark_completed' || entry.action === 'progress.mark_incomplete') {
      return `Postęp: ${adminProgressPercent(previous.progressPercent)} → ${adminProgressPercent(next.progressPercent)}.`;
    }
    if (entry.action === 'progress.set_step') {
      return `Krok: ${previous.details?.currentStepId || '—'} → ${next.details?.currentStepId || '—'}.`;
    }
    if (entry.action === 'progress.unlock_step') return 'Wskazany krok dodano do indywidualnych odblokowań ucznia.';
    if (entry.action === 'progress.lock_step') return 'Wskazany krok dodano do indywidualnych blokad ucznia.';
    if (entry.action === 'exam.attempt.reset') {
      return `Próba ${next.attemptId || previous.attemptId || '—'} została wycofana, a wynik egzaminu przeliczony na podstawie pozostałych prób.`;
    }
    if (String(entry.action || '').startsWith('progress.reset.')) {
      const count = previous && typeof previous === 'object' ? Object.keys(previous).length : 0;
      return `Usunięte rekordy postępu: ${count}.`;
    }
    return 'Zmiana została zapisana w historii administratora.';
  }

  function renderAdminProgressAudit(entries) {
    if (!elements.adminProgressAudit) return;
    const section = document.createElement('section');
    section.className = 'admin-progress-report-block admin-progress-audit-report';
    const header = document.createElement('header');
    header.className = 'admin-progress-report-heading';
    header.append(
      Object.assign(document.createElement('h3'), { textContent: 'Historia zmian administratorów' }),
      Object.assign(document.createElement('p'), { textContent: 'Tutaj widać ręczne zmiany postępu, resety i publikacje konfiguracji. Wpisu nie tworzy zwykła aktywność ucznia.' })
    );
    section.append(header);
    const rows = entries || [];
    if (!rows.length) {
      section.append(Object.assign(document.createElement('p'), { className: 'admin-progress-report-empty', textContent: 'Nie zapisano jeszcze żadnej operacji administratora.' }));
      elements.adminProgressAudit.replaceChildren(section);
      return;
    }
    const list = document.createElement('ol');
    list.className = 'admin-progress-audit-list';
    rows.forEach((entry) => {
      const item = document.createElement('li');
      const marker = document.createElement('span');
      marker.className = 'admin-progress-audit-marker';
      marker.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('div');
      copy.className = 'admin-progress-audit-copy';
      copy.append(Object.assign(document.createElement('strong'), { textContent: adminProgressAuditActionLabel(entry.action) }));
      const context = [
        entry.targetUserId ? `Uczeń: ${adminProgressIdentityLabel(entry.targetUserId)}` : '',
        entry.materialId ? `Materiał: ${adminProgressMaterialLabel(entry.materialId)}` : ''
      ].filter(Boolean).join(' · ');
      if (context) copy.append(Object.assign(document.createElement('p'), { textContent: context }));
      copy.append(
        Object.assign(document.createElement('p'), { className: 'admin-progress-audit-change', textContent: adminProgressAuditChangeLabel(entry) }),
        Object.assign(document.createElement('small'), { textContent: `${adminDateLabel(entry.timestamp)} · administrator: ${adminProgressIdentityLabel(entry.adminId)}` })
      );
      item.append(marker, copy);
      list.append(item);
    });
    section.append(list);
    if (adminProgressAuditCursor) {
      const pagination = document.createElement('div');
      pagination.className = 'admin-progress-audit-pagination';
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'button button-secondary';
      more.textContent = adminProgressAuditLoadingMore ? 'Wczytywanie…' : 'Pokaż starsze wpisy';
      more.disabled = adminProgressAuditLoadingMore;
      more.addEventListener('click', loadMoreAdminProgressAudit);
      pagination.append(more);
      section.append(pagination);
    }
    elements.adminProgressAudit.replaceChildren(section);
  }

  async function loadMoreAdminProgressAudit() {
    if (!adminProgressAuditCursor || adminProgressAuditLoadingMore) return;
    adminProgressAuditLoadingMore = true;
    renderAdminProgressAudit(adminProgressAuditEntries);
    try {
      const payload = await adminProgressRequest(
        'GET',
        null,
        `?view=audit&limit=20&cursor=${encodeURIComponent(adminProgressAuditCursor)}`
      );
      adminProgressAuditEntries.push(...(Array.isArray(payload.audit) ? payload.audit : []));
      adminProgressAuditCursor = typeof payload.cursor === 'string' ? payload.cursor : '';
    } catch (error) {
      setPanelStatus(elements.adminProgressStatus, error?.message || 'Nie udało się wczytać starszej historii.', 'error');
    } finally {
      adminProgressAuditLoadingMore = false;
      renderAdminProgressAudit(adminProgressAuditEntries);
    }
  }

  async function adminProgressRequest(method, body, query = '') {
    const token = await getAdminToken();
    const response = await fetch(`${ADMIN_PROGRESS_URL}${query}`, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return readAdminResponse(response);
  }

  async function adminExamRequest(method, query, body) {
    const token = await getAdminToken();
    const response = await fetch(`${ADMIN_EXAMS_URL}${query || ''}`, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return readAdminResponse(response);
  }

  async function loadAdminProgress(force = false) {
    if (adminProgressLoaded && !force) return;
    setPanelStatus(elements.adminProgressStatus, 'Wczytywanie raportów…', 'loading');
    try {
      const [users, global, audit] = await Promise.all([
        adminProgressRequest('GET', null, `?view=users&limit=${ADMIN_PROGRESS_PAGE_SIZE}`),
        adminProgressRequest('GET', null, '?view=global&limit=200'),
        adminProgressRequest('GET', null, '?view=audit&limit=20')
      ]);
      adminProgressUsers = Array.isArray(users.users) ? users.users : [];
      adminProgressUsersCursor = typeof users.cursor === 'string' ? users.cursor : '';
      adminProgressVisibleCount = ADMIN_PROGRESS_PAGE_SIZE;
      adminProgressActiveIds = new Set(adminProgressUsers.map((user) => user.id));
      adminProgressReport = global.report || null;
      adminProgressCatalog = users.catalog || adminProgressCatalog;
      adminProgressAuditEntries = Array.isArray(audit.audit) ? audit.audit : [];
      adminProgressAuditCursor = typeof audit.cursor === 'string' ? audit.cursor : '';
      reconcileAdminProgressUsers();
      const globalSettings = adminProgressCatalog?.global || {};
      elements.adminProgressGlobalTracking.value = globalSettings.tracking === 'OFF' ? 'OFF' : 'ON';
      elements.adminProgressGlobalShow.value = globalSettings.showProgress === 'OFF' ? 'OFF' : 'ON';
      elements.adminProgressRecordOpens.checked = globalSettings.recordOpens !== false;
      renderAdminProgressUsers();
      renderAdminProgressMetrics(adjustedAdminProgressReport());
      renderAdminProgressGlobal(adjustedAdminProgressReport());
      renderAdminProgressAudit(adminProgressAuditEntries);
      adminProgressLoaded = true;
      setPanelStatus(
        elements.adminProgressStatus,
        adminProgressUsersCursor
          ? 'Wczytano pierwszą partię rekordów postępu. Kolejne są dostępne pod listą.'
          : 'Wczytano wszystkie dostępne rekordy postępu.',
        'success'
      );
    } catch (error) {
      adminProgressLoaded = false;
      setPanelStatus(elements.adminProgressStatus, error?.message || 'Nie udało się wczytać raportów.', 'error');
    }
  }

  async function saveAdminProgressSettings() {
    if (!adminProgressCatalog) return;
    elements.adminProgressSaveSettings.disabled = true;
    try {
      const catalog = {
        ...adminProgressCatalog,
        global: {
          ...adminProgressCatalog.global,
          tracking: elements.adminProgressGlobalTracking.value,
          showProgress: elements.adminProgressGlobalShow.value,
          recordOpens: elements.adminProgressRecordOpens.checked
        }
      };
      const payload = await adminProgressRequest('PUT', { action: 'catalog', catalog });
      adminProgressCatalog = payload.catalog;
      setPanelStatus(elements.adminProgressStatus, 'Ustawienia postępu zapisane.', 'success');
      await window.ChemProgress?.load({ force: true }).catch(() => {});
    } catch (error) {
      setPanelStatus(elements.adminProgressStatus, error?.message || 'Nie udało się zapisać ustawień.', 'error');
    } finally {
      elements.adminProgressSaveSettings.disabled = false;
    }
  }

  function recordDetailsLabel(node, record) {
    if (!record) return 'Nieotwarty';
    const details = record.details || {};
    if (node.type === 'presentation') return `Slajd ${Number(details.lastSlideIndex) + 1 || '—'}/${details.totalSlides || '—'} · ${record.openCount} otwarć`;
    if (node.type === 'video') return `Pozycja ${Math.round(Number(details.lastPlaybackPosition) || 0)} s / ${Math.round(Number(details.duration) || 0)} s`;
    if (node.type === 'lesson') return `Krok ${Number(details.currentStepIndex) + 1 || '—'} · ukończone ${details.completedStepIds?.length || 0}/${details.totalTrackedSteps || '—'}`;
    if (node.type === 'pdf') return `Strona ${details.lastPage || '—'}/${details.totalPages || '—'} · postęp nawigacyjny`;
    if (node.type === 'quiz') return `Postęp ${adminProgressPercent(record.progressPercent)} · wynik ${details.scorePercent == null ? '—' : adminProgressPercent(details.scorePercent)} · próby ${details.attempts || 0}`;
    if (node.type === 'exam') return `Postęp ${adminProgressPercent(record.progressPercent)} · wynik ${details.scorePercent == null ? '—' : adminProgressPercent(details.scorePercent)} · ${details.passed == null ? 'bez wyniku zaliczenia' : details.passed ? 'zaliczono' : 'nie zaliczono'} · próba ${details.attempts || 0}`;
    return `${record.openCount || 0} otwarć`;
  }

  function adminProgressNodeTypeLabel(type) {
    return ({
      department: 'Dział',
      section: 'Sekcja',
      subsection: 'Podsekcja',
      lesson: 'Lekcja',
      lesson_step: 'Krok lekcji',
      presentation: 'Prezentacja',
      video: 'Film',
      pdf: 'PDF',
      quiz: 'Quiz',
      exam: 'Egzamin',
      script: 'Skrypt',
      iframe: 'Osadzony materiał',
      other: 'Materiał'
    })[type] || 'Materiał';
  }

  async function mutateAdminProgress(body, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return false;
    await adminProgressRequest(body.scope ? 'DELETE' : 'PUT', body);
    return true;
  }

  async function loadAdminProgressUser(userId) {
    setPanelStatus(elements.adminProgressStatus, 'Wczytywanie raportu ucznia…', 'loading');
    try {
      const payload = await adminProgressRequest('GET', null, `?view=user&userId=${encodeURIComponent(userId)}`);
      renderAdminProgressUser(payload);
      setPanelStatus(elements.adminProgressStatus, 'Raport ucznia jest aktualny.', 'success');
    } catch (error) {
      setPanelStatus(elements.adminProgressStatus, error?.message || 'Nie udało się wczytać raportu ucznia.', 'error');
    }
  }

  function renderAdminProgressUser(payload) {
    const host = elements.adminProgressDetail;
    const user = payload.user;
    const aggregate = payload.aggregate;
    host.hidden = false;
    host.replaceChildren();
    const header = document.createElement('header');
    header.append(
      Object.assign(document.createElement('h3'), { textContent: user.profile?.name || user.profile?.email || user.userId }),
      Object.assign(document.createElement('p'), { textContent: `${user.profile?.email || 'Brak e-maila'} · ${user.userId} · ostatnia aktywność: ${adminDateLabel(user.lastActivityAt)}` }),
      Object.assign(document.createElement('strong'), { textContent: `Postęp kursu: ${adminProgressPercent(aggregate.course.progressPercent)}` })
    );
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'button button-secondary'; close.textContent = 'Zamknij raport';
    close.addEventListener('click', () => { host.hidden = true; });
    header.append(close);
    host.append(header);

    const accountSettings = document.createElement('details');
    accountSettings.className = 'admin-progress-account-settings';
    const accountSummary = document.createElement('summary');
    accountSummary.textContent = 'Ustawienia ucznia i reset całego kursu';
    const controls = document.createElement('div');
    controls.className = 'admin-progress-manual-controls';
    const skip = document.createElement('select');
    skip.className = 'text-field';
    [['DEFAULT', 'Według lekcji'], ['ALLOW', 'Pomijanie dozwolone'], ['DENY', 'Pomijanie zabronione']].forEach(([value, label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; skip.append(option);
    });
    skip.value = user.preferences?.skipMode || 'DEFAULT';
    const saveSkip = document.createElement('button'); saveSkip.type = 'button'; saveSkip.className = 'button button-secondary'; saveSkip.textContent = 'Zapisz pomijanie';
    saveSkip.addEventListener('click', async () => {
      await mutateAdminProgress({ action: 'preference', targetUserId: user.userId, preferences: { skipMode: skip.value } });
      await loadAdminProgressUser(user.userId);
    });
    const resetCourse = document.createElement('button'); resetCourse.type = 'button'; resetCourse.className = 'button button-danger-soft'; resetCourse.textContent = 'Reset całego kursu';
    resetCourse.addEventListener('click', async () => {
      if (await mutateAdminProgress({ targetUserId: user.userId, scope: 'course' }, 'Zresetować cały postęp tego użytkownika? Historia materiałów zostanie usunięta, a operacja zapisana w audycie.')) {
        await loadAdminProgressUser(user.userId);
      }
    });
    controls.append(skip, saveSkip, resetCourse);
    accountSettings.append(accountSummary, controls);
    host.append(accountSettings);

    const list = document.createElement('div');
    list.className = 'admin-progress-material-tree';
    const nodes = (payload.catalog?.nodes || []).filter((node) => node.type !== 'course');
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const childrenByParent = new Map();
    nodes.forEach((node) => {
      const parentId = nodesById.has(node.parentId) ? node.parentId : '__root__';
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(node);
    });

    const appendMaterialActions = (actions, node, record) => {
      if (!['department', 'section', 'subsection', 'course'].includes(node.type)) {
        [['mark_completed', 'Oznacz ukończone'], ['mark_incomplete', 'Oznacz nieukończone']].forEach(([action, label]) => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-secondary'; button.textContent = label;
          button.addEventListener('click', async () => {
            await mutateAdminProgress({ action, targetUserId: user.userId, materialId: node.id });
            await loadAdminProgressUser(user.userId);
          });
          actions.append(button);
        });
      }
      if (node.type === 'lesson' && node.settings?.steps?.length) {
        const step = document.createElement('select'); step.className = 'text-field';
        node.settings.steps.forEach((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.title; step.append(option); });
        step.value = record?.details?.currentStepId || node.settings.steps[0].id;
        const setStep = document.createElement('button'); setStep.type = 'button'; setStep.className = 'button button-secondary'; setStep.textContent = 'Ustaw krok';
        setStep.addEventListener('click', async () => {
          await mutateAdminProgress({ action: 'set_step', targetUserId: user.userId, materialId: node.id, stepId: step.value });
          await loadAdminProgressUser(user.userId);
        });
        const unlock = document.createElement('button'); unlock.type = 'button'; unlock.className = 'button button-secondary'; unlock.textContent = 'Odblokuj krok';
        unlock.addEventListener('click', async () => {
          await mutateAdminProgress({ action: 'unlock_step', targetUserId: user.userId, materialId: node.id, stepId: step.value });
          await loadAdminProgressUser(user.userId);
        });
        const lock = document.createElement('button'); lock.type = 'button'; lock.className = 'button button-secondary'; lock.textContent = 'Zablokuj krok';
        lock.addEventListener('click', async () => {
          await mutateAdminProgress({ action: 'lock_step', targetUserId: user.userId, materialId: node.id, stepId: step.value });
          await loadAdminProgressUser(user.userId);
        });
        actions.append(step, setStep, unlock, lock);
      }
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'button button-danger-soft'; reset.textContent = 'Reset';
      const scope = node.type === 'department' ? 'department' : ['section', 'subsection'].includes(node.type) ? 'section' : 'material';
      reset.addEventListener('click', async () => {
        if (await mutateAdminProgress({ targetUserId: user.userId, scope, materialId: node.id }, `Zresetować „${node.title}” dla tego użytkownika?`)) {
          await loadAdminProgressUser(user.userId);
        }
      });
      actions.append(reset);
    };

    const formatExamDuration = (seconds) => {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      const minutes = Math.floor(total / 60);
      return `${minutes ? `${minutes} min ` : ''}${total % 60} s`;
    };

    const appendExamAttempts = (body, node) => {
      const repositoryId = node.settings?.repositoryId || 'default';
      const examId = node.settings?.examId || '';
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(repositoryId) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(examId)) return;
      const report = document.createElement('details');
      report.className = 'admin-progress-exam-attempts';
      const summary = document.createElement('summary');
      summary.textContent = 'Próby egzaminu, wyniki i czas';
      const content = document.createElement('div');
      content.className = 'admin-progress-exam-attempt-list';
      report.append(summary, content);
      let loaded = false;
      report.addEventListener('toggle', async () => {
        if (!report.open || loaded) return;
        loaded = true;
        content.textContent = 'Wczytywanie prób egzaminu…';
        try {
          const query = `?view=user&repo=${encodeURIComponent(repositoryId)}&exam=${encodeURIComponent(examId)}&userId=${encodeURIComponent(user.userId)}`;
          const result = await adminExamRequest('GET', query);
          const attempts = (result.user?.attempts || []).slice().sort((left, right) => Number(right.number) - Number(left.number));
          content.replaceChildren();
          if (!attempts.length) {
            content.append(Object.assign(document.createElement('p'), { className: 'admin-progress-report-empty', textContent: 'Uczeń nie rozpoczął jeszcze żadnej próby tego egzaminu.' }));
            return;
          }
          attempts.forEach((attempt) => {
            const row = document.createElement('article');
            row.className = 'admin-progress-exam-attempt';
            const copy = document.createElement('div');
            const status = attempt.status === 'active' ? 'W trakcie'
              : attempt.status === 'timed_out' ? 'Zakończona przez limit czasu'
                : attempt.status === 'reset' ? 'Zresetowana' : 'Zakończona';
            copy.append(
              Object.assign(document.createElement('strong'), { textContent: `Próba ${attempt.number} · ${status}` }),
              Object.assign(document.createElement('small'), { textContent: `Wynik: ${attempt.scorePercent == null ? '—' : adminProgressPercent(attempt.scorePercent)} · ${attempt.passed == null ? 'brak statusu' : attempt.passed ? 'zaliczono' : 'nie zaliczono'} · czas: ${attempt.durationSeconds == null ? '—' : formatExamDuration(attempt.durationSeconds)}` }),
              Object.assign(document.createElement('small'), { textContent: `Start: ${adminDateLabel(attempt.startedAt)} · zakończenie: ${adminDateLabel(attempt.submittedAt)}` })
            );
            row.append(copy);
            if (attempt.status !== 'reset') {
              const reset = document.createElement('button');
              reset.type = 'button';
              reset.className = 'button button-danger-soft';
              reset.textContent = 'Reset próby';
              reset.addEventListener('click', async () => {
                if (!window.confirm(`Zresetować próbę ${attempt.number} tego egzaminu? Wynik ucznia zostanie przeliczony na podstawie pozostałych prób.`)) return;
                reset.disabled = true;
                try {
                  await adminExamRequest('DELETE', '', {
                    repositoryId, examId, targetUserId: user.userId, attemptId: attempt.attemptId,
                    operationId: `dashboard-reset-${Date.now()}`
                  });
                  await loadAdminProgressUser(user.userId);
                } catch (error) {
                  setPanelStatus(elements.adminProgressStatus, error?.message || 'Nie udało się zresetować próby.', 'error');
                  reset.disabled = false;
                }
              });
              row.append(reset);
            }
            content.append(row);
          });
        } catch (error) {
          loaded = false;
          content.textContent = error?.message || 'Nie udało się wczytać prób egzaminu.';
        }
      });
      body.append(report);
    };

    const createMaterialRow = (node) => {
      const data = aggregate.nodes[node.id];
      const record = user.records[node.id] || null;
      const nested = childrenByParent.get(node.id) || [];
      const isContainer = nested.length > 0 || ['department', 'section', 'subsection'].includes(node.type);
      const card = document.createElement('details');
      card.className = 'admin-progress-material';
      const summary = document.createElement('summary');
      const copy = document.createElement('span');
      copy.className = 'admin-progress-material-copy';
      copy.append(
        Object.assign(document.createElement('strong'), { textContent: node.title }),
        Object.assign(document.createElement('small'), { textContent: `${adminProgressNodeTypeLabel(node.type)}${nested.length ? ` · ${nested.length} ${nested.length === 1 ? 'element' : 'elementy'}` : ''}` })
      );
      const state = document.createElement('span');
      state.className = 'admin-progress-material-state';
      state.textContent = isContainer
        ? `${data?.completedCount || 0}/${data?.trackedCount || 0} ukończonych`
        : (window.ChemProgress?.statusLabel(record) || record?.status || 'Nie rozpoczęto');
      const percent = document.createElement('strong');
      percent.className = 'admin-progress-material-percent';
      percent.textContent = adminProgressPercent(data?.progressPercent);
      const chevron = document.createElement('span');
      chevron.className = 'admin-progress-material-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      summary.append(copy, state, percent, chevron);
      card.append(summary);

      let hydrated = false;
      card.addEventListener('toggle', () => {
        if (!card.open || hydrated) return;
        hydrated = true;
        const body = document.createElement('div');
        body.className = 'admin-progress-material-body';
        const facts = document.createElement('div');
        facts.className = 'admin-progress-material-facts';
        if (isContainer) {
          facts.append(
            Object.assign(document.createElement('small'), { textContent: `Postęp: ${adminProgressPercent(data?.progressPercent)} · ukończone materiały: ${data?.completedCount || 0}/${data?.trackedCount || 0}` }),
            Object.assign(document.createElement('small'), { textContent: nested.length ? 'Rozwiń poniższe wiersze, aby zobaczyć ich parametry.' : 'Ten kontener nie ma materiałów.' })
          );
        } else {
          facts.append(
            Object.assign(document.createElement('small'), { textContent: `${record?.opened ? 'Otwarty' : 'Nieotwarty'} · ${window.ChemProgress?.statusLabel(record) || record?.status || 'Nie rozpoczęto'} · ${recordDetailsLabel(node, record)}` }),
            Object.assign(document.createElement('small'), { textContent: `Pierwsze otwarcie: ${adminDateLabel(record?.firstOpenedAt)} · ostatnia aktywność: ${adminDateLabel(record?.lastActivityAt)}` })
          );
        }
        const actions = document.createElement('div');
        actions.className = 'admin-progress-material-actions';
        appendMaterialActions(actions, node, record);
        body.append(facts, actions);
        if (node.type === 'exam') appendExamAttempts(body, node);
        if (nested.length) {
          const childList = document.createElement('div');
          childList.className = 'admin-progress-material-children';
          nested.forEach((child) => childList.append(createMaterialRow(child)));
          body.append(childList);
        }
        card.append(body);
      });
      return card;
    };

    (childrenByParent.get('__root__') || []).forEach((node) => list.append(createMaterialRow(node)));
    if (!list.childElementCount) {
      list.append(Object.assign(document.createElement('p'), { className: 'admin-empty', textContent: 'Brak materiałów w katalogu postępu.' }));
    }
    host.append(list);
  }

  function adminAiStatusLabel(status) {
    return ({
      ok: 'Połączenie działa',
      invalid_key: 'Nieprawidłowy klucz',
      model_unavailable: 'Model niedostępny',
      rate_limited: 'Limit dostawcy',
      provider_error: 'Błąd dostawcy',
      untested: 'Nie przetestowano'
    })[status] || 'Nie przetestowano';
  }

  function adminAiProviderLabel(provider) {
    return provider === 'openai' ? 'OpenAI' : 'Google Gemini';
  }

  function availableAdminAiConfigs() {
    const configs = [...(adminAiSettings?.configs || [])];
    if (adminAiSettings?.legacyEnvironment?.gemini) configs.push({ aiConfigId: 'env-gemini', name: 'Gemini (ENV)', provider: 'gemini' });
    if (adminAiSettings?.legacyEnvironment?.openai) configs.push({ aiConfigId: 'env-openai', name: 'OpenAI (ENV)', provider: 'openai' });
    return configs;
  }

  async function adminAiRequest(method, body, query) {
    const token = await getAdminToken();
    const response = await fetch(`${ADMIN_AI_URL}${query || ''}`, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return readAdminResponse(response);
  }

  function adminAiAuditLabel(entry) {
    return ({
      'ai.config.created': 'Utworzono konfigurację',
      'ai.config.updated': 'Zmieniono konfigurację',
      'ai.model.changed': 'Zmieniono model',
      'ai.secret.changed': 'Ustawiono lub zastąpiono klucz',
      'ai.secret.removed': 'Usunięto klucz',
      'ai.default.changed': 'Zmieniono konfigurację domyślną',
      'ai.module.changed': 'Zmieniono routing modułu',
      'ai.config.removed': 'Usunięto konfigurację',
      'ai.connection.tested': 'Przetestowano połączenie'
    })[entry.action] || 'Zmieniono ustawienia AI';
  }

  async function loadAdminAiAudit() {
    if (!elements.adminAiAudit.open) return;
    elements.adminAiAuditList.textContent = 'Wczytywanie historii…';
    try {
      const payload = await adminAiRequest('GET', null, '?view=audit');
      const audit = Array.isArray(payload.audit) ? payload.audit : [];
      if (!audit.length) {
        elements.adminAiAuditList.textContent = 'Historia zmian jest jeszcze pusta.';
        return;
      }
      const list = document.createElement('ol');
      audit.forEach((entry) => {
        const item = document.createElement('li');
        const copy = document.createElement('span');
        copy.append(
          Object.assign(document.createElement('strong'), { textContent: adminAiAuditLabel(entry) }),
          Object.assign(document.createElement('small'), { textContent: `${entry.aiConfigId || 'ustawienia globalne'}${entry.module ? ` · ${entry.module}` : ''}` }),
          Object.assign(document.createElement('small'), { textContent: `${entry.timestamp ? new Date(entry.timestamp).toLocaleString('pl-PL') : 'brak daty'} · admin ${entry.adminId || '—'}` })
        );
        item.append(Object.assign(document.createElement('span'), { className: 'admin-ai-audit-marker', textContent: '•' }), copy);
        list.append(item);
      });
      elements.adminAiAuditList.replaceChildren(list);
    } catch (error) {
      elements.adminAiAuditList.textContent = error?.message || 'Nie udało się wczytać historii zmian AI.';
    }
  }

  function setAdminAiBusy(busy) {
    [elements.adminAiSave, elements.adminAiNew, elements.adminAiRefresh, elements.adminAiModelsRefresh,
      elements.adminAiSecretSave].forEach((button) => {
      if (button) button.disabled = Boolean(busy);
    });
    if (elements.adminAiSecretRemove) {
      const selected = (adminAiSettings?.configs || []).find((config) => config.aiConfigId === elements.adminAiConfigId.value);
      elements.adminAiSecretRemove.disabled = Boolean(busy) || !selected?.secretConfigured;
    }
    if (elements.adminAiList) elements.adminAiList.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function resetAdminAiEditor() {
    elements.adminAiConfigForm.reset();
    elements.adminAiConfigId.value = '';
    elements.adminAiProvider.value = 'gemini';
    elements.adminAiModel.value = 'gemini-2.5-flash';
    elements.adminAiEditorTitle.textContent = 'Dodaj dostawcę AI';
    elements.adminAiSecretBox.hidden = false;
    elements.adminAiSecretActions.hidden = true;
    elements.adminAiSecret.value = '';
    elements.adminAiSecretState.textContent = 'Wklej klucz teraz — zapisze się razem z nową konfiguracją.';
    elements.adminAiSave.textContent = '3. Zapisz konfigurację i klucz';
    setPanelStatus(elements.adminAiStatus, '1. Wybierz dostawcę i model. 2. Wklej klucz API. 3. Zapisz konfigurację.', 'info');
  }

  function editAdminAiConfig(config) {
    elements.adminAiConfigId.value = config.aiConfigId;
    elements.adminAiName.value = config.name;
    elements.adminAiProvider.value = config.provider;
    elements.adminAiModel.value = config.model;
    elements.adminAiDescription.value = config.description || '';
    elements.adminAiEditorTitle.textContent = `Edytuj: ${config.name}`;
    elements.adminAiSecretBox.hidden = false;
    elements.adminAiSecretActions.hidden = false;
    elements.adminAiSecret.value = '';
    elements.adminAiSecretState.textContent = config.secretConfigured
      ? `Klucz ustawiony · końcówka ••••${config.secretHint || ''}`
      : 'Nie ustawiono klucza.';
    elements.adminAiSecretRemove.disabled = !config.secretConfigured;
    elements.adminAiSave.textContent = 'Zapisz konfigurację';
    setPanelStatus(elements.adminAiStatus, `Wybrano ${adminAiProviderLabel(config.provider)} · ${config.model}.`, 'info');
  }

  function fillAdminAiModuleSelect(select, moduleName) {
    if (!select) return;
    const current = adminAiSettings?.moduleAssignments?.[moduleName] || '';
    const options = [Object.assign(document.createElement('option'), { value: '', textContent: 'Konfiguracja domyślna' })];
    (adminAiSettings?.configs || []).forEach((config) => {
      options.push(Object.assign(document.createElement('option'), {
        value: config.aiConfigId,
        textContent: `${config.name} · ${adminAiProviderLabel(config.provider)}`
      }));
    });
    select.replaceChildren(...options);
    select.value = current;
  }

  function renderAdminAi() {
    const configs = Array.isArray(adminAiSettings?.configs) ? adminAiSettings.configs : [];
    elements.adminAiList.replaceChildren();
    elements.adminAiEmpty.hidden = configs.length > 0;
    fillAdminAiModuleSelect(elements.adminAiModuleChat, 'chat');
    fillAdminAiModuleSelect(elements.adminAiModuleGrader, 'aiGrader');
    fillAdminAiModuleSelect(elements.adminAiModuleForms, 'aiForms');
    fillAdminAiModuleSelect(elements.adminAiModuleOther, 'other');
    configs.forEach((config) => {
      const card = document.createElement('article');
      card.className = `admin-ai-card${config.isDefault ? ' is-default' : ''}`;
      const heading = document.createElement('div');
      heading.className = 'admin-ai-card-heading';
      const title = document.createElement('div');
      title.append(
        Object.assign(document.createElement('strong'), { textContent: config.name }),
        Object.assign(document.createElement('small'), { textContent: `${adminAiProviderLabel(config.provider)} · ${config.model}` })
      );
      const badges = document.createElement('span');
      badges.className = 'admin-ai-badges';
      if (config.isDefault) badges.append(Object.assign(document.createElement('span'), { className: 'admin-ai-badge is-default', textContent: 'Domyślna' }));
      badges.append(Object.assign(document.createElement('span'), {
        className: `admin-ai-badge is-${config.connectionStatus || 'untested'}`,
        textContent: adminAiStatusLabel(config.connectionStatus)
      }));
      heading.append(title, badges);
      const details = document.createElement('p');
      details.textContent = config.description || 'Bez dodatkowego opisu.';
      const keyState = document.createElement('small');
      keyState.className = 'admin-ai-key-state';
      keyState.textContent = config.secretConfigured
        ? `Klucz ustawiony · ••••${config.secretHint || ''}${config.lastTestedAt ? ` · test ${new Date(config.lastTestedAt).toLocaleString('pl-PL')}` : ''}`
        : 'Brak klucza w bezpiecznym magazynie';
      const actions = document.createElement('div');
      actions.className = 'admin-ai-card-actions';
      const button = (label, className, handler) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = className;
        node.textContent = label;
        node.addEventListener('click', handler);
        return node;
      };
      actions.append(
        button('Edytuj / klucz', 'button button-secondary', () => editAdminAiConfig(config)),
        button('Testuj', 'button button-secondary', () => testAdminAiConnection(config.aiConfigId)),
        button('Ustaw domyślną', 'button button-secondary', () => setAdminAiDefault(config.aiConfigId)),
        button('Usuń', 'button button-secondary button-danger-soft', () => deleteAdminAiConfig(config))
      );
      card.append(heading, details, keyState, actions);
      elements.adminAiList.append(card);
    });
  }

  async function loadAdminAi(force) {
    if (adminAiLoaded && !force) return;
    setAdminAiBusy(true);
    setPanelStatus(elements.adminAiStatus, 'Wczytywanie konfiguracji AI…', 'loading');
    try {
      adminAiSettings = await adminAiRequest('GET');
      adminAiLoaded = true;
      renderAdminAi();
      const selected = adminAiSettings.configs.find((config) => config.aiConfigId === elements.adminAiConfigId.value);
      if (selected) editAdminAiConfig(selected);
      else resetAdminAiEditor();
    } catch (error) {
      adminAiLoaded = false;
      setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się wczytać konfiguracji AI.', 'error');
    } finally {
      setAdminAiBusy(false);
    }
  }

  async function saveAdminAiConfig(event) {
    event.preventDefault();
    const before = new Set((adminAiSettings?.configs || []).map((config) => config.aiConfigId));
    const pendingSecret = elements.adminAiSecret.value.trim();
    const config = {
      aiConfigId: elements.adminAiConfigId.value || undefined,
      name: elements.adminAiName.value.trim(),
      provider: elements.adminAiProvider.value,
      model: elements.adminAiModel.value.trim(),
      description: elements.adminAiDescription.value.trim()
    };
    setAdminAiBusy(true);
    setPanelStatus(elements.adminAiStatus, 'Zapisywanie konfiguracji…', 'loading');
    try {
      adminAiSettings = await adminAiRequest('POST', { action: 'save-config', config });
      const selectedId = config.aiConfigId || adminAiSettings.configs.find((item) => !before.has(item.aiConfigId))?.aiConfigId;
      if (pendingSecret && selectedId) {
        adminAiSettings = await adminAiRequest('POST', { action: 'set-secret', aiConfigId: selectedId, secret: pendingSecret });
      }
      renderAdminAi();
      const selected = adminAiSettings.configs.find((item) => item.aiConfigId === selectedId);
      if (selected) editAdminAiConfig(selected);
      setPanelStatus(
        elements.adminAiStatus,
        pendingSecret
          ? 'Konfiguracja i klucz API zostały zapisane. Możesz teraz przetestować połączenie.'
          : 'Konfiguracja zapisana bez klucza. Wklej klucz w polu powyżej i kliknij „Ustaw / zmień klucz”.',
        'info'
      );
    } catch (error) {
      setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się zapisać konfiguracji.', 'error');
    } finally { setAdminAiBusy(false); }
  }

  async function saveAdminAiSecret() {
    const aiConfigId = elements.adminAiConfigId.value;
    const secret = elements.adminAiSecret.value;
    if (!aiConfigId) return setPanelStatus(elements.adminAiStatus, 'Najpierw zapisz konfigurację.', 'error');
    if (!secret.trim()) return setPanelStatus(elements.adminAiStatus, 'Wklej klucz API.', 'error');
    setAdminAiBusy(true);
    setPanelStatus(elements.adminAiStatus, 'Bezpieczne zapisywanie klucza…', 'loading');
    try {
      adminAiSettings = await adminAiRequest('POST', { action: 'set-secret', aiConfigId, secret });
      elements.adminAiSecret.value = '';
      renderAdminAi();
      editAdminAiConfig(adminAiSettings.configs.find((item) => item.aiConfigId === aiConfigId));
      setPanelStatus(elements.adminAiStatus, 'Klucz zapisany po stronie serwera. Jego pełna wartość nie wróciła do przeglądarki.', 'info');
    } catch (error) { setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się zapisać klucza.', 'error'); }
    finally { setAdminAiBusy(false); }
  }

  async function removeAdminAiSecret() {
    const aiConfigId = elements.adminAiConfigId.value;
    if (!aiConfigId || !window.confirm('Usunąć klucz API tej konfiguracji? Chat użyje innej konfiguracji lub awaryjnego klucza ENV.')) return;
    setAdminAiBusy(true);
    try {
      adminAiSettings = await adminAiRequest('POST', { action: 'remove-secret', aiConfigId });
      renderAdminAi();
      editAdminAiConfig(adminAiSettings.configs.find((item) => item.aiConfigId === aiConfigId));
      setPanelStatus(elements.adminAiStatus, 'Klucz został usunięty z magazynu sekretów.', 'info');
    } catch (error) { setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się usunąć klucza.', 'error'); }
    finally { setAdminAiBusy(false); }
  }

  async function testAdminAiConnection(aiConfigId) {
    setAdminAiBusy(true);
    setPanelStatus(elements.adminAiStatus, 'Sprawdzanie klucza i dostępności modelu…', 'loading');
    try {
      adminAiSettings = await adminAiRequest('POST', { action: 'test-connection', aiConfigId });
      renderAdminAi();
      setPanelStatus(elements.adminAiStatus, 'Połączenie działa, a wybrany model jest dostępny.', 'info');
    } catch (error) {
      await loadAdminAi(true);
      setPanelStatus(elements.adminAiStatus, error?.message || 'Test połączenia nie powiódł się.', 'error');
    } finally { setAdminAiBusy(false); }
  }

  async function refreshAdminAiModels() {
    const aiConfigId = elements.adminAiConfigId.value;
    if (!aiConfigId) return setPanelStatus(elements.adminAiStatus, 'Najpierw zapisz konfigurację i ustaw jej klucz.', 'error');
    setAdminAiBusy(true);
    setPanelStatus(elements.adminAiStatus, 'Pobieranie modeli od dostawcy…', 'loading');
    try {
      const payload = await adminAiRequest('POST', { action: 'list-models', aiConfigId });
      const options = (payload.models || []).map((model) => Object.assign(document.createElement('option'), { value: model.id, label: model.name || model.id }));
      elements.adminAiModelList.replaceChildren(...options);
      setPanelStatus(elements.adminAiStatus, `Pobrano ${options.length} modeli. Możesz wybrać z podpowiedzi albo wpisać ID ręcznie.`, 'info');
      elements.adminAiModel.focus();
    } catch (error) { setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się pobrać modeli.', 'error'); }
    finally { setAdminAiBusy(false); }
  }

  async function setAdminAiDefault(aiConfigId) {
    setAdminAiBusy(true);
    try {
      adminAiSettings = await adminAiRequest('POST', { action: 'set-default', aiConfigId });
      renderAdminAi();
      setPanelStatus(elements.adminAiStatus, 'Zmieniono domyślną konfigurację AI.', 'info');
    } catch (error) { setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się zmienić konfiguracji domyślnej.', 'error'); }
    finally { setAdminAiBusy(false); }
  }

  async function setAdminAiModule(moduleName, aiConfigId) {
    [elements.adminAiModuleChat, elements.adminAiModuleGrader, elements.adminAiModuleForms, elements.adminAiModuleOther].forEach((select) => { select.disabled = true; });
    try {
      adminAiSettings = await adminAiRequest('POST', { action: 'set-module', module: moduleName, aiConfigId: aiConfigId || null });
      renderAdminAi();
      setPanelStatus(elements.adminAiStatus, 'Routing modułu zapisany.', 'info');
    } catch (error) {
      renderAdminAi();
      setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się zapisać routingu.', 'error');
    } finally {
      [elements.adminAiModuleChat, elements.adminAiModuleGrader, elements.adminAiModuleForms, elements.adminAiModuleOther].forEach((select) => { select.disabled = false; });
    }
  }

  async function deleteAdminAiConfig(config) {
    if (!window.confirm(`Usunąć konfigurację „${config.name}” wraz z zapisanym kluczem?`)) return;
    setAdminAiBusy(true);
    try {
      adminAiSettings = await adminAiRequest('DELETE', { aiConfigId: config.aiConfigId });
      renderAdminAi();
      resetAdminAiEditor();
      setPanelStatus(elements.adminAiStatus, 'Konfiguracja i jej klucz zostały usunięte.', 'info');
    } catch (error) { setPanelStatus(elements.adminAiStatus, error?.message || 'Nie udało się usunąć konfiguracji.', 'error'); }
    finally { setAdminAiBusy(false); }
  }

  async function adminAiUsageRequest(method, body, query) {
    const token = await getAdminToken();
    const response = await fetch(`${ADMIN_AI_USAGE_URL}${query || ''}`, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return readAdminResponse(response);
  }

  function emptyAdminAiLimitSet() {
    return Object.fromEntries(AI_LIMIT_METRICS.map((metric) => [
      metric,
      Object.fromEntries(AI_LIMIT_PERIODS.map((period) => [period, null]))
    ]));
  }

  function emptyAdminAiConfigPolicy() {
    return {
      global: emptyAdminAiLimitSet(),
      perUser: emptyAdminAiLimitSet(),
      pricing: { inputPerMillion: null, outputPerMillion: null },
      fallbackConfigId: null
    };
  }

  function adminAiUserLabel(userId) {
    const user = adminUsers.find((item) => (item.id || item.sub) === userId);
    if (!user) return userId;
    const metadata = user.user_metadata || {};
    const name = [
      user.firstName || metadata.first_name || metadata.firstName,
      user.lastName || metadata.last_name || metadata.lastName
    ].filter(Boolean).join(' ');
    return `${name || user.email || userId}${user.email && name ? ` · ${user.email}` : ''}`;
  }

  function populateAdminAiLimitScope() {
    if (!adminAiUsageSettings) return;
    const scope = elements.adminAiLimitScope.value;
    const usesModuleInput = scope === 'module';
    const usesId = ['provider', 'config', 'configUser', 'user'].includes(scope);
    elements.adminAiLimitScopeIdWrap.hidden = !usesId;
    elements.adminAiLimitModuleWrap.hidden = !usesModuleInput;
    elements.adminAiLimitUserModeWrap.hidden = scope !== 'user';
    elements.adminAiConfigPolicy.hidden = !['config', 'configUser'].includes(scope);
    let choices = [];
    if (scope === 'provider') choices = ['gemini', 'openai'].map((id) => ({ id, label: adminAiProviderLabel(id) }));
    if (scope === 'config' || scope === 'configUser') choices = availableAdminAiConfigs().map((config) => ({ id: config.aiConfigId, label: `${config.name} · ${config.aiConfigId}` }));
    if (scope === 'user') {
      const ids = new Set([
        ...adminUsers.map((user) => user.id || user.sub),
        ...Object.keys(adminAiUsageSettings.users || {}),
        ...(adminAiUsageReport?.users || []).map((user) => user.userId)
      ].filter(Boolean));
      choices = Array.from(ids).map((id) => ({ id, label: adminAiUserLabel(id) }));
    }
    if (usesId) {
      const previous = adminAiLimitSelection.scope === scope ? adminAiLimitSelection.id : '';
      elements.adminAiLimitScopeId.replaceChildren(...choices.map((choice) => Object.assign(document.createElement('option'), {
        value: choice.id, textContent: choice.label
      })));
      elements.adminAiLimitScopeId.value = choices.some((choice) => choice.id === previous) ? previous : choices[0]?.id || '';
    }
    if (usesModuleInput) {
      const known = Object.keys(adminAiUsageSettings.modules || {});
      elements.adminAiLimitModuleId.value = adminAiLimitSelection.scope === scope && adminAiLimitSelection.id
        ? adminAiLimitSelection.id : known[0] || 'chat';
    }
    adminAiLimitSelection = {
      scope,
      id: usesModuleInput ? elements.adminAiLimitModuleId.value.trim() : usesId ? elements.adminAiLimitScopeId.value : ''
    };
    renderAdminAiLimitEditor();
  }

  function selectedAdminAiLimitSet(create) {
    const settings = adminAiUsageSettings;
    if (!settings) return null;
    const { scope, id } = adminAiLimitSelection;
    if (scope === 'global') return settings.global;
    if (scope === 'defaultUser') return settings.defaultUser;
    if (!id) return null;
    if (scope === 'provider' || scope === 'module') {
      const map = scope === 'provider' ? settings.providers : settings.modules;
      if (!map[id] && create) map[id] = emptyAdminAiLimitSet();
      return map[id] || null;
    }
    if (scope === 'config' || scope === 'configUser') {
      if (!settings.configs[id] && create) settings.configs[id] = emptyAdminAiConfigPolicy();
      const policy = settings.configs[id];
      return policy ? policy[scope === 'config' ? 'global' : 'perUser'] : null;
    }
    if (scope === 'user') {
      if (!settings.users[id] && create) settings.users[id] = { mode: 'inherit', limits: emptyAdminAiLimitSet() };
      return settings.users[id]?.limits || null;
    }
    return null;
  }

  function commitAdminAiLimitEditor() {
    if (!adminAiUsageSettings) return;
    const limitSet = selectedAdminAiLimitSet(true);
    if (limitSet) {
      elements.adminAiLimitGrid.querySelectorAll('input[data-ai-limit-metric]').forEach((input) => {
        const raw = input.value.trim();
        if (!raw) limitSet[input.dataset.aiLimitMetric][input.dataset.aiLimitPeriod] = null;
        else {
          const value = Number(raw);
          if (!Number.isSafeInteger(value) || value < 0) throw new Error('Limit musi być pusty albo nieujemną liczbą całkowitą.');
          limitSet[input.dataset.aiLimitMetric][input.dataset.aiLimitPeriod] = value;
        }
      });
    }
    const { scope, id } = adminAiLimitSelection;
    if (scope === 'user' && id && adminAiUsageSettings.users[id]) {
      adminAiUsageSettings.users[id].mode = elements.adminAiLimitUserMode.value;
    }
    if (['config', 'configUser'].includes(scope) && id) {
      const policy = adminAiUsageSettings.configs[id] || (adminAiUsageSettings.configs[id] = emptyAdminAiConfigPolicy());
      const parsePrice = (input) => {
        if (!input.value.trim()) return null;
        const value = Number(input.value);
        if (!Number.isFinite(value) || value < 0) throw new Error('Cena tokenów musi być nieujemną liczbą.');
        return value;
      };
      policy.pricing.inputPerMillion = parsePrice(elements.adminAiPriceInput);
      policy.pricing.outputPerMillion = parsePrice(elements.adminAiPriceOutput);
      policy.fallbackConfigId = elements.adminAiFallback.value || null;
    }
  }

  function renderAdminAiLimitEditor() {
    const limitSet = selectedAdminAiLimitSet(true);
    const selectedUserMode = adminAiLimitSelection.scope === 'user'
      ? adminAiUsageSettings.users[adminAiLimitSelection.id]?.mode || 'inherit'
      : '';
    const disabled = !limitSet || (adminAiLimitSelection.scope === 'user' && ['unlimited', 'disabled'].includes(selectedUserMode));
    const table = document.createElement('table');
    table.className = 'admin-ai-limit-table';
    const labels = { requests: 'Żądania', inputTokens: 'Tokeny wejścia', outputTokens: 'Tokeny wyjścia', totalTokens: 'Tokeny łącznie', estimatedCostMicros: 'Koszt (mikro)' };
    const periodLabels = { hour: 'Godzina', day: 'Dzień', week: 'Tydzień', month: 'Miesiąc', lifetime: 'Łącznie' };
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    header.append(Object.assign(document.createElement('th'), { textContent: 'Metryka' }));
    AI_LIMIT_PERIODS.forEach((period) => header.append(Object.assign(document.createElement('th'), { textContent: periodLabels[period] })));
    head.append(header);
    const body = document.createElement('tbody');
    AI_LIMIT_METRICS.forEach((metric) => {
      const row = document.createElement('tr');
      row.append(Object.assign(document.createElement('th'), { textContent: labels[metric] }));
      AI_LIMIT_PERIODS.forEach((period) => {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '1';
        input.className = 'text-field';
        input.dataset.aiLimitMetric = metric;
        input.dataset.aiLimitPeriod = period;
        input.disabled = disabled;
        const value = limitSet && limitSet[metric] && limitSet[metric][period];
        input.value = value == null ? '' : String(value);
        input.setAttribute('aria-label', `${labels[metric]} — ${periodLabels[period]}`);
        cell.append(input);
        row.append(cell);
      });
      body.append(row);
    });
    table.append(head, body);
    elements.adminAiLimitGrid.replaceChildren(table);

    const { scope, id } = adminAiLimitSelection;
    if (scope === 'user' && id) {
      elements.adminAiLimitUserMode.value = adminAiUsageSettings.users[id]?.mode || 'inherit';
      const editable = ['inherit', 'custom'].includes(elements.adminAiLimitUserMode.value);
      elements.adminAiLimitGrid.querySelectorAll('input').forEach((input) => { input.disabled = !editable; });
    }
    if (['config', 'configUser'].includes(scope) && id) {
      const policy = adminAiUsageSettings.configs[id] || (adminAiUsageSettings.configs[id] = emptyAdminAiConfigPolicy());
      elements.adminAiPriceInput.value = policy.pricing.inputPerMillion == null ? '' : String(policy.pricing.inputPerMillion);
      elements.adminAiPriceOutput.value = policy.pricing.outputPerMillion == null ? '' : String(policy.pricing.outputPerMillion);
      const fallbackOptions = [Object.assign(document.createElement('option'), { value: '', textContent: 'Brak fallbacku' })];
      availableAdminAiConfigs().filter((config) => config.aiConfigId !== id).forEach((config) => fallbackOptions.push(Object.assign(document.createElement('option'), { value: config.aiConfigId, textContent: config.name })));
      elements.adminAiFallback.replaceChildren(...fallbackOptions);
      elements.adminAiFallback.value = policy.fallbackConfigId || '';
    }
  }

  function formatAdminAiCost(micros) {
    return `${(Number(micros || 0) / 1_000_000).toLocaleString('pl-PL', { maximumFractionDigits: 6 })} ${adminAiUsageReport?.currency || adminAiUsageSettings?.currency || ''}`.trim();
  }

  function renderAdminAiUsageSummary() {
    const totals = adminAiUsageReport?.totals || {};
    const period = adminAiUsageReport?.period || 'day';
    const cards = [
      ['Żądania', totals.requests || 0, 'requests'],
      ['Tokeny łącznie', totals.totalTokens || 0, 'totalTokens'],
      ['Szacowany koszt', formatAdminAiCost(totals.estimatedCostMicros), 'estimatedCostMicros'],
      ['Aktywni użytkownicy', (adminAiUsageReport?.users || []).filter((user) => user.requests > 0).length, null]
    ].map(([label, value, metric]) => {
      const card = document.createElement('article');
      const limit = metric ? adminAiUsageSettings?.global?.[metric]?.[period] : null;
      const raw = metric ? Number(totals[metric] || 0) : Number(value || 0);
      const percent = limit == null || limit <= 0 ? 0 : Math.min(100, Math.round((raw / limit) * 100));
      const thresholds = adminAiUsageSettings?.warningThresholds || [70, 90, 100];
      card.dataset.warning = percent >= thresholds[2] ? 'limit' : percent >= thresholds[1] ? 'critical' : percent >= thresholds[0] ? 'warning' : 'ok';
      card.append(
        Object.assign(document.createElement('span'), { textContent: label }),
        Object.assign(document.createElement('strong'), { textContent: typeof value === 'number' ? value.toLocaleString('pl-PL') : String(value) })
      );
      const progress = document.createElement('progress');
      progress.max = 100;
      progress.value = percent;
      progress.setAttribute('aria-label', limit == null ? `${label}: bez limitu` : `${label}: ${percent}% limitu`);
      const note = document.createElement('small');
      note.textContent = limit == null ? 'bez limitu globalnego' : `${percent}% z ${metric === 'estimatedCostMicros' ? formatAdminAiCost(limit) : Number(limit).toLocaleString('pl-PL')}`;
      card.append(progress, note);
      return card;
    });
    elements.adminAiUsageSummary.replaceChildren(...cards);
  }

  function renderAdminAiUsageTable(host, rows, options = {}) {
    const table = document.createElement('table');
    table.className = 'admin-ai-usage-table';
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    const headings = ['Nazwa / ID', 'Żądania', 'OK', 'Błędy', 'Wejście', 'Wyjście', 'Łącznie', 'Śr./request', 'Koszt'];
    if (options.reset) headings.push('Limit req.', 'Użycie');
    headings.forEach((label) => header.append(Object.assign(document.createElement('th'), { textContent: label })));
    if (options.reset) header.append(Object.assign(document.createElement('th'), { textContent: 'Akcje' }));
    head.append(header);
    const body = document.createElement('tbody');
    (rows || []).forEach((row) => {
      const tr = document.createElement('tr');
      tr.dataset.warning = row.warning?.level || 'ok';
      const label = options.label ? options.label(row) : row.id;
      const average = row.avgTokensPerRequest == null
        ? (row.requests ? Math.round(Number(row.totalTokens || 0) / row.requests) : 0)
        : row.avgTokensPerRequest;
      const values = [label, row.requests || 0, row.successfulRequests || 0, row.errors || 0, row.inputTokens || 0, row.outputTokens || 0, row.totalTokens || 0, average, formatAdminAiCost(row.estimatedCostMicros)];
      if (options.reset) {
        const limitLabel = row.mode === 'disabled' ? 'wyłączone' : row.limit == null ? '∞' : row.limit;
        values.push(limitLabel, `${Number(row.usagePercent || 0)}%`);
      }
      values.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        cell.textContent = typeof value === 'number' ? value.toLocaleString('pl-PL') : String(value || '—');
        tr.append(cell);
      });
      if (options.reset) {
        const cell = document.createElement('td');
        const limits = Object.assign(document.createElement('button'), { className: 'button button-secondary', type: 'button', textContent: 'Limity' });
        limits.addEventListener('click', () => openAdminAiUserLimits(row.userId));
        const detail = Object.assign(document.createElement('button'), { className: 'button button-secondary', type: 'button', textContent: 'Szczegóły' });
        detail.addEventListener('click', () => renderAdminAiUserDetail(row));
        const button = Object.assign(document.createElement('button'), { className: 'button button-secondary button-danger-soft', type: 'button', textContent: 'Wyzeruj' });
        button.addEventListener('click', () => resetAdminAiUserUsage(row.userId));
        cell.append(limits, detail, button);
        tr.append(cell);
      }
      body.append(tr);
    });
    if (!body.childElementCount) {
      const row = document.createElement('tr');
      const cell = Object.assign(document.createElement('td'), { colSpan: options.reset ? 12 : 9, textContent: 'Brak danych w tym okresie.' });
      row.append(cell);
      body.append(row);
    }
    table.append(head, body);
    const scroll = document.createElement('div');
    scroll.className = 'admin-ai-table-scroll';
    scroll.append(table);
    host.replaceChildren(scroll);
  }

  function emptyAdminAiPublicMetrics() {
    return {
      requests: 0,
      successfulRequests: 0,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostMicros: 0
    };
  }

  function adminAiEffectiveUserPolicy(userId) {
    const policy = adminAiUsageSettings?.users?.[userId];
    if (!policy || policy.mode === 'inherit') return { mode: 'inherit', limits: adminAiUsageSettings?.defaultUser || emptyAdminAiLimitSet() };
    if (policy.mode === 'custom') return { mode: 'custom', limits: policy.limits || emptyAdminAiLimitSet() };
    return { mode: policy.mode, limits: null };
  }

  function emptyAdminAiUserRow(userId, period) {
    const policy = adminAiEffectiveUserPolicy(userId);
    return {
      userId,
      mode: policy.mode,
      ...emptyAdminAiPublicMetrics(),
      limit: policy.limits?.requests?.[period] ?? null,
      usagePercent: 0,
      warning: null,
      periods: Object.fromEntries(AI_LIMIT_PERIODS.map((name) => [name, emptyAdminAiPublicMetrics()])),
      breakdown: { providers: [], modules: [], configs: [], models: [] }
    };
  }

  function allAdminAiUserIds() {
    return Array.from(new Set([
      ...adminUsers.map((user) => user.id || user.sub),
      ...Object.keys(adminAiUsageSettings?.users || {}),
      ...(adminAiUsageReport?.users || []).map((row) => row.userId)
    ].filter(Boolean)));
  }

  function adminAiUserSearchValue(userId) {
    const user = adminUsers.find((item) => (item.id || item.sub) === userId);
    return normalizeText([
      userId,
      user?.email,
      user?.firstName,
      user?.lastName,
      adminAiUserLabel(userId)
    ].filter(Boolean).join(' '));
  }

  function renderAdminAiUsageUsers() {
    if (!adminAiUsageSettings || !adminAiUsageReport) return;
    const period = adminAiUsageReport.period || elements.adminAiUsagePeriod.value || 'day';
    const query = normalizeText(elements.adminAiUsersSearch?.value);
    const allIds = allAdminAiUserIds().sort((left, right) => (
      adminAiUserLabel(left).localeCompare(adminAiUserLabel(right), 'pl', { sensitivity: 'base' })
    ));
    const filteredIds = query ? allIds.filter((userId) => adminAiUserSearchValue(userId).includes(query)) : allIds;
    const visibleIds = filteredIds.slice(0, adminAiUserVisibleCount);
    const rows = visibleIds.map((userId) => adminAiUserUsageRows.get(userId) || emptyAdminAiUserRow(userId, period));
    renderAdminAiUsageTable(elements.adminAiUsageUsers, rows, {
      reset: true,
      label: (row) => adminAiUserLabel(row.userId)
    });

    if (elements.adminAiUsersCount) {
      const shown = Math.min(visibleIds.length, filteredIds.length);
      elements.adminAiUsersCount.textContent = query
        ? `Wyświetlono ${shown} z ${filteredIds.length} pasujących kont (${allIds.length} łącznie)`
        : `Wyświetlono ${shown} z ${allIds.length} kont`;
    }
    const remaining = Math.max(0, filteredIds.length - visibleIds.length);
    elements.adminAiUsersMore.hidden = remaining === 0;
    elements.adminAiUsersMore.textContent = remaining
      ? `Pokaż więcej (${Math.min(ADMIN_AI_USERS_PAGE_SIZE, remaining)} z ${remaining})`
      : 'Pokaż więcej';

    const missing = visibleIds.filter((userId) => !adminAiUserUsageRows.has(userId) && !adminAiUserUsagePending.has(userId));
    if (missing.length) void loadAdminAiUsageUserRows(missing, period);
  }

  async function loadAdminAiUsageUserRows(userIds, period) {
    const ids = Array.from(new Set(userIds)).filter(Boolean);
    if (!ids.length) return;
    ids.forEach((userId) => adminAiUserUsagePending.add(userId));
    const requestId = adminAiUserUsageRequestId;
    try {
      for (let index = 0; index < ids.length; index += 50) {
        const chunk = ids.slice(index, index + 50);
        const query = `?view=users&period=${encodeURIComponent(period)}&ids=${encodeURIComponent(chunk.join(','))}`;
        const payload = await adminAiUsageRequest('GET', null, query);
        if (requestId !== adminAiUserUsageRequestId || period !== adminAiUserUsagePeriod) return;
        (payload.users || []).forEach((row) => {
          if (row?.userId) adminAiUserUsageRows.set(row.userId, row);
        });
      }
      renderAdminAiUsageUsers();
    } catch (error) {
      setPanelStatus(elements.adminAiUsageStatus, error?.message || 'Nie udało się wczytać użycia wybranych użytkowników.', 'error');
    } finally {
      ids.forEach((userId) => adminAiUserUsagePending.delete(userId));
    }
  }

  function renderAdminAiUserDetail(row) {
    const heading = document.createElement('div');
    heading.className = 'admin-ai-list-heading';
    const copy = document.createElement('div');
    copy.append(
      Object.assign(document.createElement('span'), { className: 'eyebrow', textContent: 'Szczegóły użytkownika' }),
      Object.assign(document.createElement('h3'), { textContent: adminAiUserLabel(row.userId) })
    );
    const close = Object.assign(document.createElement('button'), { className: 'button button-secondary', type: 'button', textContent: 'Zamknij' });
    close.addEventListener('click', () => { elements.adminAiUserDetail.hidden = true; });
    heading.append(copy, close);
    const grid = document.createElement('div');
    grid.className = 'admin-ai-usage-tables';
    const periods = document.createElement('div');
    periods.className = 'admin-ai-usage-summary admin-ai-user-periods';
    [['Ta godzina', 'hour'], ['Dzisiaj', 'day'], ['Tydzień', 'week'], ['Miesiąc', 'month'], ['Łącznie', 'lifetime']].forEach(([label, key]) => {
      const metrics = row.periods?.[key] || {};
      const card = document.createElement('article');
      card.append(
        Object.assign(document.createElement('span'), { textContent: label }),
        Object.assign(document.createElement('strong'), { textContent: `${Number(metrics.requests || 0).toLocaleString('pl-PL')} req.` }),
        Object.assign(document.createElement('small'), { textContent: `${Number(metrics.totalTokens || 0).toLocaleString('pl-PL')} tokenów · ${formatAdminAiCost(metrics.estimatedCostMicros)}` })
      );
      periods.append(card);
    });
    [['Moduły', 'modules'], ['Dostawcy', 'providers'], ['Konfiguracje', 'configs'], ['Modele', 'models']].forEach(([label, key]) => {
      const section = document.createElement('section');
      section.append(Object.assign(document.createElement('h3'), { textContent: label }));
      const host = document.createElement('div');
      section.append(host);
      renderAdminAiUsageTable(host, row.breakdown?.[key] || []);
      grid.append(section);
    });
    elements.adminAiUserDetail.replaceChildren(heading, periods, grid);
    elements.adminAiUserDetail.hidden = false;
    elements.adminAiUserDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderAdminAiUsage() {
    if (!adminAiUsageSettings || !adminAiUsageReport) return;
    elements.adminAiUsageTimezone.value = adminAiUsageSettings.timezone;
    elements.adminAiUsageCurrency.value = adminAiUsageSettings.currency;
    elements.adminAiUsageShowUser.checked = adminAiUsageSettings.showUserLimits !== false;
    [elements.adminAiWarning1, elements.adminAiWarning2, elements.adminAiWarning3].forEach((input, index) => { input.value = String(adminAiUsageSettings.warningThresholds[index]); });
    renderAdminAiUsageSummary();
    renderAdminAiUsageTable(elements.adminAiUsageProviders, adminAiUsageReport.providers);
    renderAdminAiUsageTable(elements.adminAiUsageModels, adminAiUsageReport.models);
    renderAdminAiUsageTable(elements.adminAiUsageConfigs, adminAiUsageReport.configs, {
      label: (row) => adminAiSettings?.configs?.find((config) => config.aiConfigId === row.id)?.name || row.id
    });
    renderAdminAiUsageTable(elements.adminAiUsageModules, adminAiUsageReport.modules);
    renderAdminAiUsageUsers();
    populateAdminAiLimitScope();
  }

  async function loadAdminAiUsage(force) {
    if (adminAiUsageLoaded && !force) return;
    elements.adminAiUsageRefresh.disabled = true;
    setPanelStatus(elements.adminAiUsageStatus, 'Wczytywanie limitów i użycia AI…', 'loading');
    try {
      const period = elements.adminAiUsagePeriod.value || 'day';
      const [settings, report, providerSettings] = await Promise.all([
        adminAiUsageRequest('GET', null, '?view=settings'),
        adminAiUsageRequest('GET', null, `?view=report&period=${encodeURIComponent(period)}`),
        adminAiRequest('GET'),
        adminUsers.length ? Promise.resolve() : loadAdminUsers()
      ]);
      adminAiUsageSettings = settings;
      adminAiUsageReport = report;
      adminAiSettings = providerSettings;
      adminAiUserUsagePeriod = report.period;
      adminAiUserUsageRows = new Map((report.users || []).filter((row) => row?.userId).map((row) => [row.userId, row]));
      adminAiUserUsageRequestId += 1;
      adminAiUserUsagePending.clear();
      adminAiUsageLoaded = true;
      renderAdminAiUsage();
      setPanelStatus(elements.adminAiUsageStatus, `Raport: ${report.key} · strefa ${report.timezone}.`, 'info');
    } catch (error) {
      adminAiUsageLoaded = false;
      setPanelStatus(elements.adminAiUsageStatus, error?.message || 'Nie udało się wczytać limitów AI.', 'error');
    } finally { elements.adminAiUsageRefresh.disabled = false; }
  }

  async function openAdminAiUserLimits(userId) {
    activateAdminTab('ai-usage', false);
    if (!adminAiUsageLoaded) await loadAdminAiUsage(false);
    if (!adminAiUsageSettings) return;
    elements.adminAiLimitScope.value = 'user';
    adminAiLimitSelection = { scope: 'user', id: userId };
    populateAdminAiLimitScope();
    elements.adminAiLimitScopeId.value = userId;
    adminAiLimitSelection.id = userId;
    renderAdminAiLimitEditor();
    elements.adminAiLimitUserMode.focus();
  }

  async function saveAdminAiUsageSettings() {
    try {
      commitAdminAiLimitEditor();
      adminAiUsageSettings.timezone = elements.adminAiUsageTimezone.value.trim();
      adminAiUsageSettings.currency = elements.adminAiUsageCurrency.value.trim().toUpperCase();
      adminAiUsageSettings.showUserLimits = elements.adminAiUsageShowUser.checked;
      adminAiUsageSettings.warningThresholds = [elements.adminAiWarning1, elements.adminAiWarning2, elements.adminAiWarning3].map((input) => Number(input.value));
      elements.adminAiUsageSave.disabled = true;
      setPanelStatus(elements.adminAiUsageStatus, 'Zapisywanie limitów…', 'loading');
      adminAiUsageSettings = await adminAiUsageRequest('PUT', { settings: adminAiUsageSettings });
      adminAiUsageLoaded = false;
      await loadAdminAiUsage(true);
      setPanelStatus(elements.adminAiUsageStatus, 'Limity AI zostały zapisane i obowiązują od następnego żądania.', 'info');
    } catch (error) {
      setPanelStatus(elements.adminAiUsageStatus, error?.message || 'Nie udało się zapisać limitów AI.', 'error');
    } finally { elements.adminAiUsageSave.disabled = false; }
  }

  function loadMoreAdminAiUsers() {
    adminAiUserVisibleCount += ADMIN_AI_USERS_PAGE_SIZE;
    renderAdminAiUsageUsers();
  }

  async function resetAdminAiUserUsage(userId) {
    if (!window.confirm(`Wyzerować całe zarejestrowane użycie AI użytkownika „${adminAiUserLabel(userId)}”? Operacja zostanie zapisana w audycie.`)) return;
    setPanelStatus(elements.adminAiUsageStatus, 'Zerowanie użycia użytkownika…', 'loading');
    try {
      await adminAiUsageRequest('POST', { action: 'reset-user', userId, confirmed: true });
      adminAiUsageLoaded = false;
      await loadAdminAiUsage(true);
      setPanelStatus(elements.adminAiUsageStatus, 'Użycie użytkownika wyzerowano. Liczniki globalne pozostały bez zmian.', 'info');
    } catch (error) { setPanelStatus(elements.adminAiUsageStatus, error?.message || 'Nie udało się wyzerować użycia.', 'error'); }
  }

  async function loadAdminAiUsageAudit() {
    if (!elements.adminAiUsageAudit.open) return;
    elements.adminAiUsageAuditList.textContent = 'Wczytywanie historii…';
    try {
      const payload = await adminAiUsageRequest('GET', null, '?view=audit');
      const audit = Array.isArray(payload.audit) ? payload.audit : [];
      if (!audit.length) return void (elements.adminAiUsageAuditList.textContent = 'Historia zmian jest jeszcze pusta.');
      const list = document.createElement('ol');
      audit.forEach((entry) => {
        const item = document.createElement('li');
        const copy = document.createElement('span');
        copy.append(
          Object.assign(document.createElement('strong'), { textContent: entry.action === 'ai.usage.user.reset' ? 'Wyzerowano użycie użytkownika' : 'Zmieniono limity AI' }),
          Object.assign(document.createElement('small'), { textContent: entry.targetUserId || 'ustawienia globalne' }),
          Object.assign(document.createElement('small'), { textContent: `${new Date(entry.timestamp).toLocaleString('pl-PL')} · admin ${entry.adminId || '—'}` })
        );
        item.append(Object.assign(document.createElement('span'), { className: 'admin-ai-audit-marker', textContent: '•' }), copy);
        list.append(item);
      });
      elements.adminAiUsageAuditList.replaceChildren(list);
    } catch (error) { elements.adminAiUsageAuditList.textContent = error?.message || 'Nie udało się wczytać historii.'; }
  }

  function activateAdminTab(name, focusTab) {
    const allowed = new Set(['users', 'forms', 'dashboard', 'content', 'progress', 'ai', 'ai-usage', 'payments']);
    const activeName = allowed.has(name) ? name : 'users';
    elements.adminTabs.forEach((tab) => {
      const active = tab.dataset.adminTab === activeName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus();
    });
    elements.adminPanels.forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== activeName; });
    if (activeName === 'forms' && !adminFormsLoaded) loadAdminForms();
    if (activeName === 'dashboard' && !adminDashboardLoaded) loadAdminDashboardEditor();
    if (activeName === 'content') {
      if (!adminContentLoaded) loadAdminContentStatus(false);
      if (!adminContentConfigLoaded) loadAdminContentConfigurator(false);
    }
    if (activeName === 'progress' && !adminProgressLoaded) loadAdminProgress(false);
    if (activeName === 'ai' && !adminAiLoaded) loadAdminAi(false);
    if (activeName === 'ai-usage' && !adminAiUsageLoaded) loadAdminAiUsage(false);
    if (activeName === 'payments' && !adminPricesLoaded) loadAdminPrices();
    return activeName;
  }

  function openAdminPanel(event) {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    const user = currentUser
      || (auth && typeof auth.getUser === 'function' ? auth.getUser() : null)
      || (identity && typeof identity.currentUser === 'function' ? identity.currentUser() : null);
    if (!isAdminUser(user)) return;
    lastAdminTrigger = event && event.currentTarget ? event.currentTarget : elements.adminButton;
    elements.adminSearch.value = '';
    if (typeof elements.adminDialog.showModal === 'function') elements.adminDialog.showModal();
    else elements.adminDialog.setAttribute('open', '');
    closeMenu();
    const requestedTab = event && typeof event.adminTab === 'string' ? event.adminTab : 'users';
    const activeTab = activateAdminTab(requestedTab, false);
    if (activeTab === 'users') {
      loadAdminUsers();
      window.setTimeout(() => elements.adminSearch.focus(), 0);
    }
  }

  function closeAdminPanel() {
    if (typeof elements.adminDialog.close === 'function') elements.adminDialog.close();
    else elements.adminDialog.removeAttribute('open');
  }

  async function logout() {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;
    elements.logoutButton.disabled = true;
    elements.logoutButton.textContent = 'Wylogowywanie…';
    try {
      if (auth && typeof auth.logout === 'function') await auth.logout({ redirect: false });
      else if (identity && typeof identity.logout === 'function') await identity.logout();
    } catch (_) {
      // Przekierowanie poniżej czyści widok także przy chwilowym błędzie widgetu.
    }
    window.location.replace(LOGIN_URL);
  }

  function setupIdentity() {
    const auth = window.ChemAuth;
    const identity = window.netlifyIdentity;

    if (auth) {
      const syncContract = (profile) => {
        const user = typeof auth.getUser === 'function' ? auth.getUser() : null;
        updateProfileDisplay(user, profile || (typeof auth.getProfile === 'function' ? auth.getProfile() : null));
      };
      if (auth.ready && typeof auth.ready.then === 'function') {
        auth.ready.then((detail) => {
          if (detail && detail.authenticated) syncContract(detail.profile);
        }).catch(() => {});
      }
      window.addEventListener('chem-auth-profile-updated', (event) => {
        syncContract(event.detail && event.detail.profile);
      });
      window.addEventListener('chem-auth-user-changed', (event) => {
        if (event.detail && event.detail.authenticated) syncContract(event.detail.profile);
      });
      syncContract();
    }

    if (!identity) return;

    const syncUser = (user) => {
      if (user) updateProfileDisplay(user, auth && typeof auth.getProfile === 'function' ? auth.getProfile() : null);
    };
    try { identity.on('init', syncUser); } catch (_) {}
    try { identity.on('login', syncUser); } catch (_) {}
    try { identity.on('logout', () => window.location.replace(LOGIN_URL)); } catch (_) {}
    try { syncUser(identity.currentUser()); } catch (_) {}
  }

  function bindEvents() {
    if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
    elements.menuButton.addEventListener('click', () => {
      if (isMobileSidebar()) {
        if (elements.body.classList.contains('menu-open')) closeMenu();
        else openMenu();
        return;
      }
      setSidebarCollapsed(document.documentElement.dataset.sidebar !== 'collapsed', true);
    });
    elements.sidebarBackdrop.addEventListener('click', closeMenu);
    elements.nav.addEventListener('click', handleNavigationClick);
    window.addEventListener('scroll', requestNavigationSync, { passive: true });
    window.addEventListener('resize', requestNavigationSync, { passive: true });
    window.addEventListener('hashchange', handleLocationNavigation);
    window.addEventListener('popstate', handleLocationNavigation);
    window.addEventListener('pageshow', () => {
      if (dashboardLoadId > 0) hydrateDashboardProgress(null, true);
    });
    window.addEventListener('wheel', cancelNavigationIntent, { passive: true });
    window.addEventListener('touchstart', cancelNavigationIntent, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', requestNavigationSync, { passive: true });
    }
    if (window.matchMedia) {
      const sidebarMedia = window.matchMedia(MOBILE_SIDEBAR_QUERY);
      const handleSidebarBreakpoint = () => {
        elements.body.classList.remove('menu-open');
        updateMenuButton();
      };
      if (typeof sidebarMedia.addEventListener === 'function') {
        sidebarMedia.addEventListener('change', handleSidebarBreakpoint);
      } else if (typeof sidebarMedia.addListener === 'function') {
        sidebarMedia.addListener(handleSidebarBreakpoint);
      }
    }
    elements.search.addEventListener('input', filterResources);
    elements.clearSearch.addEventListener('click', () => {
      elements.search.value = '';
      filterResources();
      elements.search.focus();
    });
    elements.profileButtons.forEach((button) => button.addEventListener('click', openProfile));
    elements.profileClose.addEventListener('click', closeProfile);
    elements.profileCancel.addEventListener('click', closeProfile);
    elements.profileForm.addEventListener('submit', saveProfile);
    elements.profilePasswordForm.addEventListener('submit', changeProfilePassword);
    elements.profileResetProgress.addEventListener('click', resetProfileProgress);
    elements.logoutButton.addEventListener('click', logout);
    elements.adminButton.addEventListener('click', openAdminPanel);
    elements.adminClose.addEventListener('click', closeAdminPanel);
    elements.adminRefresh.addEventListener('click', loadAdminUsers);
    elements.adminExportJson.addEventListener('click', () => downloadAdminContacts('json'));
    elements.adminExportXml.addEventListener('click', () => downloadAdminContacts('xml'));
    elements.adminSearch.addEventListener('input', renderAdminUsers);
    elements.adminInviteForm.addEventListener('submit', inviteAdminUser);
    elements.adminTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateAdminTab(tab.dataset.adminTab, false));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % elements.adminTabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + elements.adminTabs.length) % elements.adminTabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = elements.adminTabs.length - 1;
        activateAdminTab(elements.adminTabs[nextIndex].dataset.adminTab, true);
      });
    });
    elements.adminFormsRefresh.addEventListener('click', loadAdminForms);
    elements.adminFormsExport.addEventListener('click', exportAllAdminFormSubmissions);
    elements.adminFormFilter.addEventListener('change', () => loadAdminSubmissions(elements.adminFormFilter.value));
    elements.adminDashboardReload.addEventListener('click', () => {
      const changed = adminDashboardLoaded && elements.adminDashboardSource.value !== adminDashboardBaseline;
      if (changed && !window.confirm('Odrzucić niezapisane zmiany i wczytać aktywny dashboard ponownie?')) return;
      loadAdminDashboardEditor();
    });
    elements.adminDashboardRestore.addEventListener('click', restoreStaticDashboard);
    elements.adminDashboardPreviewButton.addEventListener('click', previewAdminDashboard);
    elements.adminDashboardSave.addEventListener('click', saveAdminDashboard);
    elements.adminContentRefresh.addEventListener('click', () => loadAdminContentStatus(true));
    elements.adminContentConfigAdd.addEventListener('click', addAdminContentRepository);
    elements.adminContentConfigSave.addEventListener('click', () => saveAdminContentRepositories(false));
    elements.adminContentConfigSaveDeploy.addEventListener('click', () => saveAdminContentRepositories(true));
    elements.adminContentConfigDeploy.addEventListener('click', deployAdminContentConfiguration);
    elements.adminContentConfigList.addEventListener('click', handleAdminContentConfigClick);
    elements.adminContentConfigList.addEventListener('input', markAdminContentDraftDirty);
    elements.adminContentConfigList.addEventListener('change', markAdminContentDraftDirty);
    window.addEventListener('beforeunload', (event) => {
      if (!adminContentConfigLoaded || adminContentConfigBusy || adminContentConfigPendingDeploy || !contentConfigHasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = '';
    });
    elements.adminProgressRefresh.addEventListener('click', () => loadAdminProgress(true));
    elements.adminProgressSaveSettings.addEventListener('click', saveAdminProgressSettings);
    elements.adminProgressMore.addEventListener('click', loadMoreAdminProgressUsers);
    elements.adminProgressSearch.addEventListener('input', () => {
      adminProgressVisibleCount = ADMIN_PROGRESS_PAGE_SIZE;
      renderAdminProgressUsers();
    });
    elements.adminProgressFilter.addEventListener('change', () => {
      adminProgressVisibleCount = ADMIN_PROGRESS_PAGE_SIZE;
      renderAdminProgressUsers();
    });
    elements.adminProgressSort.addEventListener('change', () => {
      adminProgressVisibleCount = ADMIN_PROGRESS_PAGE_SIZE;
      renderAdminProgressUsers();
    });
    elements.adminContentRepositorySelect.addEventListener('change', () => {
      adminContentRepositoryId = elements.adminContentRepositorySelect.value;
      adminContentLoaded = false;
      loadAdminContentStatus(false);
    });
    elements.adminContentCopyEnv.addEventListener('click', copyContentEnvironmentTemplate);
    elements.adminAiConfigForm.addEventListener('submit', saveAdminAiConfig);
    elements.adminAiNew.addEventListener('click', resetAdminAiEditor);
    elements.adminAiRefresh.addEventListener('click', () => loadAdminAi(true));
    elements.adminAiModelsRefresh.addEventListener('click', refreshAdminAiModels);
    elements.adminAiSecretSave.addEventListener('click', saveAdminAiSecret);
    elements.adminAiSecretRemove.addEventListener('click', removeAdminAiSecret);
    elements.adminAiProvider.addEventListener('change', () => {
      const current = elements.adminAiModel.value.trim();
      if (!current || current === 'gemini-2.5-flash' || current === 'gpt-4.1-mini') {
        elements.adminAiModel.value = elements.adminAiProvider.value === 'openai' ? 'gpt-4.1-mini' : 'gemini-2.5-flash';
      }
    });
    elements.adminAiModuleChat.addEventListener('change', () => setAdminAiModule('chat', elements.adminAiModuleChat.value));
    elements.adminAiModuleGrader.addEventListener('change', () => setAdminAiModule('aiGrader', elements.adminAiModuleGrader.value));
    elements.adminAiModuleForms.addEventListener('change', () => setAdminAiModule('aiForms', elements.adminAiModuleForms.value));
    elements.adminAiModuleOther.addEventListener('change', () => setAdminAiModule('other', elements.adminAiModuleOther.value));
    elements.adminAiAudit.addEventListener('toggle', loadAdminAiAudit);
    elements.adminAiUsageRefresh.addEventListener('click', () => loadAdminAiUsage(true));
    elements.adminAiUsagePeriod.addEventListener('change', () => {
      adminAiUsageLoaded = false;
      adminAiUserVisibleCount = ADMIN_AI_USERS_PAGE_SIZE;
      loadAdminAiUsage(true);
    });
    elements.adminAiLimitScope.addEventListener('change', () => {
      try { commitAdminAiLimitEditor(); } catch (error) { return setPanelStatus(elements.adminAiUsageStatus, error.message, 'error'); }
      populateAdminAiLimitScope();
    });
    elements.adminAiLimitScopeId.addEventListener('change', () => {
      try { commitAdminAiLimitEditor(); } catch (error) { return setPanelStatus(elements.adminAiUsageStatus, error.message, 'error'); }
      adminAiLimitSelection.id = elements.adminAiLimitScopeId.value;
      renderAdminAiLimitEditor();
    });
    elements.adminAiLimitModuleId.addEventListener('change', () => {
      try { commitAdminAiLimitEditor(); } catch (error) { return setPanelStatus(elements.adminAiUsageStatus, error.message, 'error'); }
      adminAiLimitSelection.id = elements.adminAiLimitModuleId.value.trim();
      renderAdminAiLimitEditor();
    });
    elements.adminAiLimitUserMode.addEventListener('change', () => {
      const id = adminAiLimitSelection.id;
      if (id) {
        const policy = adminAiUsageSettings.users[id] || (adminAiUsageSettings.users[id] = { mode: 'inherit', limits: emptyAdminAiLimitSet() });
        policy.mode = elements.adminAiLimitUserMode.value;
      }
      renderAdminAiLimitEditor();
    });
    elements.adminAiLimitGrid.addEventListener('input', (event) => {
      if (adminAiLimitSelection.scope !== 'user' || !event.target?.matches?.('input[data-ai-limit-metric]')) return;
      const id = adminAiLimitSelection.id;
      if (!id || elements.adminAiLimitUserMode.value !== 'inherit') return;
      const policy = adminAiUsageSettings.users[id] || (adminAiUsageSettings.users[id] = { mode: 'inherit', limits: emptyAdminAiLimitSet() });
      policy.mode = 'custom';
      elements.adminAiLimitUserMode.value = 'custom';
    });
    elements.adminAiUsageSave.addEventListener('click', saveAdminAiUsageSettings);
    elements.adminAiUsersSearch.addEventListener('input', () => {
      adminAiUserVisibleCount = ADMIN_AI_USERS_PAGE_SIZE;
      renderAdminAiUsageUsers();
    });
    elements.adminAiUsersMore.addEventListener('click', loadMoreAdminAiUsers);
    elements.adminAiUsageAudit.addEventListener('toggle', loadAdminAiUsageAudit);
    elements.adminPricesForm.addEventListener('submit', saveAdminPrices);
    elements.adminPricesReload.addEventListener('click', loadAdminPrices);
    elements.adminDashboardSource.addEventListener('input', () => {
      if (!adminDashboardLoaded) return;
      if (elements.adminDashboardSource.value === adminDashboardBaseline) {
        setPanelStatus(elements.adminDashboardStatus, 'Brak niezapisanych zmian.', 'info');
      } else {
        setPanelStatus(elements.adminDashboardStatus, 'Masz niezapisane zmiany.', 'info');
      }
    });

    elements.profileDialog.addEventListener('click', (event) => {
      if (event.target === elements.profileDialog) closeProfile();
    });
    elements.profileDialog.addEventListener('close', () => {
      clearProfilePasswordFields();
      elements.profilePasswordMessage.textContent = '';
      if (lastProfileTrigger) lastProfileTrigger.focus();
    });
    elements.adminDialog.addEventListener('click', (event) => {
      if (event.target === elements.adminDialog) closeAdminPanel();
    });
    elements.adminDialog.addEventListener('close', () => {
      if (lastAdminTrigger) lastAdminTrigger.focus();
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) && !isTyping) {
        cancelNavigationIntent();
      }
      if (event.key === '/' && !isTyping && !elements.profileDialog.open && !elements.adminDialog.open) {
        event.preventDefault();
        elements.search.focus();
      }
      if (event.key === 'Escape' && elements.body.classList.contains('menu-open')) closeMenu();
      if (event.key === 'Escape' && target === elements.search && elements.search.value) {
        elements.search.value = '';
        filterResources();
      }
    });
  }

  async function init() {
    initializeTheme();
    initializeSidebar();
    bindEvents();
    setupIdentity();
    const auth = window.ChemAuth;
    if (auth && auth.ready && typeof auth.ready.then === 'function') {
      try {
        const state = await auth.ready;
        if (state && state.available && (!state.authenticated || !state.session || !state.session.ok)) return;
      } catch (_) {
        // Ochrona brzegowa Netlify nadal zabezpiecza plik Markdown.
      }
    }
    const requestedAdminTab = new URL(window.location.href).searchParams.get('admin');
    const activeUser = auth && typeof auth.getUser === 'function' ? auth.getUser() : null;
    if (requestedAdminTab && isAdminUser(activeUser)) {
      updateProfileDisplay(activeUser, typeof auth.getProfile === 'function' ? auth.getProfile() : null);
      openAdminPanel({ currentTarget: elements.adminButton, adminTab: requestedAdminTab });
    }
    loadDashboard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
