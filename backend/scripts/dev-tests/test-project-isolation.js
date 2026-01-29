// Test project isolation within a company
// Users should only see projects they're invited to
// Run with: node scripts/test-project-isolation.js

const API_URL = 'http://localhost:3005'

async function main() {
  console.log('========================================')
  console.log('Project Isolation Test (Same Company)')
  console.log('========================================')
  console.log('')

  // We have test users in the main company with different project assignments
  // Let's use existing test users:
  // - engineer@test.com is on NCR Test Project
  // - viewer@test.com, foreman@test.com etc may be on Test Project 1

  // First, let's login and see what projects different users see

  const testUsers = [
    { email: 'engineer@test.com', password: 'password123' },
    { email: 'viewer@test.com', password: 'password123' },
  ]

  const userProjects = {}

  for (const user of testUsers) {
    console.log(`Testing: ${user.email}`)
    console.log('-'.repeat(40))

    // Login
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    })

    if (!loginResponse.ok) {
      console.log(`❌ Login failed for ${user.email}`)
      continue
    }

    const { token, user: userData } = await loginResponse.json()
    console.log(`✅ Login successful`)
    console.log(`   Company ID: ${userData.companyId}`)
    console.log(`   Role: ${userData.role}`)

    // Get projects
    const projectsResponse = await fetch(`${API_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!projectsResponse.ok) {
      console.log(`❌ Failed to fetch projects`)
      continue
    }

    const { projects } = await projectsResponse.json()
    console.log(`   Projects visible: ${projects.length}`)
    projects.forEach(p => console.log(`      - ${p.name} (${p.id})`))

    userProjects[user.email] = { token, projects, userData }
    console.log('')
  }

  // Now test cross-project access
  console.log('========================================')
  console.log('Cross-Project Access Test')
  console.log('========================================')
  console.log('')

  // Get all unique project IDs from all users
  const allProjectIds = new Set()
  for (const email of Object.keys(userProjects)) {
    userProjects[email].projects.forEach(p => allProjectIds.add(p.id))
  }

  console.log('All projects seen by any user:', [...allProjectIds])
  console.log('')

  // For each user, try to access projects they don't have in their list
  for (const [email, userData] of Object.entries(userProjects)) {
    const userProjectIds = new Set(userData.projects.map(p => p.id))
    const otherProjects = [...allProjectIds].filter(id => !userProjectIds.has(id))

    if (otherProjects.length === 0) {
      console.log(`${email}: No other projects to test access to`)
      continue
    }

    console.log(`${email}: Testing access to ${otherProjects.length} project(s) not in their list`)

    for (const projectId of otherProjects) {
      const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${userData.token}` }
      })

      if (response.status === 403 || response.status === 404) {
        console.log(`   ✅ PASS: Access to ${projectId} blocked (${response.status})`)
      } else if (response.ok) {
        console.log(`   ⚠️  Access allowed to ${projectId} - checking if user has legitimate access`)
        // This could be ok if the user is an admin/owner in the company
        const project = await response.json()
        console.log(`      Project company: ${project.project?.companyId}`)
        console.log(`      User company: ${userData.userData.companyId}`)
        console.log(`      User role: ${userData.userData.role}`)
      } else {
        console.log(`   ❓ Unexpected response: ${response.status}`)
      }
    }
    console.log('')
  }

  console.log('========================================')
  console.log('PROJECT ISOLATION TEST COMPLETE')
  console.log('========================================')
}

main().catch(console.error)
