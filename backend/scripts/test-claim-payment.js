import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const claimId = '586f9440-a4d0-4bbe-8c0e-010687b011cb';
  const projectId = 'b0a77eb4-f755-4caf-b13b-d862762314f0';
  const paidAmount = 180000;
  const paymentReference = 'PAY-2026-001';
  const userId = '5e3923ae-2c86-44eb-b8d1-d20ff00a0ed8'; // admin@test.com

  console.log('=== Testing Claim Payment with Notification ===\n');

  // First reset the claim to certified status
  console.log('1. Resetting claim to certified...');
  await prisma.progressClaim.update({
    where: { id: claimId },
    data: {
      status: 'certified',
      certifiedAmount: 185000,
      certifiedAt: new Date(),
      paidAmount: null,
      paidAt: null,
      paymentReference: null
    }
  });

  // Delete any existing claim_paid notifications
  await prisma.notification.deleteMany({
    where: { type: 'claim_paid' }
  });
  console.log('   Done.\n');

  // Get the claim with project
  console.log('2. Getting claim...');
  const claim = await prisma.progressClaim.findFirst({
    where: { id: claimId, projectId },
    include: {
      project: {
        select: { id: true, name: true }
      }
    }
  });
  console.log(`   Claim #${claim.claimNumber}, Status: ${claim.status}, Project: ${claim.project.name}\n`);

  const previousStatus = claim.status;

  // Update the claim to paid
  console.log('3. Marking claim as paid...');
  const updatedClaim = await prisma.progressClaim.update({
    where: { id: claimId },
    data: {
      status: 'paid',
      paidAmount: paidAmount,
      paidAt: new Date(),
      paymentReference: paymentReference
    }
  });
  console.log(`   Status: ${updatedClaim.status}, Paid Amount: $${updatedClaim.paidAmount}, Reference: ${updatedClaim.paymentReference}\n`);

  // Notification logic (same as in claims.ts)
  if (previousStatus !== 'paid') {
    console.log('4. Creating notifications for project managers...');

    // Get payer
    const payer = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true }
    });
    const payerName = payer?.fullName || payer?.email || 'Unknown';
    console.log(`   Payer: ${payerName}`);

    // Get project managers with active or accepted status
    const projectManagers = await prisma.projectUser.findMany({
      where: {
        projectId,
        role: 'project_manager',
        status: { in: ['active', 'accepted'] }
      }
    });
    console.log(`   Found ${projectManagers.length} project manager(s)`);

    // Get user details
    const pmUserIds = projectManagers.map(pm => pm.userId);
    const pmUsers = pmUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: pmUserIds } },
          select: { id: true, email: true, fullName: true }
        })
      : [];
    console.log(`   PM Users: ${pmUsers.map(u => u.email).join(', ')}\n`);

    // Format amount
    const formattedAmount = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(paidAmount);

    // Create notifications
    const notificationsToCreate = pmUsers.map(pm => ({
      userId: pm.id,
      projectId,
      type: 'claim_paid',
      title: 'Claim Payment Received',
      message: `Claim #${claim.claimNumber} payment of ${formattedAmount} has been recorded (Ref: ${paymentReference}).`,
      linkUrl: `/projects/${projectId}/claims`
    }));

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      });
      console.log(`5. Created ${notificationsToCreate.length} notification(s)!\n`);
    } else {
      console.log('5. No PM users to notify.\n');
    }

    // Verify notifications
    const notifications = await prisma.notification.findMany({
      where: { type: 'claim_paid' },
      orderBy: { createdAt: 'desc' }
    });
    console.log('=== Created Notifications ===');
    notifications.forEach(n => {
      console.log(`  Title: ${n.title}`);
      console.log(`  Message: ${n.message}`);
      console.log(`  User ID: ${n.userId}`);
      console.log('');
    });

    // Get PM user info to help with testing
    if (pmUsers.length > 0) {
      console.log('=== To Verify: Log in as ===');
      pmUsers.forEach(pm => {
        console.log(`  Email: ${pm.email}`);
        console.log(`  Password: password123`);
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
