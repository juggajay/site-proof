import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const auditLog = await prisma.auditLog.findFirst({
    where: { action: 'account_deletion_requested' },
    orderBy: { createdAt: 'desc' }
  });

  console.log('Audit Log Entry for Account Deletion:');
  console.log(JSON.stringify(auditLog, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
