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
 *   npm run migrate:reset    - Reset database (development only)
 *
 * For production deployments, use:
 *   npx prisma migrate deploy
 *
 * For development, Prisma db push is used for rapid iteration.
 * Migrations are generated before production release.
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

async function checkMigrationStatus() {
  console.log('🔍 Checking database migration status...\n')

  try {
    // Check if we can connect to the database
    await prisma.$connect()
    console.log('✅ Database connection successful')

    // Get schema version info (SQLite-specific check)
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'
    `

    console.log(`📊 Found ${tables.length} application tables:`)
    tables.forEach(t => console.log(`   - ${t.name}`))

    // Check _prisma_migrations table if it exists
    try {
      const migrations = await prisma.$queryRaw<Array<{
        id: string
        checksum: string
        finished_at: string
        migration_name: string
        started_at: string
        applied_steps_count: number
      }>>`
        SELECT * FROM _prisma_migrations ORDER BY started_at DESC
      `

      if (migrations.length > 0) {
        console.log(`\n📝 Applied migrations (${migrations.length} total):`)
        migrations.slice(0, 10).forEach(m => {
          console.log(`   - ${m.migration_name} (applied: ${m.finished_at})`)
        })
        if (migrations.length > 10) {
          console.log(`   ... and ${migrations.length - 10} more`)
        }
      }
    } catch (e) {
      console.log('\n⚠️  No migration history table found (using db push mode)')
      console.log('   Run "npx prisma migrate dev" to start using migrations')
    }

    // Validate schema consistency
    console.log('\n🔄 Validating schema consistency...')
    try {
      execSync('npx prisma validate', { stdio: 'inherit', cwd: process.cwd() })
      console.log('✅ Schema is valid')
    } catch (e) {
      console.error('❌ Schema validation failed')
      process.exit(1)
    }

    console.log('\n✨ Database is healthy!')
  } catch (error) {
    console.error('❌ Database check failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

async function deployMigrations() {
  console.log('🚀 Deploying database migrations...\n')

  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() })
    console.log('\n✅ Migrations deployed successfully!')
  } catch (error) {
    console.error('❌ Migration deployment failed')
    process.exit(1)
  }
}

async function showMigrationHistory() {
  console.log('📜 Migration History\n')

  try {
    await prisma.$connect()

    const migrations = await prisma.$queryRaw<Array<{
      id: string
      migration_name: string
      started_at: string
      finished_at: string
      applied_steps_count: number
    }>>`
      SELECT * FROM _prisma_migrations ORDER BY started_at ASC
    `

    if (migrations.length === 0) {
      console.log('No migrations found. Database may be using db push mode.')
      return
    }

    console.log('┌───────────────────────────────────────────────────────────────┐')
    console.log('│ Migration Name                                │ Applied At    │')
    console.log('├───────────────────────────────────────────────┬───────────────┤')

    migrations.forEach((m, i) => {
      const name = m.migration_name.substring(0, 45).padEnd(45)
      const date = new Date(m.finished_at).toLocaleDateString()
      console.log(`│ ${name} │ ${date.padEnd(13)} │`)
    })

    console.log('└───────────────────────────────────────────────┴───────────────┘')
    console.log(`\nTotal: ${migrations.length} migrations applied`)
  } catch (e) {
    console.log('No migration history available (using db push mode)')
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const command = process.argv[2] || 'status'

switch (command) {
  case 'status':
    checkMigrationStatus()
    break
  case 'deploy':
    deployMigrations()
    break
  case 'history':
    showMigrationHistory()
    break
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
  npx prisma db push        - Quick schema sync (no migration files)
  npx prisma migrate dev    - Create new migration

For production:
  npx prisma migrate deploy - Apply pending migrations
`)
}
