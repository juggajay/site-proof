const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

async function main() {
  // Find or create a subcontractor company that's approved
  let subCompany = await prisma.subcontractorCompany.findFirst({
    where: { status: 'approved' }
  });

  if (!subCompany) {
    // Create one
    const project = await prisma.project.findFirst();
    if (!project) {
      console.error('No project found. Create a project first.');
      return;
    }

    subCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId: project.id,
        companyName: 'Test Subcontractor Admin Company',
        primaryContactName: 'Sub Admin',
        primaryContactEmail: 'subadmin@testsubcontractor.com',
        status: 'approved'
      }
    });
    console.log('Created subcontractor company:', subCompany.companyName);
  } else {
    console.log('Using existing subcontractor company:', subCompany.companyName);
  }

  // Find or create a subcontractor admin user
  let subAdminUser = await prisma.user.findFirst({
    where: { email: 'subadmin@testsubcontractor.com' }
  });

  if (!subAdminUser) {
    subAdminUser = await prisma.user.create({
      data: {
        email: 'subadmin@testsubcontractor.com',
        passwordHash: hashPassword('password123'),
        fullName: 'Subcontractor Admin User',
        roleInCompany: 'subcontractor_admin',
        emailVerified: true
      }
    });
    console.log('Created subcontractor admin user:', subAdminUser.email);
  } else {
    // Update password
    await prisma.user.update({
      where: { id: subAdminUser.id },
      data: { passwordHash: hashPassword('password123') }
    });
    console.log('Updated password for:', subAdminUser.email);
  }

  // Link the user to the subcontractor company via SubcontractorUser
  const existingLink = await prisma.subcontractorUser.findFirst({
    where: { userId: subAdminUser.id }
  });

  if (!existingLink) {
    await prisma.subcontractorUser.create({
      data: {
        userId: subAdminUser.id,
        subcontractorCompanyId: subCompany.id,
        role: 'admin'
      }
    });
    console.log('Linked user to subcontractor company');
  } else {
    console.log('User already linked to a subcontractor company');
  }

  console.log('\n=== Test Credentials ===');
  console.log('Email: subadmin@testsubcontractor.com');
  console.log('Password: password123');
  console.log('Role: subcontractor_admin');
  console.log('Company:', subCompany.companyName);
  console.log('Company ID:', subCompany.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
