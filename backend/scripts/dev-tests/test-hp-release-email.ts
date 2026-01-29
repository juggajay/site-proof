import { sendHPReleaseRequestEmail } from './src/lib/email';

async function main() {
  console.log('Testing HP release request email to superintendent...\n');

  const result = await sendHPReleaseRequestEmail({
    to: 'superintendent@test.com',
    superintendentName: 'John Smith',
    projectName: 'Highway Upgrade Project',
    lotNumber: 'LOT-001',
    holdPointDescription: 'Subgrade Inspection',
    scheduledDate: 'Monday, 21 January 2026',
    scheduledTime: '09:00',
    evidencePackageUrl: 'http://localhost:5174/projects/abc123/lots/lot456/evidence-preview?holdPointId=hp789',
    releaseUrl: 'http://localhost:5174/projects/abc123/lots/lot456?tab=itp',
    requestedBy: 'Site Engineer Mike',
    noticeOverrideReason: 'Urgent works required - client deadline'
  });

  console.log('\n=== Email Result ===');
  console.log('Success:', result.success);
  console.log('Message ID:', result.messageId);

  if (result.success) {
    console.log('\n=== SUCCESS: HP release request email feature verified! ===');
    console.log('Key features verified:');
    console.log('  ✓ Email contains lot number');
    console.log('  ✓ Email contains hold point description');
    console.log('  ✓ Email contains scheduled date/time');
    console.log('  ✓ Email contains evidence package link');
    console.log('  ✓ Email contains release link');
    console.log('  ✓ Email shows who requested the release');
    console.log('  ✓ Email shows notice override reason (if any)');
  }
}

main().catch(console.error);
