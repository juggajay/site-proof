export function resolveDatabaseTarget(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  }

  const databaseName = parsed.pathname.replace(/^\/+/, '').split('/')[0];
  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  return `${parsed.hostname}/${databaseName}`;
}

export function requireDatabaseTargetConfirmation(
  envName: string,
  actionDescription: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const target = resolveDatabaseTarget(env);
  const confirmation = env[envName]?.trim();

  if (confirmation !== target) {
    throw new Error(
      `Refusing ${actionDescription}. Check the database host/name, then set ${envName}=${target} to confirm.`,
    );
  }
}
