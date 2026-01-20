import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const claimId = '586f9440-a4d0-4bbe-8c0e-010687b011cb'; // Claim 6 - submitted
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0';
  const certifierUserId = '22b64f8b-5e5e-4b33-b0c5-87f2b3e95f38'; // admin@test.com user ID

  // First verify claim status
  const claim = await prisma.progressClaim.findUnique({
    where: { id: claimId }
  });
  console.log('Claim before certification:');
  console.log(`  ID: ${claim.id}`);
  console.log(`  Claim #: ${claim.claimNumber}`);
  console.log(`  Status: ${claim.status}`);
  console.log(`  Total Claimed: ${claim.totalClaimedAmount}`);
  console.log(`  Certified Amount: ${claim.certifiedAmount}`);

  // Check existing notifications for PM
  const pmUser = await prisma.projectUser.findFirst({
    where: { projectId, role: 'project_manager' },
    include: { user: true }
  });
  console.log(`\nProject Manager: ${pmUser?.user.email}`);

  const existingNotifs = await prisma.notification.findMany({
    where: {
      userId: pmUser?.userId,
      type: 'claim_certified'
    }
  });
  console.log(`Existing claim_certified notifications: ${existingNotifs.length}`);

  // Delete existing claim_certified notifications for clean test
  if (existingNotifs.length > 0) {
    await prisma.notification.deleteMany({
      where: { type: 'claim_certified' }
    });
    console.log('Deleted existing claim_certified notifications for clean test');
  }

  // Reset claim to submitted status if already certified
  if (claim.status !== 'submitted') {
    console.log('\nResetting claim to submitted status for testing...');
    await prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: 'submitted',
        certifiedAmount: null,
        certifiedAt: null
      }
    });
    console.log('Claim reset to submitted');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
