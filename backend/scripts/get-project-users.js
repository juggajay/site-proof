import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get the Subcontractor Test Project
  const project = await prisma.project.findFirst({
    where: { name: 'Subcontractor Test Project' },
    include: {
      projectUsers: {
        include: {
          user: { select: { id: true, email: true, fullName: true, roleInCompany: true } }
        }
      }
    }
  });

  if (!project) {
    console.log('Subcontractor Test Project not found');
    // List all projects
    const projects = await prisma.project.findMany({ select: { id: true, name: true } });
    console.log('\nAvailable projects:');
    projects.forEach(p => console.log(`  - ${p.name} (${p.id})`));
    return;
  }

  console.log(`Project: ${project.name} (${project.id})`);
  console.log('\nProject Users:');
  project.projectUsers.forEach(pu => {
    console.log(`  - ${pu.user.email} (${pu.user.fullName})`);
    console.log(`    Role in Project: ${pu.role}`);
    console.log(`    Role in Company: ${pu.user.roleInCompany}`);
    console.log(`    User ID: ${pu.user.id}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
