import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProjectUsers() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      projectUsers: {
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              email: true
            }
          }
        }
      }
    }
  });
  console.log('Projects and Users:', JSON.stringify(projects, null, 2));

  await prisma.$disconnect();
}

checkProjectUsers();
