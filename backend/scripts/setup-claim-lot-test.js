import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Setting up test data for Feature #583: Claim-lot relationship integrity\n');

  // Step 1: Create a lot with conformed status
  const lot = await prisma.lot.create({
    data: {
      lotNumber: 'CLAIM-TEST-LOT-583',
      description: 'Test lot for claim-lot integrity feature #583',
      projectId: PROJECT_ID,
      status: 'conformed',
      lotType: 'standard',
      activityType: 'Earthworks',
      budgetAmount: 50000,
    }
  });
  console.log('✓ Created conformed lot:', lot.lotNumber, '(id:', lot.id, ')');

  // Step 2: Get the pm user ID
  const pmUser = await prisma.user.findFirst({
    where: { email: 'pm@test.com' }
  });
  if (!pmUser) {
    throw new Error('pm@test.com user not found');
  }
  console.log('✓ Found PM user:', pmUser.email);

  // Step 3: Create a progress claim that includes this lot
  const claim = await prisma.progressClaim.create({
    data: {
      projectId: PROJECT_ID,
      claimNumber: 999,
      claimPeriodStart: new Date('2026-01-01'),
      claimPeriodEnd: new Date('2026-01-31'),
      status: 'submitted',
      preparedById: pmUser.id,
      preparedAt: new Date(),
      submittedAt: new Date(),
      totalClaimedAmount: 50000,
      claimedLots: {
        create: {
          lotId: lot.id,
          quantity: 1,
          unit: 'ea',
          rate: 50000,
          amountClaimed: 50000,
          percentageComplete: 100
        }
      }
    }
  });
  console.log('✓ Created progress claim #', claim.claimNumber, '(id:', claim.id, ')');

  // Step 4: Update lot to link to claim and set status to claimed
  await prisma.lot.update({
    where: { id: lot.id },
    data: {
      claimedInId: claim.id,
      status: 'claimed'
    }
  });
  console.log('✓ Updated lot status to "claimed" and linked to claim');

  console.log('\n=== Test Data Ready ===');
  console.log('Lot ID:', lot.id);
  console.log('Lot Number:', lot.lotNumber);
  console.log('Lot Status: claimed');
  console.log('Claim ID:', claim.id);
  console.log('Claim Number:', claim.claimNumber);
  console.log('\nNow try to delete this lot - it should be blocked!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
