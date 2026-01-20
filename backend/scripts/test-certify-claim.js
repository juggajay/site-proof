import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const claimId = '586f9440-a4d0-4bbe-8c0e-010687b011cb';
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0';
  const certifiedAmount = 185000;
  const userId = '5e3923ae-2c86-44eb-b8d1-d20ff00a0ed8'; // admin@test.com

  console.log('Testing claim certification directly via Prisma...\n');

  // 1. Get the claim with project
  const claim = await prisma.progressClaim.findFirst({
    where: { id: claimId, projectId },
    include: {
      project: {
        select: { id: true, name: true }
      }
    }
  });

  if (!claim) {
    console.log('Claim not found!');
    return;
  }

  console.log('Claim before:');
  console.log(`  ID: ${claim.id}`);
  console.log(`  Claim #: ${claim.claimNumber}`);
  console.log(`  Status: ${claim.status}`);
  console.log(`  Project: ${claim.project.name}`);

  const previousStatus = claim.status;

  // 2. Update the claim
  const updatedClaim = await prisma.progressClaim.update({
    where: { id: claimId },
    data: {
      status: 'certified',
      certifiedAmount: certifiedAmount,
      certifiedAt: new Date()
    }
  });

  console.log('\nClaim after update:');
  console.log(`  Status: ${updatedClaim.status}`);
  console.log(`  Certified Amount: ${updatedClaim.certifiedAmount}`);

  // 3. Simulate notification logic
  if (previousStatus !== 'certified') {
    console.log('\n--- Notification Logic ---');

    // Get certifier
    const certifier = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true }
    });
    const certifierName = certifier?.fullName || certifier?.email || 'Unknown';
    console.log(`Certifier: ${certifierName}`);

    // Get project managers
    const projectManagers = await prisma.projectUser.findMany({
      where: {
        projectId,
        role: 'project_manager',
        status: 'accepted'
      }
    });
    console.log(`Found ${projectManagers.length} project managers`);

    // Get user details
    const pmUserIds = projectManagers.map(pm => pm.userId);
    const pmUsers = pmUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: pmUserIds } },
          select: { id: true, email: true, fullName: true }
        })
      : [];
    console.log('PM Users:', pmUsers.map(u => u.email));

    // Format amount
    const formattedAmount = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(certifiedAmount);
    console.log(`Formatted Amount: ${formattedAmount}`);

    // Create notifications
    const notificationsToCreate = pmUsers.map(pm => ({
      userId: pm.id,
      projectId,
      type: 'claim_certified',
      title: 'Claim Certified',
      message: `Claim #${claim.claimNumber} has been certified by ${certifierName}. Certified amount: ${formattedAmount}.`,
      linkUrl: `/projects/${projectId}/claims`
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      });
      console.log(`\nCreated ${notificationsToCreate.length} notifications!`);
    }

    // Verify notifications created
    const notifications = await prisma.notification.findMany({
      where: { type: 'claim_certified' },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log('\nRecent claim_certified notifications:');
    notifications.forEach(n => {
      console.log(`  - ${n.title}: ${n.message.substring(0, 60)}...`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
