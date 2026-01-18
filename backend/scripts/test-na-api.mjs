import dotenv from 'dotenv'
dotenv.config({ path: 'D:/site-proofv3/backend/.env' })

// Test the N/A API endpoint
async function main() {
  const apiUrl = 'http://localhost:4000'

  // First login to get a token
  const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@test.com',
      password: 'password123'
    })
  })

  const loginData = await loginRes.json()
  console.log('Login response:', loginRes.status)

  if (!loginData.token) {
    console.log('Failed to login:', loginData)
    return
  }

  const token = loginData.token

  // Now test the N/A endpoint - first try without status to verify basic functionality
  const testBody = {
    itpInstanceId: 'f1ccc551-b396-413b-a344-4a4c2c2bd64f',
    checklistItemId: '6ba43b43-8a7a-4e10-912d-c99f97c2a72c', // Item 6
    isCompleted: true,
    notes: 'Test completed from script'
  }

  console.log('\nSending request with body:')
  console.log(JSON.stringify(testBody, null, 2))

  const res = await fetch(`${apiUrl}/api/itp/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(testBody)
  })

  const data = await res.json()
  console.log('\nResponse status:', res.status)
  console.log('Response body:')
  console.log(JSON.stringify(data, null, 2))

  // Check if isNotApplicable is true in response
  if (data.completion) {
    console.log('\n=== Results ===')
    console.log('isNotApplicable:', data.completion.isNotApplicable)
    console.log('isCompleted:', data.completion.isCompleted)
    console.log('notes:', data.completion.notes)
  }
}

main().catch(console.error)
