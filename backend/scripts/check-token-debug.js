/**
 * Debug token validation
 */
const API_URL = 'http://localhost:4000'

async function main() {
  // First, login to get a fresh token
  console.log('1. Logging in...')
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
  })

  const loginData = await loginRes.json()
  console.log('Login response status:', loginRes.status)
  console.log('Login data:', JSON.stringify(loginData, null, 2))

  if (!loginData.token) {
    console.log('No token returned!')
    return
  }

  // Decode JWT to check iat
  const [, payload] = loginData.token.split('.')
  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString())
  console.log('\nDecoded JWT payload:')
  console.log('  iat:', decoded.iat, '→', new Date(decoded.iat * 1000).toISOString())
  console.log('  exp:', decoded.exp, '→', new Date(decoded.exp * 1000).toISOString())
  console.log('  userId:', decoded.userId)

  // Now try to use the token
  console.log('\n2. Testing token with projects endpoint...')
  const projectsRes = await fetch(`${API_URL}/api/projects`, {
    headers: {
      Authorization: `Bearer ${loginData.token}`,
    },
  })

  console.log('Projects response status:', projectsRes.status)
  const projectsData = await projectsRes.json()
  console.log('Projects data:', JSON.stringify(projectsData, null, 2).slice(0, 500))

  // Also test the /api/auth/me endpoint if it exists
  console.log('\n3. Testing /api/auth/me endpoint...')
  const meRes = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${loginData.token}`,
    },
  })
  console.log('Me response status:', meRes.status)
  const meData = await meRes.json()
  console.log('Me data:', JSON.stringify(meData, null, 2))
}

main().catch(console.error)
