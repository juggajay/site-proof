/**
 * Check user's token invalidation status
 */
const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, '..', 'dev.db'))

const user = db.prepare('SELECT id, email, token_invalidated_at FROM users WHERE email = ?').get('admin@test.com')
console.log('User:', JSON.stringify(user, null, 2))

// Check the iat of a token issued now
const now = Date.now()
console.log('\nCurrent time (ms):', now)
console.log('Current time (ISO):', new Date(now).toISOString())

if (user?.token_invalidated_at) {
  const invalidatedAt = new Date(user.token_invalidated_at)
  console.log('\nToken invalidated at:', invalidatedAt.toISOString())
  console.log('Token invalidated at (ms):', invalidatedAt.getTime())

  // A JWT issued now would have iat = Math.floor(now / 1000)
  const iatNow = Math.floor(now / 1000)
  const tokenIssuedAtDate = new Date(iatNow * 1000)
  console.log('\nToken iat (seconds):', iatNow)
  console.log('Token issued at date:', tokenIssuedAtDate.toISOString())
  console.log('Would token be valid?', tokenIssuedAtDate >= invalidatedAt ? 'YES' : 'NO')
}

db.close()
