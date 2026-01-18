import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const lotId = '3a39e326-2eae-4b09-b8d2-94e46bb272e0';

  const instance = await prisma.iTPInstance.findUnique({
    where: { lotId }
  });

  if (instance) {
    await prisma.iTPInstance.delete({
      where: { id: instance.id }
    });
    console.log('Deleted ITP instance:', instance.id);
  } else {
    console.log('No ITP instance found for lot');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
