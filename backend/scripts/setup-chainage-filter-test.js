import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get admin@test.com user
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@test.com' }
  });

  if (!adminUser) {
    console.log('admin@test.com not found');
    return;
  }

  console.log('Admin user:', adminUser.id);

  // Get an existing project that admin user has access to, or find any project in admin's company
  let project = await prisma.project.findFirst({
    where: { companyId: adminUser.companyId }
  });

  if (!project) {
    // Use any project
    project = await prisma.project.findFirst();
  }

  if (!project) {
    console.log('No projects found!');
    return;
  }

  console.log('Using project:', project.name, project.id);

  // Add admin user to project if not already
  const existingProjectUser = await prisma.projectUser.findFirst({
    where: {
      projectId: project.id,
      userId: adminUser.id,
    }
  });

  if (!existingProjectUser) {
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: adminUser.id,
        role: 'admin',
      }
    });
    console.log('Added admin user to project');
  }

  // Create lots with different chainages
  const lotsData = [
    { lotNumber: 'CHAIN-LOT-001', chainageStart: 100, chainageEnd: 150, description: 'Chainage 100-150' },
    { lotNumber: 'CHAIN-LOT-002', chainageStart: 150, chainageEnd: 200, description: 'Chainage 150-200' },
    { lotNumber: 'CHAIN-LOT-003', chainageStart: 200, chainageEnd: 250, description: 'Chainage 200-250' },
    { lotNumber: 'CHAIN-LOT-004', chainageStart: 300, chainageEnd: 350, description: 'Chainage 300-350' },
    { lotNumber: 'CHAIN-LOT-005', chainageStart: 400, chainageEnd: 500, description: 'Chainage 400-500' },
    { lotNumber: 'CHAIN-LOT-006', chainageStart: 50, chainageEnd: 80, description: 'Chainage 50-80' },
    { lotNumber: 'CHAIN-LOT-007', chainageStart: 175, chainageEnd: 175, description: 'Point at 175' },
    { lotNumber: 'CHAIN-LOT-008', chainageStart: null, chainageEnd: null, description: 'No chainage' },
  ];

  for (const lotData of lotsData) {
    const existingLot = await prisma.lot.findFirst({
      where: {
        projectId: project.id,
        lotNumber: lotData.lotNumber,
      }
    });

    if (!existingLot) {
      await prisma.lot.create({
        data: {
          projectId: project.id,
          lotNumber: lotData.lotNumber,
          description: lotData.description,
          chainageStart: lotData.chainageStart,
          chainageEnd: lotData.chainageEnd,
          status: 'not_started',
          activityType: 'Earthworks',
          lotType: 'standard',
        }
      });
      console.log('Created lot:', lotData.lotNumber);
    } else {
      console.log('Lot already exists:', lotData.lotNumber);
    }
  }

  console.log('\nSetup complete!');
  console.log('Project ID:', project.id);
  console.log('Test URL: http://localhost:5175/projects/' + project.id + '/lots');
}

main().catch(console.error).finally(() => prisma.$disconnect());
