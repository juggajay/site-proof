// Test script for lot clone with adjacent chainage - Feature #459
const http = require('http');

async function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Testing Lot Clone with Adjacent Chainage ===\n');

  // Step 1: Login
  console.log('1. Logging in...');
  const loginResult = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@test.com', password: 'password123' });

  if (loginResult.status !== 200) {
    console.error('Login failed:', loginResult.data);
    process.exit(1);
  }
  const token = loginResult.data.token;
  console.log('   Logged in successfully\n');

  // Step 2: Find CLONE-TEST-001 lot
  console.log('2. Finding CLONE-TEST-001 lot...');
  const projectId = '7dc82a06-71a1-408d-a338-17a4ec279731';
  const lotsResult = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/lots?projectId=${projectId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const testLot = lotsResult.data.lots.find(l => l.lotNumber === 'CLONE-TEST-001');
  if (!testLot) {
    console.error('CLONE-TEST-001 not found');
    process.exit(1);
  }
  console.log(`   Found lot: ${testLot.lotNumber}`);
  console.log(`   Original chainage: ${testLot.chainageStart}-${testLot.chainageEnd}\n`);

  // Step 3: Clone the lot
  console.log('3. Cloning lot (should suggest adjacent chainage)...');
  const timestamp = Date.now();
  const cloneResult = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/lots/${testLot.id}/clone`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, { lotNumber: `CLONE-TEST-${timestamp}` });

  if (cloneResult.status !== 201 && cloneResult.status !== 200) {
    console.error('Clone failed:', cloneResult.data);
    process.exit(1);
  }

  const clonedLot = cloneResult.data.lot;
  console.log(`   Cloned lot: ${clonedLot.lotNumber}`);
  console.log(`   Cloned chainage: ${clonedLot.chainageStart}-${clonedLot.chainageEnd}\n`);

  // Step 4: Verify the chainage was adjusted
  const expectedStart = testLot.chainageEnd; // Should be 50
  const sectionLength = testLot.chainageEnd - testLot.chainageStart; // 50 - 0 = 50
  const expectedEnd = expectedStart + sectionLength; // 50 + 50 = 100

  console.log('4. Verifying chainage adjustment...');
  console.log(`   Expected chainage: ${expectedStart}-${expectedEnd}`);
  console.log(`   Actual chainage: ${clonedLot.chainageStart}-${clonedLot.chainageEnd}`);

  if (clonedLot.chainageStart === expectedStart && clonedLot.chainageEnd === expectedEnd) {
    console.log('\n✅ SUCCESS: Clone correctly adjusted chainage from 0-50 to 50-100!');
  } else {
    console.log('\n❌ FAILED: Chainage not adjusted correctly');
    process.exit(1);
  }

  // Step 5: Clone again to verify 100-150
  console.log('\n5. Cloning again to verify second adjacent chainage...');
  const clone2Result = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/lots/${clonedLot.id}/clone`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, { lotNumber: `CLONE-TEST-${timestamp + 1}` });

  if (clone2Result.status !== 201 && clone2Result.status !== 200) {
    console.error('Second clone failed:', clone2Result.data);
    process.exit(1);
  }

  const clonedLot2 = clone2Result.data.lot;
  console.log(`   Second cloned lot: ${clonedLot2.lotNumber}`);
  console.log(`   Second cloned chainage: ${clonedLot2.chainageStart}-${clonedLot2.chainageEnd}`);

  if (clonedLot2.chainageStart === 100 && clonedLot2.chainageEnd === 150) {
    console.log('\n✅ SUCCESS: Second clone correctly adjusted chainage to 100-150!');
    console.log('\n=== All tests passed! Feature #459 verified ===');
  } else {
    console.log('\n❌ FAILED: Second clone chainage not correct');
    process.exit(1);
  }
}

main().catch(console.error);
