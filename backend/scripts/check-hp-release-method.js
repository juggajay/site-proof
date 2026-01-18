// Script to check HP release method
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hps = await prisma.holdPoint.findMany({
    where: { status: 'released' },
    include: { lot: true },
    orderBy: { releasedAt: 'desc' },
    take: 3
  });

  for (const hp of hps) {
    console.log('---');
    console.log('Lot:', hp.lot.lotNumber);
    console.log('Status:', hp.status);
    console.log('Release Method:', hp.releaseMethod || 'not set');
    console.log('Released By:', hp.releasedByName);
    console.log('Released By Org:', hp.releasedByOrg);
    console.log('Released At:', hp.releasedAt);
    console.log('Notes:', hp.releaseNotes?.substring(0, 100) || 'none');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
