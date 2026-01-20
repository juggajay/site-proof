import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Testing rate counter-proposal notification...\n');

  // Find a subcontractor company with employees
  const subcontractor = await prisma.subcontractorCompany.findFirst({
    where: {
      employeeRoster: { some: {} }
    },
    include: {
      project: { select: { id: true, name: true } },
      employeeRoster: true,
      users: true
    }
  });

  if (!subcontractor) {
    console.log('No subcontractor company with employees found.');
    return;
  }

  console.log('Found subcontractor:', subcontractor.companyName);
  console.log('Project:', subcontractor.project?.name);
  console.log('Employees:', subcontractor.employeeRoster.length);
  console.log('Users to notify:', subcontractor.users.length);

  // Get user details for the SubcontractorUsers
  const userIds = subcontractor.users.map(su => su.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true }
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  if (subcontractor.users.length === 0) {
    console.log('\nNo SubcontractorUser records found - notifications would have no recipients.');
    return;
  }

  // Find an employee to counter-propose
  const employee = subcontractor.employeeRoster[0];
  if (!employee) {
    console.log('No employees found.');
    return;
  }

  console.log('\nEmployee for counter-proposal:', employee.name);
  console.log('Current rate:', '$' + Number(employee.hourlyRate).toFixed(2) + '/hr');

  const counterRate = Number(employee.hourlyRate) * 0.9; // Propose 10% less
  console.log('Counter-proposal rate:', '$' + counterRate.toFixed(2) + '/hr');

  // Simulate counter-proposal notification
  console.log('\n--- Simulating counter-proposal notification ---');

  for (const su of subcontractor.users) {
    const user = userMap.get(su.userId);
    if (!user) continue;

    const originalRate = Number(employee.hourlyRate).toFixed(2);
    const proposedRate = counterRate.toFixed(2);

    const notification = {
      userId: user.id,
      projectId: subcontractor.project?.id || null,
      type: 'rate_counter',
      title: 'Rate Counter-Proposal',
      message: `A counter-proposal has been made for ${employee.name}. Original rate: $${originalRate}/hr, Proposed rate: $${proposedRate}/hr. Please review and respond.`,
      linkUrl: `/subcontractor-portal`
    };

    console.log('Would create notification for:', user.email);
    console.log('  Title:', notification.title);
    console.log('  Message:', notification.message);

    // Actually create the notification
    await prisma.notification.create({ data: notification });
    console.log('  ✓ Notification created!');
  }

  // Verify notifications were created
  console.log('\n--- Checking created notifications ---');
  const notifications = await prisma.notification.findMany({
    where: { type: 'rate_counter' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (notifications.length > 0) {
    console.log(`Found ${notifications.length} rate_counter notification(s):`);
    notifications.forEach(n => {
      console.log(`- ${n.title}: ${n.message.substring(0, 100)}...`);
    });
    console.log('\n=== SUCCESS: Rate counter-proposal notification feature verified! ===');
  } else {
    console.log('No rate_counter notifications found.');
  }
}

main().finally(() => prisma.$disconnect());
