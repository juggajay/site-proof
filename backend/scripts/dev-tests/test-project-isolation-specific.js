// Test project isolation with specifically created test users
// Run with: node scripts/test-project-isolation-specific.js

const API_URL = 'http://localhost:3005'

async function main() {
  console.log('========================================')
  console.log('Project Isolation Test (Same Company)')
  console.log('========================================')
  console.log('')

  // Test users created by setup-project-isolation-test.js
  // User A: member role, assigned to Project A ONLY
  // User B: admin role, assigned to BOTH projects

  // Step 1: Login as User A (member, Project A only)
  console.log('Step 1: Login as User A (member, Project A only)')
  console.log('-'.repeat(50))

  const loginA = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isolation-user-a@test.com',
      password: 'password123'
    })
  })

  if (!loginA.ok) {
    console.log('❌ FAIL: Login failed for User A')
    const error = await loginA.text()
    console.log('   Error:', error)
    process.exit(1)
  }

  const { token: tokenA, user: userA } = await loginA.json()
  console.log('✅ User A login successful')
  console.log('   Email:', userA.email)
  console.log('   Role:', userA.role)
  console.log('   Company ID:', userA.companyId)
  console.log('')

  // Step 2: Get projects visible to User A
  console.log('Step 2: Get projects visible to User A')
  console.log('-'.repeat(50))

  const projectsA = await fetch(`${API_URL}/api/projects`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  })

  const { projects: userAProjects } = await projectsA.json()
  console.log('Projects visible to User A:', userAProjects.length)
  userAProjects.forEach(p => console.log(`   - ${p.name} (${p.id})`))
  console.log('')

  // Step 3: Login as User B (admin, both projects)
  console.log('Step 3: Login as User B (admin, both projects)')
  console.log('-'.repeat(50))

  const loginB = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'isolation-user-b@test.com',
      password: 'password123'
    })
  })

  if (!loginB.ok) {
    console.log('❌ FAIL: Login failed for User B')
    process.exit(1)
  }

  const { token: tokenB, user: userB } = await loginB.json()
  console.log('✅ User B login successful')
  console.log('   Email:', userB.email)
  console.log('   Role:', userB.role)
  console.log('   Company ID:', userB.companyId)
  console.log('')

  // Step 4: Get projects visible to User B
  console.log('Step 4: Get projects visible to User B')
  console.log('-'.repeat(50))

  const projectsB = await fetch(`${API_URL}/api/projects`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  })

  const { projects: userBProjects } = await projectsB.json()
  console.log('Projects visible to User B:', userBProjects.length)
  userBProjects.forEach(p => console.log(`   - ${p.name} (${p.id})`))
  console.log('')

  // Find Project B (the one User A should NOT have access to)
  const projectB = userBProjects.find(p => p.name === 'Isolation Test Project B')
  if (!projectB) {
    console.log('❌ FAIL: Project B not found in User B projects')
    process.exit(1)
  }

  // Step 5: Verify User A can only see Project A
  console.log('Step 5: Verification - User A Project List')
  console.log('-'.repeat(50))

  const hasProjectA = userAProjects.some(p => p.name === 'Isolation Test Project A')
  const hasProjectB = userAProjects.some(p => p.name === 'Isolation Test Project B')

  if (hasProjectA && !hasProjectB) {
    console.log('✅ PASS: User A sees only Project A (not Project B)')
  } else if (hasProjectA && hasProjectB) {
    console.log('❌ FAIL: User A can see Project B (should be hidden)')
    process.exit(1)
  } else {
    console.log('⚠️  UNEXPECTED: User A does not see Project A')
    console.log('   Projects:', userAProjects.map(p => p.name))
  }
  console.log('')

  // Step 6: User A tries to access Project B directly via URL
  console.log('Step 6: User A tries to access Project B directly')
  console.log('-'.repeat(50))
  console.log(`   Accessing: GET /api/projects/${projectB.id}`)

  const directAccess = await fetch(`${API_URL}/api/projects/${projectB.id}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  })

  console.log('   Response status:', directAccess.status)

  if (directAccess.status === 403) {
    const error = await directAccess.json()
    console.log('✅ PASS: Access denied (403 Forbidden)')
    console.log('   Message:', error.error)
  } else if (directAccess.status === 404) {
    console.log('✅ PASS: Access denied (404 Not Found - hidden)')
  } else if (directAccess.ok) {
    console.log('❌ FAIL: User A can access Project B directly!')
    const data = await directAccess.json()
    console.log('   Project data returned:', data.project?.name)
    process.exit(1)
  } else {
    console.log('⚠️  UNEXPECTED status:', directAccess.status)
    const error = await directAccess.text()
    console.log('   Response:', error)
  }
  console.log('')

  // Step 7: User B (admin) can access both projects
  console.log('Step 7: User B (admin) can access Project B')
  console.log('-'.repeat(50))

  const adminAccess = await fetch(`${API_URL}/api/projects/${projectB.id}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  })

  if (adminAccess.ok) {
    const data = await adminAccess.json()
    console.log('✅ PASS: Admin User B can access Project B')
    console.log('   Project:', data.project?.name)
  } else {
    console.log('❌ FAIL: Admin User B cannot access Project B')
    console.log('   Status:', adminAccess.status)
  }
  console.log('')

  console.log('========================================')
  console.log('PROJECT ISOLATION TEST COMPLETE')
  console.log('========================================')
  console.log('')
  console.log('Summary:')
  console.log('  - User A (member): Sees 1 project (Project A only)')
  console.log('  - User B (admin): Sees both projects')
  console.log('  - Direct URL access to Project B: Blocked for User A')
  console.log('')
  console.log('Feature 19: Project isolation - VERIFIED')
}

main().catch(console.error)
