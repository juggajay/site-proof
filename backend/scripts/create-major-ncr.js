// Create a major NCR for testing QM approval workflow
// Run with: node scripts/create-major-ncr.js

// Use native fetch (Node 18+)

const API_URL = 'http://localhost:3005'

async function main() {
  // First login as the site engineer
  console.log('Logging in as engineer@test.com...')
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'engineer@test.com',
      password: 'password123'
    })
  })

  if (!loginResponse.ok) {
    const error = await loginResponse.json()
    console.error('Login failed:', error)
    process.exit(1)
  }

  const { token } = await loginResponse.json()
  console.log('Login successful!')

  // Get the project ID
  const projectId = 'e9761f0a-d1f7-43b5-bfe2-6d4a648fcff1'

  // Create a major NCR
  console.log('Creating major NCR...')
  const ncrResponse = await fetch(`${API_URL}/api/ncrs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      projectId,
      description: 'TEST MAJOR NCR - Concrete strength test failed specification requirements. Test cube results at 28 days showed 25MPa vs required 32MPa minimum.',
      category: 'materials',
      severity: 'major',
      specificationReference: 'AS3600-2018 Section 4.3'
    })
  })

  if (!ncrResponse.ok) {
    const error = await ncrResponse.json()
    console.error('Create NCR failed:', error)
    process.exit(1)
  }

  const { ncr } = await ncrResponse.json()
  console.log('')
  console.log('========================================')
  console.log('MAJOR NCR Created Successfully!')
  console.log('========================================')
  console.log('NCR ID:', ncr.id)
  console.log('NCR Number:', ncr.ncrNumber)
  console.log('Severity:', ncr.severity)
  console.log('QM Approval Required:', ncr.qmApprovalRequired ? 'YES' : 'NO')
  console.log('Status:', ncr.status)
  console.log('')

  // Now submit a response (move to investigating)
  console.log('Submitting NCR response...')
  const respondResponse = await fetch(`${API_URL}/api/ncrs/${ncr.id}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      rootCauseCategory: 'process',
      rootCauseDescription: 'Incorrect water-cement ratio used in batch plant',
      proposedCorrectiveAction: 'Remove and replace affected concrete. Recalibrate batch plant. Implement daily quality checks.'
    })
  })

  if (!respondResponse.ok) {
    const error = await respondResponse.json()
    console.error('Response failed:', error)
    process.exit(1)
  }

  console.log('Response submitted - Status: investigating')

  // Submit rectification
  console.log('Submitting rectification...')
  const rectifyResponse = await fetch(`${API_URL}/api/ncrs/${ncr.id}/rectify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      rectificationNotes: 'Affected concrete removed and replaced. New test cubes taken - results pending.'
    })
  })

  if (!rectifyResponse.ok) {
    const error = await rectifyResponse.json()
    console.error('Rectify failed:', error)
    process.exit(1)
  }

  console.log('Rectification submitted - Status: verification')

  // Try to close (should fail - requires QM approval)
  console.log('')
  console.log('Attempting to close NCR as site engineer (should fail)...')
  const closeResponse = await fetch(`${API_URL}/api/ncrs/${ncr.id}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      verificationNotes: 'Test attempt'
    })
  })

  const closeResult = await closeResponse.json()

  if (!closeResponse.ok) {
    console.log('EXPECTED FAILURE:', closeResult.message)
    console.log('Requires QM Approval:', closeResult.requiresQmApproval ? 'YES' : 'NO')
  } else {
    console.log('UNEXPECTED: NCR closed without QM approval!')
  }

  console.log('')
  console.log('========================================')
  console.log('Test Summary:')
  console.log('========================================')
  console.log('1. Major NCR created with QM approval requirement')
  console.log('2. Response and rectification submitted')
  console.log('3. Closure blocked - requires QM approval')
  console.log('')
  console.log('Next Steps:')
  console.log('1. Login as qm@test.com (Quality Manager)')
  console.log('2. Approve the NCR using QM Approve button')
  console.log('3. NCR can then be closed')
  console.log('========================================')
}

main().catch(console.error)
