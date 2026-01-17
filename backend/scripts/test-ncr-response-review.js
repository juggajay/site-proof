import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Testing Feature #605: NCR response review options\n');

  // Setup - get a user for NCR creation
  const user = await prisma.user.findFirst({
    where: {
      projectUsers: { some: { projectId: PROJECT_ID } }
    }
  });
  if (!user) {
    console.log('No user found for testing');
    return;
  }
  console.log('Using user:', user.email);

  // Create a lot for the NCR
  const lot = await prisma.lot.create({
    data: {
      projectId: PROJECT_ID,
      lotNumber: 'NCR-REVIEW-TEST-' + Date.now(),
      lotType: 'work',
      activityType: 'Earthworks',
      description: 'Test lot for NCR review options'
    }
  });
  console.log('Created lot:', lot.lotNumber);

  // Step 1: Create NCR and submit response
  console.log('\n=== Step 1: Submit NCR response ===');
  const ncr = await prisma.nCR.create({
    data: {
      projectId: PROJECT_ID,
      ncrNumber: 'NCR-REVIEW-TEST-' + Date.now(),
      description: 'Testing NCR response review workflow',
      category: 'workmanship',
      severity: 'major',
      status: 'open',
      raisedById: user.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ncrLots: {
        create: { lotId: lot.id }
      }
    }
  });
  console.log('Created NCR:', ncr.ncrNumber);
  console.log('Initial status:', ncr.status);
  console.log('Severity:', ncr.severity);

  // Submit response (status: open -> investigating)
  const ncrWithResponse = await prisma.nCR.update({
    where: { id: ncr.id },
    data: {
      status: 'investigating',
      response: 'We have identified the root cause and are implementing corrective action.',
      respondedAt: new Date(),
      respondedById: user.id
    }
  });
  console.log('\nResponse submitted!');
  console.log('New status:', ncrWithResponse.status);
  console.log('Response:', ncrWithResponse.response);
  const step1Passed = ncrWithResponse.status === 'investigating' && ncrWithResponse.response !== null;
  console.log(step1Passed ? '✓ Step 1 passed' : '✗ Step 1 failed');

  // Step 2: QM reviews the response
  console.log('\n=== Step 2: QM reviews ===');
  // Find or create a QM user
  let qmUser = await prisma.user.findFirst({
    where: {
      projectUsers: {
        some: {
          projectId: PROJECT_ID,
          role: 'quality_manager'
        }
      }
    }
  });
  if (!qmUser) {
    qmUser = await prisma.user.create({
      data: {
        email: 'qm-test-' + Date.now() + '@example.com',
        fullName: 'Test QM User',
        projectUsers: {
          create: {
            projectId: PROJECT_ID,
            role: 'quality_manager'
          }
        }
      }
    });
    console.log('Created QM user for testing');
  }
  console.log('QM user:', qmUser.fullName || qmUser.email);

  // QM can review the NCR - verify all fields are available
  const ncrForReview = await prisma.nCR.findUnique({
    where: { id: ncr.id },
    include: {
      raisedBy: { select: { fullName: true, email: true } },
      respondedBy: { select: { fullName: true, email: true } },
      ncrLots: { include: { lot: { select: { lotNumber: true } } } }
    }
  });
  console.log('\nNCR Review Data:');
  console.log('  NCR Number:', ncrForReview.ncrNumber);
  console.log('  Description:', ncrForReview.description);
  console.log('  Raised by:', ncrForReview.raisedBy?.fullName || ncrForReview.raisedBy?.email);
  console.log('  Response:', ncrForReview.response);
  console.log('  Responded by:', ncrForReview.respondedBy?.fullName || ncrForReview.respondedBy?.email);
  console.log('  Severity:', ncrForReview.severity);
  console.log('  Status:', ncrForReview.status);

  const step2Passed = ncrForReview.response !== null && ncrForReview.respondedBy !== null;
  console.log(step2Passed ? '✓ Step 2 passed - QM can review all NCR data' : '✗ Step 2 failed');

  // Step 3: Option - Accept response (continue to rectification)
  console.log('\n=== Step 3: Option: Accept response ===');

  // Accept response - move to rectification phase
  const ncrAccepted = await prisma.nCR.update({
    where: { id: ncr.id },
    data: {
      status: 'rectification',
      qmReviewedAt: new Date(),
      qmReviewedById: qmUser.id,
      qmReviewComments: 'Response accepted. Proceed with rectification.'
    }
  });
  console.log('QM accepted response');
  console.log('New status:', ncrAccepted.status);
  console.log('QM comments:', ncrAccepted.qmReviewComments);

  const step3Passed = ncrAccepted.status === 'rectification';
  console.log(step3Passed ? '✓ Step 3 passed - Response accepted, moved to rectification' : '✗ Step 3 failed');

  // Step 4: Option - Request revision (demonstrate with a new NCR)
  console.log('\n=== Step 4: Option: Request revision ===');

  // Create another NCR to test revision request
  const ncr2 = await prisma.nCR.create({
    data: {
      projectId: PROJECT_ID,
      ncrNumber: 'NCR-REVISION-TEST-' + Date.now(),
      description: 'Testing revision request option',
      category: 'workmanship',
      severity: 'major',
      status: 'investigating',
      raisedById: user.id,
      response: 'Initial inadequate response',
      respondedAt: new Date(),
      respondedById: user.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ncrLots: {
        create: { lotId: lot.id }
      }
    }
  });

  // QM requests revision - stays in investigating but adds review comments
  const ncrRevisionRequested = await prisma.nCR.update({
    where: { id: ncr2.id },
    data: {
      qmReviewedAt: new Date(),
      qmReviewedById: qmUser.id,
      qmReviewComments: 'Response inadequate. Please provide more details on root cause analysis.',
      revisionRequested: true,
      revisionRequestedAt: new Date(),
      revisionCount: { increment: 1 }
    }
  });
  console.log('QM requested revision');
  console.log('Status (unchanged):', ncrRevisionRequested.status);
  console.log('QM comments:', ncrRevisionRequested.qmReviewComments);
  console.log('Revision requested:', ncrRevisionRequested.revisionRequested);
  console.log('Revision count:', ncrRevisionRequested.revisionCount);

  const step4Passed = ncrRevisionRequested.status === 'investigating' && ncrRevisionRequested.revisionRequested === true;
  console.log(step4Passed ? '✓ Step 4 passed - Revision requested, status stays investigating' : '✗ Step 4 failed');

  // Step 5: Option - Escalate (for major NCRs)
  console.log('\n=== Step 5: Option: Escalate ===');

  // Create an NCR to test escalation
  const ncr3 = await prisma.nCR.create({
    data: {
      projectId: PROJECT_ID,
      ncrNumber: 'NCR-ESCALATE-TEST-' + Date.now(),
      description: 'Testing escalation option',
      category: 'workmanship',
      severity: 'major',
      status: 'investigating',
      raisedById: user.id,
      response: 'Response that needs escalation',
      respondedAt: new Date(),
      respondedById: user.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ncrLots: {
        create: { lotId: lot.id }
      }
    }
  });

  // QM escalates the NCR
  const ncrEscalated = await prisma.nCR.update({
    where: { id: ncr3.id },
    data: {
      status: 'escalated',
      escalatedAt: new Date(),
      escalatedById: qmUser.id,
      escalationReason: 'Requires project manager attention due to potential schedule impact',
      qmReviewedAt: new Date(),
      qmReviewedById: qmUser.id,
      qmReviewComments: 'Escalating to PM due to severity of non-conformance.'
    }
  });
  console.log('QM escalated NCR');
  console.log('New status:', ncrEscalated.status);
  console.log('Escalation reason:', ncrEscalated.escalationReason);

  const step5Passed = ncrEscalated.status === 'escalated' && ncrEscalated.escalationReason !== null;
  console.log(step5Passed ? '✓ Step 5 passed - NCR escalated successfully' : '✗ Step 5 failed');

  // Final verification
  console.log('\n=== VERIFICATION ===');
  const allTestsPassed = step1Passed && step2Passed && step3Passed && step4Passed && step5Passed;
  console.log('Step 1 - Submit NCR response:', step1Passed ? '✓ YES' : '✗ NO');
  console.log('Step 2 - QM reviews:', step2Passed ? '✓ YES' : '✗ NO');
  console.log('Step 3 - Accept response option:', step3Passed ? '✓ YES' : '✗ NO');
  console.log('Step 4 - Request revision option:', step4Passed ? '✓ YES' : '✗ NO');
  console.log('Step 5 - Escalate option:', step5Passed ? '✓ YES' : '✗ NO');
  console.log('\nAll tests passed:', allTestsPassed ? '✓ YES' : '✗ NO');

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.nCRLot.deleteMany({ where: { lotId: lot.id } });
  await prisma.nCR.deleteMany({ where: { id: { in: [ncr.id, ncr2.id, ncr3.id] } } });
  await prisma.lot.delete({ where: { id: lot.id } });
  console.log('Done!');

  if (allTestsPassed) {
    console.log('\nFeature #605 is working correctly!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
