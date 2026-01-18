const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.subcontractorCompany.findMany({
    include: { project: true, employeeRoster: true, plantRegister: true }
  });
  subs.forEach(s => {
    console.log('---');
    console.log('Company:', s.companyName);
    console.log('Project:', s.project?.name);
    console.log('ProjectId:', s.projectId);
    console.log('Status:', s.status);
    console.log('Employees:', s.employeeRoster.length);
    console.log('Plant:', s.plantRegister.length);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
