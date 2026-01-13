const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = 'commercial-test-project-id';

  // Check conformed lots
  const conformedLots = await prisma.lot.findMany({
    where: {
      projectId,
      status: 'conformed'
    },
    select: {
      id: true,
      lotNumber: true,
      status: true,
      claimedInId: true,
      budgetAmount: true
    }
  });
  console.log('Conformed lots:', conformedLots.length);
  conformedLots.forEach(l => console.log('  -', l.lotNumber, '| status:', l.status, '| claimedInId:', l.claimedInId));

  // Check claimed lots
  const claimedLots = await prisma.lot.findMany({
    where: {
      projectId,
      status: 'claimed'
    },
    select: {
      id: true,
      lotNumber: true,
      status: true,
      claimedInId: true
    }
  });
  console.log('\nClaimed lots:', claimedLots.length);
  claimedLots.forEach(l => console.log('  -', l.lotNumber, '| status:', l.status, '| claimedInId:', l.claimedInId));

  // Check progress claims
  const claims = await prisma.progressClaim.findMany({
    where: { projectId },
    include: {
      claimLots: {
        include: {
          lot: {
            select: { lotNumber: true, status: true }
          }
        }
      }
    }
  });
  console.log('\nProgress claims:', claims.length);
  claims.forEach(c => {
    console.log('  - Claim', c.claimNumber, '| status:', c.status, '| lots:', c.claimLots.map(cl => cl.lot.lotNumber).join(', '));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
