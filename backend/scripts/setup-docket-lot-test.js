import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Setting up test data for Feature #585: Docket lot allocation integrity\n');

  // Step 1: Create a test lot for docket allocation
  let lot = await prisma.lot.findFirst({
    where: {
      projectId: PROJECT_ID,
      lotNumber: 'DOCKET-LOT-TEST-585'
    }
  });

  if (!lot) {
    lot = await prisma.lot.create({
      data: {
        projectId: PROJECT_ID,
        lotNumber: 'DOCKET-LOT-TEST-585',
        lotType: 'standard',
        description: 'Test lot for Feature #585 - docket allocation integrity',
        activityType: 'Earthworks',
        status: 'in_progress',
        chainageStart: 7000,
        chainageEnd: 7100
      }
    });
    console.log('✓ Created lot:', lot.lotNumber, '(id:', lot.id, ')');
  } else {
    console.log('✓ Found existing lot:', lot.lotNumber, '(id:', lot.id, ')');
  }

  // Step 2: Find or create a subcontractor company for dockets
  let subcontractor = await prisma.subcontractorCompany.findFirst({
    where: {
      projectId: PROJECT_ID
    },
    include: {
      employeeRoster: true,
      plantRegister: true
    }
  });

  if (!subcontractor) {
    subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId: PROJECT_ID,
        companyName: 'Test Docket Contractor',
        abn: '12345678901',
        primaryContactName: 'Test Contact',
        primaryContactEmail: 'test@docketcontractor.com',
        status: 'approved'
      },
      include: {
        employeeRoster: true,
        plantRegister: true
      }
    });
    console.log('✓ Created subcontractor:', subcontractor.companyName);
  } else {
    console.log('✓ Found subcontractor:', subcontractor.companyName);
  }

  // Step 3: Find or create an employee for labour dockets
  let employee = subcontractor.employeeRoster[0];
  if (!employee) {
    employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId: subcontractor.id,
        name: 'Test Worker',
        role: 'Operator',
        hourlyRate: 75.00,
        status: 'approved'
      }
    });
    console.log('✓ Created employee:', employee.name);
  } else {
    console.log('✓ Found employee:', employee.name);
  }

  // Step 4: Create a daily docket
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let docket = await prisma.dailyDocket.findFirst({
    where: {
      projectId: PROJECT_ID,
      subcontractorCompanyId: subcontractor.id,
      date: today
    }
  });

  if (!docket) {
    docket = await prisma.dailyDocket.create({
      data: {
        projectId: PROJECT_ID,
        subcontractorCompanyId: subcontractor.id,
        date: today,
        status: 'submitted',
        notes: 'Test docket for Feature #585'
      }
    });
    console.log('✓ Created docket (id:', docket.id, ')');
  } else {
    console.log('✓ Found existing docket (id:', docket.id, ')');
  }

  // Step 5: Add labour entry with lot allocation
  let labourEntry = await prisma.docketLabour.findFirst({
    where: {
      docketId: docket.id,
      employeeId: employee.id
    }
  });

  if (!labourEntry) {
    labourEntry = await prisma.docketLabour.create({
      data: {
        docketId: docket.id,
        employeeId: employee.id,
        submittedHours: 8,
        hourlyRate: 75.00,
        submittedCost: 600.00
      }
    });
    console.log('✓ Created labour entry (id:', labourEntry.id, ')');
  } else {
    console.log('✓ Found existing labour entry (id:', labourEntry.id, ')');
  }

  // Step 6: Allocate labour to the lot
  let lotAllocation = await prisma.docketLabourLot.findFirst({
    where: {
      docketLabourId: labourEntry.id,
      lotId: lot.id
    }
  });

  if (!lotAllocation) {
    lotAllocation = await prisma.docketLabourLot.create({
      data: {
        docketLabourId: labourEntry.id,
        lotId: lot.id,
        hours: 8
      }
    });
    console.log('✓ Created lot allocation (id:', lotAllocation.id, ')');
  } else {
    console.log('✓ Found existing lot allocation (id:', lotAllocation.id, ')');
  }

  console.log('\n=== Test Data Ready ===');
  console.log('Project ID:', PROJECT_ID);
  console.log('Lot ID:', lot.id);
  console.log('Lot Number:', lot.lotNumber);
  console.log('Docket ID:', docket.id);
  console.log('Labour Entry ID:', labourEntry.id);
  console.log('Lot Allocation ID:', lotAllocation.id);
  console.log('\nThe lot DOCKET-LOT-TEST-585 now has a docket labour allocation.');
  console.log('Next: Try to delete this lot and verify the docket is handled correctly.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
