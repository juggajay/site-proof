const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.iTPTemplate.findMany({
    where: { name: { contains: 'Mobile HP' } },
    include: { checklistItems: true }
  });
  console.log(JSON.stringify(templates, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
