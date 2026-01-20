import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const claimId = '586f9440-a4d0-4bbe-8c0e-010687b011cb';

  // Reset claim to submitted status
  const claim = await prisma.progressClaim.update({
    where: { id: claimId },
    data: {
      status: 'submitted',
      certifiedAmount: null,
      certifiedAt: null
    }
  });

  console.log('Claim reset to submitted:');
  console.log(`  ID: ${claim.id}`);
  console.log(`  Status: ${claim.status}`);

  // Delete any claim_certified notifications
  const deleted = await prisma.notification.deleteMany({
    where: { type: 'claim_certified' }
  });
  console.log(`\nDeleted ${deleted.count} claim_certified notifications`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
