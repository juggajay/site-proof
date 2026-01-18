/**
 * Setup test data for area/zone filter testing (Feature #147)
 * Creates lots in different areas: Area1, Area2, and some with no area
 */

const API_URL = 'http://localhost:4004'

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

async function getFirstProject(token) {
  const response = await fetch(`${API_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get projects: ${JSON.stringify(error)}`)
  }
  const data = await response.json()
  if (!data.projects || data.projects.length === 0) {
    throw new Error('No projects found')
  }
  return data.projects[0]
}

async function createLot(token, projectId, lotNumber, description, areaZone = null) {
  const response = await fetch(`${API_URL}/api/lots`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      lotNumber,
      description,
      status: 'not_started',
      activityType: 'earthworks',
      areaZone,
    }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create lot: ${error.message}`)
  }
  return response.json()
}

async function main() {
  console.log('=== Setting up Area/Zone Filter Test Data ===\n')

  // Login as admin
  console.log('1. Logging in as admin@test.com...')
  const { token, user } = await login('admin@test.com', 'password123')
  console.log(`   Logged in as: ${user.email} (${user.role})\n`)

  // Get first project
  console.log('2. Getting first project...')
  const project = await getFirstProject(token)
  console.log(`   Project: ${project.name} (${project.id})\n`)

  // Create lots with different areas
  console.log('3. Creating test lots with different areas...\n')
  const lotsToCreate = [
    { lotNumber: 'AREA-FILTER-A1-1', description: 'Lot in Area1 (1)', areaZone: 'Area1' },
    { lotNumber: 'AREA-FILTER-A1-2', description: 'Lot in Area1 (2)', areaZone: 'Area1' },
    { lotNumber: 'AREA-FILTER-A2-1', description: 'Lot in Area2 (1)', areaZone: 'Area2' },
    { lotNumber: 'AREA-FILTER-A2-2', description: 'Lot in Area2 (2)', areaZone: 'Area2' },
    { lotNumber: 'AREA-FILTER-N1', description: 'Lot with no area (1)', areaZone: null },
    { lotNumber: 'AREA-FILTER-N2', description: 'Lot with no area (2)', areaZone: null },
  ]

  for (const lot of lotsToCreate) {
    try {
      const created = await createLot(token, project.id, lot.lotNumber, lot.description, lot.areaZone)
      console.log(`   Created: ${created.lotNumber} → ${lot.areaZone || 'No Area'}`)
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`   Skipped: ${lot.lotNumber} (already exists)`)
      } else {
        console.error(`   Error: ${lot.lotNumber}: ${err.message}`)
      }
    }
  }

  console.log('\n=== Test Data Setup Complete ===')
  console.log(`\nProject: ${project.name}`)
  console.log('\nTo test:')
  console.log('1. Navigate to the project\'s Lot Register')
  console.log('2. You should see the Area/Zone filter dropdown')
  console.log('3. Filter by Area1 - should show 2 lots (AREA-FILTER-A1-1, AREA-FILTER-A1-2)')
  console.log('4. Filter by Area2 - should show 2 lots (AREA-FILTER-A2-1, AREA-FILTER-A2-2)')
  console.log('5. Filter by Unassigned - should show lots without an area')
}

main().catch(console.error)
