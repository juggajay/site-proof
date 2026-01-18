/**
 * Clear token_invalidated_at for admin@test.com to allow login
 */
const API_URL = 'http://localhost:4000'

async function main() {
  // First, try a direct endpoint to clear the token invalidation
  console.log('Checking admin user token status...')

  // We need to use an admin endpoint or raw SQL to fix this
  // For now, let's check via the debug endpoint if one exists

  // Let's try logging in as a different user that might not have the invalidation set
  console.log('\nTrying to login as owner@test.com...')
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.com', password: 'password123' }),
  })

  if (loginRes.ok) {
    const loginData = await loginRes.json()
    console.log('Login successful!')
    console.log('Token:', loginData.token?.slice(0, 50) + '...')

    // Test the token
    const projectsRes = await fetch(`${API_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    })
    console.log('Projects request status:', projectsRes.status)
    if (projectsRes.ok) {
      const data = await projectsRes.json()
      console.log('Projects count:', data.projects?.length || 0)
    } else {
      const error = await projectsRes.json()
      console.log('Projects error:', error)
    }
  } else {
    const error = await loginRes.json()
    console.log('Login failed:', error)
  }

  // Also try other test users
  const testUsers = [
    'pm@test.com',
    'engineer@test.com',
    'qm@test.com',
    'test@test.com',
  ]

  for (const email of testUsers) {
    console.log(`\nTrying ${email}...`)
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    if (res.ok) {
      const data = await res.json()
      // Test token
      const testRes = await fetch(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${data.token}` },
      })
      if (testRes.ok) {
        console.log(`  ✓ ${email} - login and token work!`)
        console.log(`  Token: ${data.token}`)
        console.log(`  User ID: ${data.user.id}`)
        return data // Return first working user
      } else {
        console.log(`  ✗ ${email} - login ok but token fails`)
      }
    } else {
      console.log(`  ✗ ${email} - login failed`)
    }
  }
}

main().catch(console.error)
