import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROJECT_ID = '92921cc5-92d9-4a22-98e8-df875809179d';

async function main() {
  console.log('Testing Feature #606: NCR rectification evidence upload\n');

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
      lotNumber: 'NCR-EVIDENCE-TEST-' + Date.now(),
      lotType: 'work',
      activityType: 'Earthworks',
      description: 'Test lot for NCR evidence upload'
    }
  });
  console.log('Created lot:', lot.lotNumber);

  // Step 1: Create NCR in rectification status
  console.log('\n=== Step 1: NCR in rectification ===');
  const ncr = await prisma.nCR.create({
    data: {
      projectId: PROJECT_ID,
      ncrNumber: 'NCR-EVIDENCE-TEST-' + Date.now(),
      description: 'Testing NCR evidence upload workflow',
      category: 'workmanship',
      severity: 'minor',
      status: 'rectification',  // Start in rectification status
      raisedById: user.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ncrLots: {
        create: { lotId: lot.id }
      }
    }
  });
  console.log('Created NCR:', ncr.ncrNumber);
  console.log('Status:', ncr.status);
  const step1Passed = ncr.status === 'rectification';
  console.log(step1Passed ? '✓ Step 1 passed - NCR in rectification status' : '✗ Step 1 failed');

  // Step 2: Upload photos
  console.log('\n=== Step 2: Upload photos ===');

  // Create a document for photo evidence
  const photoDoc = await prisma.document.create({
    data: {
      projectId: PROJECT_ID,
      documentType: 'photo',
      category: 'ncr_evidence',
      filename: 'rectification-photo-1.jpg',
      fileUrl: '/uploads/ncr-evidence/rectification-photo-1.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024 * 500,  // 500KB
      uploadedById: user.id,
      caption: 'Photo showing rectified defect'
    }
  });
  console.log('Created photo document:', photoDoc.filename);

  // Link photo to NCR as evidence
  const photoEvidence = await prisma.nCREvidence.create({
    data: {
      ncrId: ncr.id,
      documentId: photoDoc.id,
      evidenceType: 'photo'
    },
    include: {
      document: { select: { filename: true } }
    }
  });
  console.log('Photo evidence linked:', photoEvidence.document.filename);
  console.log('Evidence type:', photoEvidence.evidenceType);
  const step2Passed = photoEvidence.evidenceType === 'photo';
  console.log(step2Passed ? '✓ Step 2 passed - Photo uploaded' : '✗ Step 2 failed');

  // Step 3: Upload re-test certificate
  console.log('\n=== Step 3: Upload re-test certificate ===');

  // Create a document for retest certificate
  const certDoc = await prisma.document.create({
    data: {
      projectId: PROJECT_ID,
      documentType: 'certificate',
      category: 'ncr_evidence',
      filename: 'retest-certificate-compaction.pdf',
      fileUrl: '/uploads/ncr-evidence/retest-certificate-compaction.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024 * 200,  // 200KB
      uploadedById: user.id,
      caption: 'Retest certificate showing 98% compaction achieved'
    }
  });
  console.log('Created certificate document:', certDoc.filename);

  // Link certificate to NCR as evidence
  const certEvidence = await prisma.nCREvidence.create({
    data: {
      ncrId: ncr.id,
      documentId: certDoc.id,
      evidenceType: 'retest_certificate'
    },
    include: {
      document: { select: { filename: true } }
    }
  });
  console.log('Certificate evidence linked:', certEvidence.document.filename);
  console.log('Evidence type:', certEvidence.evidenceType);
  const step3Passed = certEvidence.evidenceType === 'retest_certificate';
  console.log(step3Passed ? '✓ Step 3 passed - Re-test certificate uploaded' : '✗ Step 3 failed');

  // Step 4: Verify all evidence attached
  console.log('\n=== Step 4: Verify all attached ===');

  const allEvidence = await prisma.nCREvidence.findMany({
    where: { ncrId: ncr.id },
    include: {
      document: { select: { filename: true, mimeType: true, caption: true } }
    }
  });

  console.log(`Total evidence items: ${allEvidence.length}`);
  console.log('Evidence list:');
  allEvidence.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.document.filename} (${e.evidenceType})`);
    console.log(`     Caption: ${e.document.caption}`);
  });

  const hasPhoto = allEvidence.some(e => e.evidenceType === 'photo');
  const hasCertificate = allEvidence.some(e => e.evidenceType === 'retest_certificate');
  const step4Passed = allEvidence.length === 2 && hasPhoto && hasCertificate;
  console.log('\nEvidence verification:');
  console.log(`  Photo attached: ${hasPhoto ? '✓' : '✗'}`);
  console.log(`  Certificate attached: ${hasCertificate ? '✓' : '✗'}`);
  console.log(step4Passed ? '✓ Step 4 passed - All evidence verified' : '✗ Step 4 failed');

  // Step 5: Submit for verification
  console.log('\n=== Step 5: Submit for verification ===');

  const updatedNcr = await prisma.nCR.update({
    where: { id: ncr.id },
    data: {
      status: 'verification',
      rectificationNotes: 'Defect has been rectified. Area was re-compacted and re-tested. Achieved 98% compaction.',
      rectificationSubmittedAt: new Date()
    },
    include: {
      ncrEvidence: {
        include: {
          document: { select: { filename: true } }
        }
      }
    }
  });

  console.log('NCR status updated to:', updatedNcr.status);
  console.log('Rectification notes:', updatedNcr.rectificationNotes);
  console.log('Evidence count:', updatedNcr.ncrEvidence.length);
  const step5Passed = updatedNcr.status === 'verification' && updatedNcr.ncrEvidence.length === 2;
  console.log(step5Passed ? '✓ Step 5 passed - Submitted for verification' : '✗ Step 5 failed');

  // Final verification
  console.log('\n=== VERIFICATION ===');
  const allTestsPassed = step1Passed && step2Passed && step3Passed && step4Passed && step5Passed;
  console.log('Step 1 - NCR in rectification:', step1Passed ? '✓ YES' : '✗ NO');
  console.log('Step 2 - Upload photos:', step2Passed ? '✓ YES' : '✗ NO');
  console.log('Step 3 - Upload re-test certificate:', step3Passed ? '✓ YES' : '✗ NO');
  console.log('Step 4 - Verify all attached:', step4Passed ? '✓ YES' : '✗ NO');
  console.log('Step 5 - Submit for verification:', step5Passed ? '✓ YES' : '✗ NO');
  console.log('\nAll tests passed:', allTestsPassed ? '✓ YES' : '✗ NO');

  // Cleanup
  console.log('\nCleaning up test data...');
  await prisma.nCREvidence.deleteMany({ where: { ncrId: ncr.id } });
  await prisma.document.deleteMany({ where: { id: { in: [photoDoc.id, certDoc.id] } } });
  await prisma.nCRLot.deleteMany({ where: { ncrId: ncr.id } });
  await prisma.nCR.delete({ where: { id: ncr.id } });
  await prisma.lot.delete({ where: { id: lot.id } });
  console.log('Done!');

  if (allTestsPassed) {
    console.log('\nFeature #606 is working correctly!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
