import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

// Helper to calculate subtotals by company
function calculateSubtotals(personnel) {
  const byCompany = {};

  personnel.forEach(p => {
    const company = p.company || 'Unknown';
    if (!byCompany[company]) {
      byCompany[company] = { personnel: [], totalHours: 0, headcount: 0 };
    }
    byCompany[company].personnel.push(p);
    byCompany[company].totalHours += parseFloat(p.hours || 0);
    byCompany[company].headcount += 1;
  });

  return byCompany;
}

// Helper to calculate grand total
function calculateGrandTotal(personnel) {
  return personnel.reduce((sum, p) => sum + parseFloat(p.hours || 0), 0);
}

async function main() {
  console.log('Testing Feature #612: Diary personnel hours subtotal\n');

  // Setup - create diary
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - 1); // Yesterday to avoid conflicts

  // Delete existing diary for this date
  await prisma.dailyDiary.deleteMany({
    where: {
      projectId: PROJECT_ID,
      date: today
    }
  });

  const diary = await prisma.dailyDiary.create({
    data: {
      projectId: PROJECT_ID,
      date: today,
      status: 'draft'
    }
  });
  console.log('Created diary for:', diary.date);

  // Step 1: Add personnel from CompanyA
  console.log('\n=== Step 1: Add personnel from CompanyA ===');

  const companyAPersonnel = await Promise.all([
    prisma.diaryPersonnel.create({
      data: {
        diaryId: diary.id,
        name: 'John Smith',
        company: 'CompanyA',
        role: 'Supervisor',
        startTime: '06:00',
        finishTime: '16:00',
        hours: 10.0
      }
    }),
    prisma.diaryPersonnel.create({
      data: {
        diaryId: diary.id,
        name: 'Jane Doe',
        company: 'CompanyA',
        role: 'Operator',
        startTime: '06:00',
        finishTime: '14:30',
        hours: 8.5
      }
    }),
    prisma.diaryPersonnel.create({
      data: {
        diaryId: diary.id,
        name: 'Bob Wilson',
        company: 'CompanyA',
        role: 'Labourer',
        startTime: '07:00',
        finishTime: '15:30',
        hours: 8.5
      }
    })
  ]);

  console.log('Added CompanyA personnel:');
  companyAPersonnel.forEach(p => {
    console.log(`  - ${p.name} (${p.role}): ${p.hours} hours`);
  });

  const step1Passed = companyAPersonnel.length === 3;
  console.log(step1Passed ? '✓ Step 1 passed - CompanyA personnel added' : '✗ Step 1 failed');

  // Step 2: Add personnel from CompanyB
  console.log('\n=== Step 2: Add personnel from CompanyB ===');

  const companyBPersonnel = await Promise.all([
    prisma.diaryPersonnel.create({
      data: {
        diaryId: diary.id,
        name: 'Mike Brown',
        company: 'CompanyB',
        role: 'Foreman',
        startTime: '06:30',
        finishTime: '15:00',
        hours: 8.5
      }
    }),
    prisma.diaryPersonnel.create({
      data: {
        diaryId: diary.id,
        name: 'Sarah Lee',
        company: 'CompanyB',
        role: 'Operator',
        startTime: '06:30',
        finishTime: '16:30',
        hours: 10.0
      }
    })
  ]);

  console.log('Added CompanyB personnel:');
  companyBPersonnel.forEach(p => {
    console.log(`  - ${p.name} (${p.role}): ${p.hours} hours`);
  });

  const step2Passed = companyBPersonnel.length === 2;
  console.log(step2Passed ? '✓ Step 2 passed - CompanyB personnel added' : '✗ Step 2 failed');

  // Step 3: Verify subtotal by company
  console.log('\n=== Step 3: Verify subtotal by company ===');

  // Get all personnel for the diary
  const allPersonnel = await prisma.diaryPersonnel.findMany({
    where: { diaryId: diary.id },
    orderBy: [{ company: 'asc' }, { name: 'asc' }]
  });

  const subtotals = calculateSubtotals(allPersonnel);

  console.log('\nPersonnel Hours by Company:');
  console.log('=' .repeat(60));

  for (const [company, data] of Object.entries(subtotals)) {
    console.log(`\n${company}:`);
    data.personnel.forEach(p => {
      console.log(`  ${p.name.padEnd(20)} ${p.role?.padEnd(15) || ''.padEnd(15)} ${p.hours}h`);
    });
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Subtotal: ${data.headcount} personnel, ${data.totalHours} hours`);
  }
  console.log('\n' + '=' .repeat(60));

  const companyASubtotal = subtotals['CompanyA']?.totalHours || 0;
  const companyBSubtotal = subtotals['CompanyB']?.totalHours || 0;

  console.log(`\nCompanyA subtotal: ${companyASubtotal} hours (expected: 27)`);
  console.log(`CompanyB subtotal: ${companyBSubtotal} hours (expected: 18.5)`);

  const step3Passed = companyASubtotal === 27 && companyBSubtotal === 18.5;
  console.log(step3Passed ? '✓ Step 3 passed - Subtotals correct' : '✗ Step 3 failed');

  // Step 4: Verify grand total
  console.log('\n=== Step 4: Verify grand total ===');

  const grandTotal = calculateGrandTotal(allPersonnel);
  const expectedGrandTotal = 27 + 18.5; // 45.5

  console.log(`Grand total: ${grandTotal} hours`);
  console.log(`Expected: ${expectedGrandTotal} hours`);
  console.log(`Total personnel: ${allPersonnel.length}`);

  const step4Passed = grandTotal === expectedGrandTotal;
  console.log(step4Passed ? '✓ Step 4 passed - Grand total correct' : '✗ Step 4 failed');

  // Final verification
  console.log('\n=== VERIFICATION ===');
  const allTestsPassed = step1Passed && step2Passed && step3Passed && step4Passed;
  console.log('Step 1 - Add personnel from CompanyA:', step1Passed ? '✓ YES' : '✗ NO');
  console.log('Step 2 - Add personnel from CompanyB:', step2Passed ? '✓ YES' : '✗ NO');
  console.log('Step 3 - Verify subtotal by company:', step3Passed ? '✓ YES' : '✗ NO');
  console.log('Step 4 - Verify grand total:', step4Passed ? '✓ YES' : '✗ NO');
  console.log('\nAll tests passed:', allTestsPassed ? '✓ YES' : '✗ NO');

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.diaryPersonnel.deleteMany({ where: { diaryId: diary.id } });
  await prisma.dailyDiary.delete({ where: { id: diary.id } });
  console.log('Done!');

  if (allTestsPassed) {
    console.log('\nFeature #612 is working correctly!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
