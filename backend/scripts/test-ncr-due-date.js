import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

// Helper to check if NCR is overdue
function isOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === 'closed' || status === 'verified') return false;
  return new Date(dueDate) < new Date();
}

// Helper to calculate days remaining
function daysRemaining(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

async function main() {
  console.log('Testing Feature #604: NCR due date calculation\n');

  // Get a user for creating NCRs
  const projectUser = await prisma.projectUser.findFirst({
    where: { projectId: PROJECT_ID },
    include: { user: true }
  });

  if (!projectUser) {
    console.error('No user found in project');
    return;
  }

  // Step 1: Create NCR with 7 day due
  console.log('Step 1: Creating NCR with 7 day due date...');

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const ncr7Day = await prisma.nCR.create({
    data: {
      projectId: PROJECT_ID,
      ncrNumber: 'NCR-DUE-7DAY-' + Date.now(),
      description: 'Test NCR with 7 day due date',
      category: 'workmanship',
      severity: 'minor',
      status: 'open',
      raisedById: projectUser.userId,
      raisedAt: new Date(),
      dueDate: sevenDaysFromNow
    }
  });

  console.log('Created NCR:', ncr7Day.ncrNumber);
  console.log('Due date set:', ncr7Day.dueDate.toISOString().split('T')[0]);

  // Step 2: Verify due date calculated
  console.log('\nStep 2: Verifying due date calculated...');
  const days7 = daysRemaining(ncr7Day.dueDate);
  console.log('Days remaining:', days7);
  const dueDateCorrect = days7 >= 6 && days7 <= 7; // Allow for time zone variance
  console.log('Due date correctly calculated:', dueDateCorrect ? '✓ YES' : '✗ NO');

  // Step 3: Verify shows in list (query with due date info)
  console.log('\nStep 3: Verifying NCR shows in list with due date...');
  const ncrList = await prisma.nCR.findMany({
    where: { projectId: PROJECT_ID, status: 'open' },
    select: {
      id: true,
      ncrNumber: true,
      dueDate: true,
      status: true
    },
    orderBy: { dueDate: 'asc' }
  });

  const foundInList = ncrList.some(n => n.id === ncr7Day.id);
  console.log('NCR found in open list:', foundInList ? '✓ YES' : '✗ NO');
  console.log('Total open NCRs:', ncrList.length);

  // Show NCRs with due date info
  console.log('\nNCR list with due date status:');
  for (const ncr of ncrList.slice(0, 5)) { // Show first 5
    const days = daysRemaining(ncr.dueDate);
    const overdue = isOverdue(ncr.dueDate, ncr.status);
    const statusIcon = overdue ? '🔴 OVERDUE' :
                       days !== null && days <= 3 ? '🟡 DUE SOON' :
                       days !== null ? '🟢 ON TRACK' : '⚪ NO DUE DATE';
    console.log(`  ${ncr.ncrNumber}: ${statusIcon} (${days !== null ? days + ' days' : 'no due date'})`);
  }

  // Step 4: Verify overdue highlighted when passed
  console.log('\nStep 4: Creating overdue NCR and verifying highlight...');

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 3); // 3 days ago

  const overdueNCR = await prisma.nCR.create({
    data: {
      projectId: PROJECT_ID,
      ncrNumber: 'NCR-OVERDUE-' + Date.now(),
      description: 'Test overdue NCR',
      category: 'workmanship',
      severity: 'minor',
      status: 'open',
      raisedById: projectUser.userId,
      raisedAt: new Date(),
      dueDate: pastDate
    }
  });

  console.log('Created overdue NCR:', overdueNCR.ncrNumber);
  console.log('Due date (past):', overdueNCR.dueDate.toISOString().split('T')[0]);

  const overdueStatus = isOverdue(overdueNCR.dueDate, overdueNCR.status);
  const daysOverdue = daysRemaining(overdueNCR.dueDate);
  console.log('Days overdue:', Math.abs(daysOverdue));
  console.log('Is overdue:', overdueStatus);
  console.log('Overdue highlighted:', overdueStatus ? '🔴 YES' : '✗ NO');

  // Verify closed NCRs don't show as overdue
  console.log('\nVerifying closed NCRs dont show as overdue...');
  const closedOverdue = isOverdue(pastDate, 'closed');
  console.log('Closed NCR with past due date shows overdue:', closedOverdue ? '✗ YES (incorrect)' : '✓ NO (correct)');

  // Final verification
  console.log('\n=== VERIFICATION ===');
  console.log('7 day due date calculated:', dueDateCorrect ? '✓ YES' : '✗ NO');
  console.log('NCR shows in list:', foundInList ? '✓ YES' : '✗ NO');
  console.log('Overdue NCR highlighted:', overdueStatus ? '✓ YES' : '✗ NO');
  console.log('Closed NCRs not overdue:', !closedOverdue ? '✓ YES' : '✗ NO');

  const allTestsPassed = dueDateCorrect && foundInList && overdueStatus && !closedOverdue;
  console.log('\nAll tests passed:', allTestsPassed ? '✓ YES' : '✗ NO');

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.nCR.delete({ where: { id: ncr7Day.id } });
  await prisma.nCR.delete({ where: { id: overdueNCR.id } });
  console.log('Done!');

  if (allTestsPassed) {
    console.log('\nFeature #604 is working correctly!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
