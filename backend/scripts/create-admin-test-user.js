import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  // Find or create admin user
  let user = await prisma.user.findUnique({ where: { email: 'admin@test.com' } });

  if (!user) {
    // Find a company to add to
    const company = await prisma.company.findFirst();

    user = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        fullName: 'Admin Test User',
        passwordHash: hashPassword('password123'),
        roleInCompany: 'admin',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        companyId: company?.id
      }
    });
    console.log('Created admin user:', user.email);
  } else {
    // Update password
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword('password123'),
        roleInCompany: 'admin',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });
    console.log('Updated admin user:', user.email);
  }

  // Add to test project
  const project = await prisma.project.findFirst({ where: { name: 'Test Highway Project' } });
  if (project) {
    const existing = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } }
    });
    if (!existing) {
      await prisma.projectUser.create({
        data: { projectId: project.id, userId: user.id, role: 'admin' }
      });
      console.log('Added to project:', project.name);
    } else {
      console.log('Already in project:', project.name);
    }
  }

  console.log('\nAdmin user ready: admin@test.com / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
