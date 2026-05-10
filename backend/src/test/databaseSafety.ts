const SAFE_TEST_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'db',
  'postgres',
  'host.docker.internal',
]);

const SAFE_TEST_DATABASE_MARKERS = ['test', 'e2e', 'shadow', 'ci'];

type TestDatabaseEnv = {
  ALLOW_EXTERNAL_TEST_DATABASE?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
};

function includesSafeMarker(value: string): boolean {
  const normalized = value.toLowerCase();
  return SAFE_TEST_DATABASE_MARKERS.some((marker) => normalized.includes(marker));
}

export function assertSafeTestDatabaseUrl(
  env: TestDatabaseEnv = process.env as TestDatabaseEnv,
): void {
  if (env.NODE_ENV !== 'test' || env.ALLOW_EXTERNAL_TEST_DATABASE === 'true') {
    return;
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing to run tests: DATABASE_URL is not a valid URL');
  }

  if (parsedUrl.protocol !== 'postgresql:' && parsedUrl.protocol !== 'postgres:') {
    throw new Error('Refusing to run tests: DATABASE_URL must point to a PostgreSQL test database');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  const schemaName = parsedUrl.searchParams.get('schema') ?? '';

  if (!SAFE_TEST_DATABASE_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to run tests against non-local database host "${hostname}". ` +
        'Use a disposable local database or set ALLOW_EXTERNAL_TEST_DATABASE=true explicitly.',
    );
  }

  if (!includesSafeMarker(databaseName) && !includesSafeMarker(schemaName)) {
    throw new Error(
      `Refusing to run tests against database "${databaseName || '(missing)'}". ` +
        'The database name or schema must include test, e2e, shadow, or ci.',
    );
  }
}
