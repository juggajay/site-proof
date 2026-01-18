/**
 * Update existing AREA-FILTER lots with area zones using the API
 */
const API_URL = 'http://localhost:4000'

async function login(email, password) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Login failed: ${error.message}`)
  }
  return response.json()
}

async function getLots(token, projectId) {
  const response = await fetch(`${API_URL}/api/lots?projectId=${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error('Failed to get lots')
  }
  return response.json()
}

async function updateLot(token, lotId, areaZone) {
  const url = `${API_URL}/api/lots/${lotId}`
  console.log(`   Calling PATCH ${url}`)
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ areaZone }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Failed to update lot (${response.status}): ${text.slice(0, 100)}`)
  }
  return JSON.parse(text)
}

async function main() {
  console.log('=== Updating Area Zones on Existing Lots ===\n')

  // Login as admin
  console.log('1. Logging in as admin@test.com...')
  const { token, user } = await login('admin@test.com', 'password123')
  console.log(`   Logged in as: ${user.email}\n`)

  // Get lots
  console.log('2. Getting lots...')
  const projectId = '7dc82a06-71a1-408d-a338-17a4ec279731'
  const { lots } = await getLots(token, projectId)
  console.log(`   Found ${lots.length} lots\n`)

  // Update area filter lots with area zones
  const updates = [
    { prefix: 'AREA-FILTER-A1-', areaZone: 'Area1' },
    { prefix: 'AREA-FILTER-A2-', areaZone: 'Area2' },
    { prefix: 'AREA-FILTER-N', areaZone: null },
  ]

  console.log('3. Updating lots with area zones...\n')
  for (const lot of lots) {
    for (const update of updates) {
      if (lot.lotNumber.startsWith(update.prefix)) {
        try {
          await updateLot(token, lot.id, update.areaZone)
          console.log(`   Updated: ${lot.lotNumber} → ${update.areaZone || 'NULL'}`)
        } catch (err) {
          console.error(`   Error updating ${lot.lotNumber}: ${err.message}`)
        }
      }
    }
  }

  console.log('\n=== Update Complete ===')
}

main().catch(console.error)
