#!/usr/bin/env npx tsx
// Password Migration Script
// Identifies users with legacy SHA256 hashes that need migration to bcrypt
//
// Legacy SHA256 hashes are 64-character hex strings not starting with $2
// bcrypt hashes start with $2a$, $2b$, or $2y$

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface UserWithHash {
  id: string
  email: string
  password_hash: string | null
}

async function main() {
  console.log('=== Password Migration Analysis ===\n')

  // Query all users with password hashes
  const users = await prisma.$queryRaw<UserWithHash[]>`
    SELECT id, email, password_hash
    FROM users
    WHERE password_hash IS NOT NULL
  `

  console.log(`Total users with passwords: ${users.length}`)

  // Identify legacy SHA256 hashes
  // SHA256 produces 64-character hex string
  // bcrypt hashes start with $2 (e.g., $2a$, $2b$, $2y$)
  const legacyUsers = users.filter(user => {
    if (!user.password_hash) return false

    // Check if it's a 64-char hex string that doesn't start with $2
    const isLegacySha256 =
      user.password_hash.length === 64 &&
      /^[a-f0-9]{64}$/i.test(user.password_hash) &&
      !user.password_hash.startsWith('$2')

    return isLegacySha256
  })

  const bcryptUsers = users.filter(user => {
    if (!user.password_hash) return false
    return user.password_hash.startsWith('$2')
  })

  console.log(`\nHash analysis:`)
  console.log(`  - bcrypt hashes (secure): ${bcryptUsers.length}`)
  console.log(`  - Legacy SHA256 hashes (need migration): ${legacyUsers.length}`)

  if (legacyUsers.length > 0) {
    console.log('\n=== Users with Legacy Hashes ===')
    for (const user of legacyUsers) {
      console.log(`  - ${user.email} (ID: ${user.id})`)
    }

    console.log('\n=== Migration Options ===')
    console.log('1. Force password reset for these users (recommended)')
    console.log('   - Set password_reset_required = true')
    console.log('   - Users will be prompted to reset on next login')
    console.log('')
    console.log('2. Transparent rehash on login (automatic)')
    console.log('   - Enable FORCE_PASSWORD_REHASH=true in environment')
    console.log('   - Passwords are upgraded to bcrypt when user logs in')
    console.log('')

    // Uncomment below to force password reset for legacy users
    /*
    console.log('\nApplying forced password reset...')
    for (const user of legacyUsers) {
      await prisma.$executeRaw`
        UPDATE users
        SET password_reset_required = 1
        WHERE id = ${user.id}
      `
      console.log(`  - Reset required for: ${user.email}`)
    }
    console.log('\nDone! Users will be prompted to reset their passwords.')
    */
  } else {
    console.log('\nAll passwords are using secure bcrypt hashes. No migration needed.')
  }

  // Also check for null or empty password hashes (OAuth-only users)
  const oauthOnlyUsers = await prisma.$queryRaw<UserWithHash[]>`
    SELECT id, email, password_hash
    FROM users
    WHERE password_hash IS NULL OR password_hash = ''
  `

  if (oauthOnlyUsers.length > 0) {
    console.log(`\nOAuth-only users (no password): ${oauthOnlyUsers.length}`)
  }
}

main()
  .catch(error => {
    console.error('Migration analysis failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
