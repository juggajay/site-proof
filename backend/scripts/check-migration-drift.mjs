import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { URL } from 'node:url';

const databaseUrl = process.env.DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

function databaseIdentity(connectionString) {
  if (!connectionString) {
    return null;
  }

  try {
    const parsed = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      return null;
    }

    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return null;
  }
}

if (!shadowDatabaseUrl) {
  console.error('SHADOW_DATABASE_URL is required to check Prisma migration drift.');
  console.error('Use a disposable PostgreSQL database because Prisma may reset it during diffing.');
  console.error(
    'Example: postgresql://user:password@localhost:5432/siteproof_shadow?schema=public',
  );
  process.exit(1);
}

const mainDatabaseIdentity = databaseIdentity(databaseUrl);
const shadowDatabaseIdentity = databaseIdentity(shadowDatabaseUrl);

if (
  mainDatabaseIdentity &&
  shadowDatabaseIdentity &&
  mainDatabaseIdentity === shadowDatabaseIdentity
) {
  console.error(
    'SHADOW_DATABASE_URL must not point to the same PostgreSQL database as DATABASE_URL.',
  );
  console.error('Create a separate disposable database for Prisma shadow diffing.');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--shadow-database-url',
    shadowDatabaseUrl,
    '--exit-code',
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
