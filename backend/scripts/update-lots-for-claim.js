import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = process.argv[2] || '792aab48-5a0a-4ddc-b5ab-ea40f0619d14';

  // Get all lots for the project
  const lots = await prisma.lot.findMany({
    where: { projectId }
  });

  console.log(`Found ${lots.length} lots for project ${projectId}`);

  // Update each lot to have a budget and "conformed" status
  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i];
    const budget = 10000 + (i * 1000); // Budget from $10,000 to $29,000

    await prisma.lot.update({
      where: { id: lot.id },
      data: {
        status: 'conformed',
        budgetAmount: budget
      }
    });
    console.log(`Updated lot ${lot.lotNumber}: status=conformed, budget=$${budget}`);
  }

  console.log(`\nSuccessfully updated ${lots.length} lots to conformed status with budgets`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
