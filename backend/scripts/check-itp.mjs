import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkITP() {
  const templates = await prisma.iTPTemplate.findMany({
    include: {
      checklistItems: true
    }
  });
  console.log('ITP Templates:', JSON.stringify(templates, null, 2));

  const instances = await prisma.iTPInstance.findMany({
    include: {
      completions: true
    }
  });
  console.log('ITP Instances:', JSON.stringify(instances, null, 2));

  await prisma.$disconnect();
}

checkITP();
