import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-change-in-production';

// Match the hash function from auth.ts
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  const projectId = '28490410-acc1-4d6d-8638-6bfb3f339d92'; // Subcontractor Test Project

  // Check if PM user already exists
  let pmUser = await prisma.user.findUnique({
    where: { email: 'subtest-pm@test.com' }
  });

  if (!pmUser) {
    console.log('Creating PM user...');
    const hashedPassword = hashPassword('password123');

    // Get a company for the user
    const company = await prisma.company.findFirst();

    pmUser = await prisma.user.create({
      data: {
        email: 'subtest-pm@test.com',
        passwordHash: hashedPassword,
        fullName: 'Subtest PM User',
        roleInCompany: 'project_manager',
        companyId: company?.id
      }
    });
    console.log(`Created user: ${pmUser.email} (${pmUser.id})`);
  } else {
    console.log(`PM user already exists: ${pmUser.email} (${pmUser.id})`);
  }

  // Check if user is already a project member
  const existingMember = await prisma.projectUser.findFirst({
    where: { userId: pmUser.id, projectId }
  });

  if (!existingMember) {
    console.log('Adding PM to project...');
    await prisma.projectUser.create({
      data: {
        userId: pmUser.id,
        projectId,
        role: 'project_manager',
        status: 'active',
        invitedAt: new Date(),
        acceptedAt: new Date()
      }
    });
    console.log('Added PM to Subcontractor Test Project');
  } else {
    console.log('PM already a member of the project');
  }

  console.log('\nSetup complete! Use:');
  console.log('  Email: subtest-pm@test.com');
  console.log('  Password: password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
