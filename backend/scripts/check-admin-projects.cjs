const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@test.com' },
    select: { id: true, email: true, companyId: true }
  });
  console.log('Admin user:', JSON.stringify(admin, null, 2));

  if (!admin) {
    console.log('No admin user found');
    return;
  }

  // Get company projects
  const company = await prisma.company.findUnique({
    where: { id: admin.companyId },
    include: {
      projects: {
        select: { id: true, name: true }
      }
    }
  });
  console.log('Company projects:', JSON.stringify(company?.projects, null, 2));

  // Check for conformed lots in those projects
  if (company?.projects?.length) {
    const projectIds = company.projects.map(p => p.id);
    const conformedLots = await prisma.lot.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'conformed'
      },
      select: { id: true, lotNumber: true, status: true, projectId: true }
    });
    console.log('Conformed lots in admin projects:', JSON.stringify(conformedLots, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
