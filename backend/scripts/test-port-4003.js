/**
 * Test token validation on debug server (port 4003)
 */
const API_URL = 'http://localhost:4004'

async function main() {
  console.log('Testing on port 4003 (debug server with logging)...\n')

  // Login
  console.log('1. Logging in...')
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
  })

  const loginData = await loginRes.json()
  console.log('Login status:', loginRes.status)

  if (!loginData.token) {
    console.log('No token!')
    return
  }

  console.log('Got token:', loginData.token.slice(0, 50) + '...')

  // Test token
  console.log('\n2. Testing token...')
  const projectsRes = await fetch(`${API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  })

  console.log('Projects status:', projectsRes.status)
  const projectsData = await projectsRes.json()
  console.log('Projects response:', JSON.stringify(projectsData).slice(0, 200))
}

main().catch(console.error)
