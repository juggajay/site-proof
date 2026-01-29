// Test subcontractor data isolation
// Verifies that subcontractors can only see their assigned lots
// Run with: node scripts/test-subcontractor-isolation.js

const API_URL = 'http://localhost:3005'
const PROJECT_ID = '28490410-acc1-4d6d-8638-6bfb3f339d92' // From setup script output

async function main() {
  console.log('========================================')
  console.log('Subcontractor Data Isolation Test')
  console.log('========================================')
  console.log('')

  // Test credentials from setup script
  const subA = { email: 'subcontractorA@test.com', password: 'password123' }
  const subB = { email: 'subcontractorB@test.com', password: 'password123' }

  // Step 1: Login as Subcontractor A
  console.log('Step 1: Login as Subcontractor A')
  console.log('-'.repeat(50))

  const loginA = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subA)
  })

  if (!loginA.ok) {
    console.log('❌ FAIL: Login failed for Subcontractor A')
    const error = await loginA.text()
    console.log('   Error:', error)
    process.exit(1)
  }

  const { token: tokenA, user: userA } = await loginA.json()
  console.log('✅ Login successful')
  console.log('   Email:', userA.email)
  console.log('   Role in company:', userA.role)
  console.log('')

  // Step 2: Get lots visible to Subcontractor A
  console.log('Step 2: Get lots visible to Subcontractor A')
  console.log('-'.repeat(50))

  const lotsA = await fetch(`${API_URL}/api/lots?projectId=${PROJECT_ID}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  })

  if (!lotsA.ok) {
    console.log('❌ FAIL: Failed to fetch lots for Subcontractor A')
    console.log('   Status:', lotsA.status)
    const error = await lotsA.text()
    console.log('   Error:', error)
    process.exit(1)
  }

  const { lots: userALots } = await lotsA.json()
  console.log('Lots visible to Subcontractor A:', userALots.length)
  userALots.forEach(lot => console.log(`   - ${lot.lotNumber}: ${lot.description}`))
  console.log('')

  // Verify Subcontractor A sees only their lots
  const subALotNumbers = userALots.map(l => l.lotNumber).sort()
  const expectedSubALots = ['SUB-A-LOT-001', 'SUB-A-LOT-002'].sort()

  if (JSON.stringify(subALotNumbers) === JSON.stringify(expectedSubALots)) {
    console.log('✅ PASS: Subcontractor A sees exactly their assigned lots')
  } else {
    console.log('❌ FAIL: Subcontractor A lot visibility mismatch')
    console.log('   Expected:', expectedSubALots)
    console.log('   Got:', subALotNumbers)
    process.exit(1)
  }
  console.log('')

  // Step 3: Login as Subcontractor B
  console.log('Step 3: Login as Subcontractor B')
  console.log('-'.repeat(50))

  const loginB = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subB)
  })

  if (!loginB.ok) {
    console.log('❌ FAIL: Login failed for Subcontractor B')
    process.exit(1)
  }

  const { token: tokenB, user: userB } = await loginB.json()
  console.log('✅ Login successful')
  console.log('   Email:', userB.email)
  console.log('')

  // Step 4: Get lots visible to Subcontractor B
  console.log('Step 4: Get lots visible to Subcontractor B')
  console.log('-'.repeat(50))

  const lotsB = await fetch(`${API_URL}/api/lots?projectId=${PROJECT_ID}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  })

  if (!lotsB.ok) {
    console.log('❌ FAIL: Failed to fetch lots for Subcontractor B')
    process.exit(1)
  }

  const { lots: userBLots } = await lotsB.json()
  console.log('Lots visible to Subcontractor B:', userBLots.length)
  userBLots.forEach(lot => console.log(`   - ${lot.lotNumber}: ${lot.description}`))
  console.log('')

  // Verify Subcontractor B sees only their lots
  const subBLotNumbers = userBLots.map(l => l.lotNumber).sort()
  const expectedSubBLots = ['SUB-B-LOT-001'].sort()

  if (JSON.stringify(subBLotNumbers) === JSON.stringify(expectedSubBLots)) {
    console.log('✅ PASS: Subcontractor B sees exactly their assigned lots')
  } else {
    console.log('❌ FAIL: Subcontractor B lot visibility mismatch')
    console.log('   Expected:', expectedSubBLots)
    console.log('   Got:', subBLotNumbers)
    process.exit(1)
  }
  console.log('')

  // Step 5: Verify cross-isolation (A cannot see B's lots, B cannot see A's lots)
  console.log('Step 5: Cross-isolation verification')
  console.log('-'.repeat(50))

  // Check that A cannot see B's lot (SUB-B-LOT-001)
  const aSeesB = userALots.some(l => l.lotNumber.startsWith('SUB-B'))
  if (!aSeesB) {
    console.log('✅ PASS: Subcontractor A cannot see Subcontractor B lots')
  } else {
    console.log('❌ FAIL: Subcontractor A can see Subcontractor B lots')
    process.exit(1)
  }

  // Check that B cannot see A's lots (SUB-A-*)
  const bSeesA = userBLots.some(l => l.lotNumber.startsWith('SUB-A'))
  if (!bSeesA) {
    console.log('✅ PASS: Subcontractor B cannot see Subcontractor A lots')
  } else {
    console.log('❌ FAIL: Subcontractor B can see Subcontractor A lots')
    process.exit(1)
  }

  // Check that neither can see UNASSIGNED-LOT-001
  const aSeesUnassigned = userALots.some(l => l.lotNumber === 'UNASSIGNED-LOT-001')
  const bSeesUnassigned = userBLots.some(l => l.lotNumber === 'UNASSIGNED-LOT-001')

  if (!aSeesUnassigned && !bSeesUnassigned) {
    console.log('✅ PASS: Neither subcontractor can see unassigned lots')
  } else {
    console.log('❌ FAIL: Subcontractors can see unassigned lots')
    process.exit(1)
  }
  console.log('')

  console.log('========================================')
  console.log('SUBCONTRACTOR ISOLATION TEST COMPLETE')
  console.log('========================================')
  console.log('')
  console.log('Summary:')
  console.log('  - Subcontractor A: Sees 2 lots (SUB-A-LOT-001, SUB-A-LOT-002)')
  console.log('  - Subcontractor B: Sees 1 lot (SUB-B-LOT-001)')
  console.log('  - Cross-isolation: VERIFIED')
  console.log('  - Unassigned lot hidden: VERIFIED')
  console.log('')
  console.log('Feature 20: Subcontractor data isolation - VERIFIED')
}

main().catch(console.error)
