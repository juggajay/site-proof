const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lot = await prisma.lot.findFirst({
    where: { lotNumber: 'HP-TEST-001' },
    include: {
      itpInstance: {
        include: {
          completions: {
            include: {
              attachments: {
                include: {
                  document: true
                }
              }
            }
          }
        }
      }
    }
  });

  console.log('Lot:', lot?.lotNumber);
  console.log('Completions:', lot?.itpInstance?.completions?.length);

  if (lot?.itpInstance?.completions) {
    for (const completion of lot.itpInstance.completions) {
      console.log('  Completion ID:', completion.id);
      console.log('  Attachments:', completion.attachments?.length || 0);
      if (completion.attachments) {
        for (const att of completion.attachments) {
          const doc = att.document;
          console.log('    - Attachment ID:', att.id);
          console.log('      Document ID:', doc?.id);
          console.log('      Filename:', doc?.filename);
          console.log('      GPS Latitude:', doc?.gpsLatitude);
          console.log('      GPS Longitude:', doc?.gpsLongitude);
          console.log('      Created:', doc?.createdAt);
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
