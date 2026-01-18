/**
 * Setup test data for subcontractor filter testing (Feature #146)
 * Creates:
 * - 2 subcontractors: SubcontractorA and SubcontractorB
 * - 6 lots: 2 assigned to SubcontractorA, 2 to SubcontractorB, 2 unassigned
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
  console.log(`   API response: ${JSON.stringify(data).slice(0, 200)}...`)
  if (!data.projects || data.projects.length === 0) {
    throw new Error('No projects found')
  }
  return data.projects[0]
}

async function createSubcontractor(token, name, projectId) {
  const response = await fetch(`${API_URL}/api/subcontractors/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyName: name,
      abn: `12345678${Date.now().toString().slice(-3)}`,
      primaryContactName: `${name} Contact`,
      primaryContactEmail: `${name.toLowerCase().replace(/\s/g, '')}@test.com`,
      primaryContactPhone: '0400000000',
      projectId: projectId,
    }),
  })
  if (!response.ok) {
    const text = await response.text()
    try {
      const error = JSON.parse(text)
      throw new Error(`Failed to create subcontractor: ${error.message}`)
    } catch {
      throw new Error(`Failed to create subcontractor: ${response.status} ${text.slice(0, 100)}`)
    }
  }
  const data = await response.json()
  return data.subcontractor
}

async function getSubcontractors(token, projectId) {
  const response = await fetch(`${API_URL}/api/subcontractors/for-project/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error('Failed to get subcontractors')
  }
  return response.json()
}

async function createLot(token, projectId, lotNumber, description, subcontractorId = null) {
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
      assignedSubcontractorId: subcontractorId,
    }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create lot: ${error.message}`)
  }
  return response.json()
}

async function main() {
  console.log('=== Setting up Subcontractor Filter Test Data ===\n')

  // Login as admin
  console.log('1. Logging in as admin@test.com...')
  const { token, user } = await login('admin@test.com', 'password123')
  console.log(`   Logged in as: ${user.email} (${user.role})\n`)

  // Get first project
  console.log('2. Getting first project...')
  const project = await getFirstProject(token)
  console.log(`   Project: ${project.name} (${project.id})\n`)

  // Check existing subcontractors
  console.log('3. Checking existing subcontractors...')
  let subData = await getSubcontractors(token, project.id)
  let subcontractors = subData.subcontractors || []
  console.log(`   Found ${subcontractors.length} existing subcontractor(s)\n`)

  // Find or create SubcontractorA and SubcontractorB
  let subA = subcontractors.find(s => s.companyName === 'SubcontractorA')
  let subB = subcontractors.find(s => s.companyName === 'SubcontractorB')

  if (!subA) {
    console.log('4. Creating SubcontractorA...')
    subA = await createSubcontractor(token, 'SubcontractorA', project.id)
    console.log(`   Created: ${subA.companyName} (${subA.id})\n`)
  } else {
    console.log(`4. SubcontractorA already exists: ${subA.id}\n`)
  }

  if (!subB) {
    console.log('5. Creating SubcontractorB...')
    subB = await createSubcontractor(token, 'SubcontractorB', project.id)
    console.log(`   Created: ${subB.companyName} (${subB.id})\n`)
  } else {
    console.log(`5. SubcontractorB already exists: ${subB.id}\n`)
  }

  // Create lots
  console.log('6. Creating test lots...\n')
  const lotsToCreate = [
    { lotNumber: 'SUB-FILTER-A1', description: 'Lot assigned to SubcontractorA (1)', subId: subA.id },
    { lotNumber: 'SUB-FILTER-A2', description: 'Lot assigned to SubcontractorA (2)', subId: subA.id },
    { lotNumber: 'SUB-FILTER-B1', description: 'Lot assigned to SubcontractorB (1)', subId: subB.id },
    { lotNumber: 'SUB-FILTER-B2', description: 'Lot assigned to SubcontractorB (2)', subId: subB.id },
    { lotNumber: 'SUB-FILTER-U1', description: 'Unassigned Lot (1)', subId: null },
    { lotNumber: 'SUB-FILTER-U2', description: 'Unassigned Lot (2)', subId: null },
  ]

  for (const lot of lotsToCreate) {
    try {
      const created = await createLot(token, project.id, lot.lotNumber, lot.description, lot.subId)
      const subName = lot.subId ? (lot.subId === subA.id ? 'SubcontractorA' : 'SubcontractorB') : 'Unassigned'
      console.log(`   Created: ${created.lotNumber} → ${subName}`)
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
  console.log(`SubcontractorA ID: ${subA.id}`)
  console.log(`SubcontractorB ID: ${subB.id}`)
  console.log('\nTo test:')
  console.log('1. Navigate to the project\'s Lot Register')
  console.log('2. You should see the Subcontractor filter dropdown')
  console.log('3. Filter by SubcontractorA - should show 2 lots (SUB-FILTER-A1, SUB-FILTER-A2)')
  console.log('4. Filter by SubcontractorB - should show 2 lots (SUB-FILTER-B1, SUB-FILTER-B2)')
  console.log('5. Filter by Unassigned - should show 2 lots (SUB-FILTER-U1, SUB-FILTER-U2)')
}

main().catch(console.error)
