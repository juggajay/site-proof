// Test closing major NCR as site engineer (should fail) and as QM (should succeed)
// Run with: node scripts/test-close-ncr.js

const API_URL = 'http://localhost:3005'

async function main() {
  // Step 1: Get list of NCRs and find one in verification status
  console.log('Logging in as engineer@test.com...')
  const engineerLogin = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'engineer@test.com', password: 'password123' })
  })
  const { token: engineerToken } = await engineerLogin.json()
  console.log('Engineer login successful!')

  // Get NCRs
  console.log('Fetching NCRs...')
  const ncrsResponse = await fetch(`${API_URL}/api/ncrs`, {
    headers: { 'Authorization': `Bearer ${engineerToken}` }
  })
  const { ncrs } = await ncrsResponse.json()

  // Find a major NCR in verification status without QM approval
  const majorNcr = ncrs.find(n => n.severity === 'major' && n.status === 'verification' && !n.qmApprovedAt)

  if (!majorNcr) {
    console.log('No major NCR in verification status found without QM approval')
    console.log('Available NCRs:', ncrs.map(n => ({ number: n.ncrNumber, severity: n.severity, status: n.status, qmApproved: !!n.qmApprovedAt })))
    process.exit(0)
  }

  console.log('')
  console.log('========================================')
  console.log('Found Major NCR requiring QM approval:')
  console.log('========================================')
  console.log('NCR Number:', majorNcr.ncrNumber)
  console.log('ID:', majorNcr.id)
  console.log('Severity:', majorNcr.severity)
  console.log('Status:', majorNcr.status)
  console.log('QM Approval Required:', majorNcr.qmApprovalRequired)
  console.log('QM Approved:', majorNcr.qmApprovedAt ? 'YES' : 'NO')

  // Step 2: Try to close as engineer (should fail)
  console.log('')
  console.log('========================================')
  console.log('TEST 1: Close as Site Engineer (should FAIL)')
  console.log('========================================')
  const closeAsEngineer = await fetch(`${API_URL}/api/ncrs/${majorNcr.id}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${engineerToken}`
    },
    body: JSON.stringify({ verificationNotes: 'Testing as engineer' })
  })

  const engineerResult = await closeAsEngineer.json()

  if (!closeAsEngineer.ok) {
    console.log('✅ PASS: Closure blocked as expected!')
    console.log('   Status:', closeAsEngineer.status)
    console.log('   Message:', engineerResult.message)
    console.log('   Requires QM Approval:', engineerResult.requiresQmApproval)
  } else {
    console.log('❌ FAIL: NCR closed without QM approval!')
    process.exit(1)
  }

  // Step 3: Login as QM and approve
  console.log('')
  console.log('========================================')
  console.log('TEST 2: QM Approval')
  console.log('========================================')
  console.log('Logging in as qm@test.com...')
  const qmLogin = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qm@test.com', password: 'password123' })
  })
  const { token: qmToken } = await qmLogin.json()
  console.log('QM login successful!')

  // Approve NCR
  console.log('Approving NCR as QM...')
  const approveResponse = await fetch(`${API_URL}/api/ncrs/${majorNcr.id}/qm-approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${qmToken}`
    }
  })

  const approveResult = await approveResponse.json()

  if (approveResponse.ok) {
    console.log('✅ PASS: QM approval granted!')
    console.log('   Message:', approveResult.message)
    console.log('   Approved by:', approveResult.ncr?.qmApprovedBy?.email)
  } else {
    console.log('❌ FAIL: QM approval failed!')
    console.log('   Status:', approveResponse.status)
    console.log('   Message:', approveResult.message)
    process.exit(1)
  }

  // Step 4: Now close as QM (should succeed)
  console.log('')
  console.log('========================================')
  console.log('TEST 3: Close NCR after QM Approval')
  console.log('========================================')
  const closeAsQm = await fetch(`${API_URL}/api/ncrs/${majorNcr.id}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${qmToken}`
    },
    body: JSON.stringify({ verificationNotes: 'Rectification verified. Test results confirm compliance.' })
  })

  const closeResult = await closeAsQm.json()

  if (closeAsQm.ok) {
    console.log('✅ PASS: NCR closed successfully!')
    console.log('   Message:', closeResult.message)
    console.log('   New Status:', closeResult.ncr?.status)
    console.log('   QM Approved By:', closeResult.ncr?.qmApprovedBy?.email)
  } else {
    console.log('❌ FAIL: NCR closure failed!')
    console.log('   Status:', closeAsQm.status)
    console.log('   Message:', closeResult.message)
    process.exit(1)
  }

  console.log('')
  console.log('========================================')
  console.log('ALL TESTS PASSED!')
  console.log('========================================')
  console.log('Feature 17: Major NCR closure requires QM approval - VERIFIED')
}

main().catch(console.error)
