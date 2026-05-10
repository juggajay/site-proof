#!/usr/bin/env ts-node
/**
 * Feature #759: Database Migration Management
 *
 * This script provides database migration versioning capabilities:
 * - Check migration status
 * - Apply pending migrations
 * - Show migration history
 * - Generate new migrations (development only)
 *
 * Usage:
 *   npm run migrate:status   - Check migration status
 *   npm run migrate:deploy   - Apply pending migrations (production-safe)
 *   npm run migrate:history  - Show migration history
 *
 * For production deployments, use:
 *   npx prisma migrate deploy
 *
 * Development and production databases should both use tracked Prisma migrations.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function checkMigrationStatus() {
  console.log('🔍 Checking database migration status...\n');
  let statusFailed = false;

  try {
    // Check if we can connect to the database
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Get application tables from the PostgreSQL public schema.
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name
    `;

    console.log(`📊 Found ${tables.length} application tables:`);
    tables.forEach((t) => console.log(`   - ${t.table_name}`));

    // Check _prisma_migrations table if it exists
    try {
      const migrationTable = await prisma.$queryRaw<Array<{ exists: string | null }>>`
        SELECT to_regclass('public._prisma_migrations')::text AS exists
      `;

      if (!migrationTable[0]?.exists) {
        console.log('\n⚠️  No migration history table found');
        console.log('   Existing databases must be baselined before using migrate deploy');
        console.log('   See MIGRATION.md for the baseline procedure');
        statusFailed = true;
      } else {
        const migrations = await prisma.$queryRaw<
          Array<{
            id: string;
            checksum: string;
            finished_at: Date | null;
            migration_name: string;
            started_at: Date;
            applied_steps_count: number;
          }>
        >`
          SELECT * FROM _prisma_migrations ORDER BY started_at DESC
        `;

        if (migrations.length > 0) {
          console.log(`\n📝 Applied migrations (${migrations.length} total):`);
          migrations.slice(0, 10).forEach((m) => {
            console.log(`   - ${m.migration_name} (applied: ${m.finished_at})`);
          });
          if (migrations.length > 10) {
            console.log(`   ... and ${migrations.length - 10} more`);
          }
        } else {
          console.log('\n⚠️  Migration history table is empty');
          console.log('   Run migrations for a new database or baseline an existing database');
          console.log('   See MIGRATION.md for the baseline procedure');
          statusFailed = true;
        }
      }
    } catch {
      console.log('\n⚠️  Could not read migration history');
      console.log('   Verify DATABASE_URL and database permissions');
      statusFailed = true;
    }

    console.log('\n🔄 Checking live database schema drift...');
    try {
      execSync(
        'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code',
        { stdio: 'inherit', cwd: process.cwd() },
      );
      console.log('✅ Live database schema matches schema.prisma');
    } catch {
      console.log('\n⚠️  Live database schema differs from schema.prisma');
      console.log('   Resolve the drift before baselining or deploying migrations');
      console.log('   See MIGRATION.md for the baseline procedure');
      statusFailed = true;
    }

    // Validate schema consistency
    console.log('\n🔄 Validating schema consistency...');
    try {
      execSync('npx prisma validate', { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Schema is valid');
    } catch {
      console.error('❌ Schema validation failed');
      process.exit(1);
    }

    if (statusFailed) {
      console.error('\n❌ Database migration status requires attention');
      process.exit(1);
    }

    console.log('\n✨ Database is healthy!');
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function deployMigrations() {
  console.log('🚀 Deploying database migrations...\n');

  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
    console.log('\n✅ Migrations deployed successfully!');
  } catch {
    console.error('❌ Migration deployment failed');
    process.exit(1);
  }
}

async function showMigrationHistory() {
  console.log('📜 Migration History\n');

  try {
    await prisma.$connect();

    const migrationTable = await prisma.$queryRaw<Array<{ exists: string | null }>>`
      SELECT to_regclass('public._prisma_migrations')::text AS exists
    `;

    if (!migrationTable[0]?.exists) {
      console.log('No migration history table found.');
      console.log('Existing databases must be baselined before using migrate deploy.');
      return;
    }

    const migrations = await prisma.$queryRaw<
      Array<{
        id: string;
        migration_name: string;
        started_at: Date;
        finished_at: Date | null;
        applied_steps_count: number;
      }>
    >`
      SELECT * FROM _prisma_migrations ORDER BY started_at ASC
    `;

    if (migrations.length === 0) {
      console.log('No migrations found. Migration history is empty.');
      return;
    }

    console.log('┌───────────────────────────────────────────────────────────────┐');
    console.log('│ Migration Name                                │ Applied At    │');
    console.log('├───────────────────────────────────────────────┬───────────────┤');

    migrations.forEach((m) => {
      const name = m.migration_name.substring(0, 45).padEnd(45);
      const date = m.finished_at ? new Date(m.finished_at).toLocaleDateString() : 'pending';
      console.log(`│ ${name} │ ${date.padEnd(13)} │`);
    });

    console.log('└───────────────────────────────────────────────┴───────────────┘');
    console.log(`\nTotal: ${migrations.length} migrations applied`);
  } catch {
    console.log('No migration history available');
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const command = process.argv[2] || 'status';

switch (command) {
  case 'status':
    checkMigrationStatus();
    break;
  case 'deploy':
    deployMigrations();
    break;
  case 'history':
    showMigrationHistory();
    break;
  default:
    console.log(`
Database Migration Management

Commands:
  status   - Check migration status and database health
  deploy   - Apply pending migrations (production-safe)
  history  - Show migration history

Examples:
  npx ts-node scripts/migrate.ts status
  npx ts-node scripts/migrate.ts deploy
  npx ts-node scripts/migrate.ts history

For development:
  npx prisma migrate dev    - Create and apply a tracked migration

For production:
  npx prisma migrate deploy - Apply pending migrations
`);
}
