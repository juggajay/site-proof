/**
 * Test script for Feature #314: Sync Conflict Handling
 *
 * This script simulates the sync conflict scenario:
 * 1. Creates a test lot
 * 2. Caches it in the frontend's offline database
 * 3. Updates the lot via API (simulating another user)
 * 4. The frontend sync should detect the conflict
 */

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4006';
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key-change-in-production';

async function main() {
  console.log('=== Testing Sync Conflict Handling (Feature #314) ===\n');

  // Find admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.com' }
  });

  if (!adminUser) {
    console.error('Admin user not found. Please run the app setup first.');
    process.exit(1);
  }

  console.log('Found admin user:', adminUser.email);

  // Find a project
  const project = await prisma.project.findFirst({
    where: {
      projectUsers: {
        some: { userId: adminUser.id }
      }
    }
  });

  if (!project) {
    console.error('No project found for admin user.');
    process.exit(1);
  }

  console.log('Using project:', project.name, project.id);

  // Create a test lot for conflict testing
  const testLotNumber = `SYNC-TEST-${Date.now()}`;
  const lot = await prisma.lot.create({
    data: {
      lotNumber: testLotNumber,
      description: 'Lot for sync conflict testing',
      projectId: project.id,
      activityType: 'Earthworks',
      lotType: 'standard',
      status: 'not_started',
      createdById: adminUser.id
    }
  });

  console.log('\nCreated test lot:', lot.lotNumber, lot.id);
  console.log('Initial description:', lot.description);
  console.log('Created at:', lot.createdAt);
  console.log('Updated at:', lot.updatedAt);

  // Generate a token for API calls
  const token = jwt.sign(
    {
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      companyId: adminUser.companyId
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('\n--- Step 1: Lot created (this represents the cached version in offline DB) ---');
  console.log('Server timestamp:', lot.updatedAt.toISOString());

  // Wait 2 seconds to ensure timestamp difference
  console.log('\nWaiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Update the lot via API (simulating another user's edit while first user is offline)
  console.log('\n--- Step 2: Simulating another user editing the lot online ---');
  const updateResponse = await fetch(`${API_URL}/api/lots/${lot.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      description: 'Description updated by another user while offline'
    })
  });

  if (!updateResponse.ok) {
    console.error('Failed to update lot:', await updateResponse.text());
    process.exit(1);
  }

  const updateResult = await updateResponse.json();
  console.log('Lot updated successfully');
  console.log('New description:', updateResult.lot?.description);
  console.log('New server timestamp:', updateResult.lot?.updatedAt);

  // Fetch the lot to confirm the update
  const fetchResponse = await fetch(`${API_URL}/api/lots/${lot.id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!fetchResponse.ok) {
    console.error('Failed to fetch lot:', await fetchResponse.text());
    process.exit(1);
  }

  const fetchResult = await fetchResponse.json();
  console.log('\n--- Current Server State ---');
  console.log('Lot ID:', fetchResult.lot?.id);
  console.log('Lot Number:', fetchResult.lot?.lotNumber);
  console.log('Description:', fetchResult.lot?.description);
  console.log('Updated At:', fetchResult.lot?.updatedAt);

  console.log('\n=== Sync Conflict Test Setup Complete ===');
  console.log('\nTo complete the test:');
  console.log('1. Open the app in browser at http://localhost:5175');
  console.log('2. Navigate to the project\'s lot register');
  console.log('3. Find lot', testLotNumber);
  console.log('4. Use browser dev tools to call the offline caching function with the OLD timestamp');
  console.log('5. Edit the lot offline');
  console.log('6. Trigger sync');
  console.log('7. The conflict should be detected since server has newer timestamp');
  console.log('\nLot details for testing:');
  console.log(JSON.stringify({
    id: lot.id,
    lotNumber: lot.lotNumber,
    projectId: project.id,
    description: lot.description,
    originalUpdatedAt: lot.updatedAt.toISOString(),
    currentServerUpdatedAt: fetchResult.lot?.updatedAt
  }, null, 2));

  // Clean up
  console.log('\n--- Cleanup ---');
  console.log('Note: Test lot will remain in database for manual testing.');
  console.log('To delete:', `await prisma.lot.delete({ where: { id: '${lot.id}' } })`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
