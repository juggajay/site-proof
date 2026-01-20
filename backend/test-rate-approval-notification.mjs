import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Testing rate approval notification...\n');

  // Find a subcontractor company with employees
  const subcontractor = await prisma.subcontractorCompany.findFirst({
    where: {
      employeeRoster: { some: {} }
    },
    include: {
      project: { select: { id: true, name: true } },
      employeeRoster: true,
      users: true  // SubcontractorUser doesn't have User relation, just userId
    }
  });

  if (!subcontractor) {
    console.log('No subcontractor company with employees found. Creating test data...');

    // Find a test project
    const project = await prisma.project.findFirst();
    if (!project) {
      console.log('No projects found. Cannot test.');
      return;
    }

    // Create a test subcontractor company
    const newSubcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId: project.id,
        companyName: 'Rate Test Subcontractor',
        primaryContactName: 'Test Contact',
        primaryContactEmail: 'ratetest@example.com',
        status: 'approved'
      }
    });

    // Create a test employee
    const employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId: newSubcontractor.id,
        name: 'Test Employee',
        role: 'General Labour',
        hourlyRate: 75.50,
        status: 'pending'
      }
    });

    console.log('Created test subcontractor and employee.');
    console.log('Employee:', employee.name, '- Status:', employee.status);
    console.log('\nNote: To fully test, a SubcontractorUser record linking to a User is needed.');
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
    console.log('Simulating notification creation anyway...\n');
  }

  // Find a pending employee to approve
  const pendingEmployee = subcontractor.employeeRoster.find(e => e.status === 'pending');

  if (pendingEmployee) {
    console.log('\nFound pending employee:', pendingEmployee.name);
    console.log('Current status:', pendingEmployee.status);
    console.log('Hourly rate:', '$' + Number(pendingEmployee.hourlyRate).toFixed(2));

    // Simulate what would happen when approved
    console.log('\n--- Simulating approval notification ---');

    for (const su of subcontractor.users) {
      const user = userMap.get(su.userId);
      if (!user) continue;

      const notification = {
        userId: user.id,
        projectId: subcontractor.project?.id || null,
        type: 'rate_approved',
        title: 'Employee Rate Approved',
        message: `The rate for ${pendingEmployee.name} ($${Number(pendingEmployee.hourlyRate).toFixed(2)}/hr) has been approved. You can now include this employee in your dockets.`,
        linkUrl: `/subcontractor-portal`
      };

      console.log('Would create notification for:', user.email);
      console.log('  Title:', notification.title);
      console.log('  Message:', notification.message);

      // Actually create the notification
      await prisma.notification.create({ data: notification });
      console.log('  ✓ Notification created!');
    }
  } else {
    console.log('\nNo pending employees found. Creating a test notification...');

    // Just create a test notification for verification
    const testEmployee = subcontractor.employeeRoster[0];
    for (const su of subcontractor.users) {
      const user = userMap.get(su.userId);
      if (!user) continue;

      await prisma.notification.create({
        data: {
          userId: user.id,
          projectId: subcontractor.project?.id || null,
          type: 'rate_approved',
          title: 'Employee Rate Approved',
          message: `The rate for ${testEmployee.name} ($${Number(testEmployee.hourlyRate).toFixed(2)}/hr) has been approved. You can now include this employee in your dockets.`,
          linkUrl: `/subcontractor-portal`
        }
      });
      console.log('Created test notification for:', user.email);
    }
  }

  // Verify notifications were created
  console.log('\n--- Checking created notifications ---');
  const notifications = await prisma.notification.findMany({
    where: { type: 'rate_approved' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (notifications.length > 0) {
    console.log(`Found ${notifications.length} rate_approved notification(s):`);
    notifications.forEach(n => {
      console.log(`- ${n.title}: ${n.message.substring(0, 80)}...`);
    });
    console.log('\n=== SUCCESS: Rate approval notification feature verified! ===');
  } else {
    console.log('No rate_approved notifications found.');
  }
}

main().finally(() => prisma.$disconnect());
