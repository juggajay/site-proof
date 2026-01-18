// Script to release a hold point for testing
const API_URL = 'http://localhost:4000';

async function main() {
  // Login
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@test.com',
      password: 'password123'
    })
  });

  const loginData = await loginRes.json();
  if (!loginData.token) {
    console.error('Failed to login:', loginData);
    return;
  }

  const token = loginData.token;
  console.log('Logged in successfully');

  // Get hold points for the project
  const projectId = 'cb950c13-368c-4e33-afb9-27e79fd90dcd';
  const hpRes = await fetch(`${API_URL}/api/holdpoints/project/${projectId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const hpData = await hpRes.json();
  console.log('Hold points:', JSON.stringify(hpData, null, 2));

  // Find the hold point that's in "notified" status
  const holdPoint = hpData.holdPoints?.find(hp => hp.status === 'notified');

  if (!holdPoint) {
    console.log('No hold point in notified status found');
    return;
  }

  console.log(`\nFound hold point to release: ${holdPoint.id}`);
  console.log(`Lot: ${holdPoint.lotNumber}`);
  console.log(`Description: ${holdPoint.description}`);

  // Release the hold point
  const releaseRes = await fetch(`${API_URL}/api/holdpoints/${holdPoint.id}/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      releasedByName: 'John Inspector',
      releasedByOrg: 'Quality Inspections Pty Ltd',
      releaseMethod: 'On-site inspection',
      releaseNotes: 'All compaction requirements met. Inspection passed.'
    })
  });

  const releaseData = await releaseRes.json();
  console.log('\nRelease result:', JSON.stringify(releaseData, null, 2));
}

main().catch(console.error);
