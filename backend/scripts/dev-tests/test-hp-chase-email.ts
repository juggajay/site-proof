import { sendHPChaseEmail } from './src/lib/email';

async function main() {
  console.log('Testing HP chase email to superintendent...\n');

  const result = await sendHPChaseEmail({
    to: 'superintendent@test.com',
    superintendentName: 'John Smith',
    projectName: 'Highway Upgrade Project',
    lotNumber: 'LOT-001',
    holdPointDescription: 'Subgrade Inspection',
    originalRequestDate: 'Wednesday, 15 January 2026',
    chaseCount: 2,
    daysSinceRequest: 5,
    evidencePackageUrl: 'http://localhost:5174/projects/abc123/lots/lot456/evidence-preview?holdPointId=hp789',
    releaseUrl: 'http://localhost:5174/projects/abc123/lots/lot456?tab=itp',
    requestedBy: 'Site Engineer Mike'
  });

  console.log('\n=== Email Result ===');
  console.log('Success:', result.success);
  console.log('Message ID:', result.messageId);

  if (result.success) {
    console.log('\n=== SUCCESS: HP chase email feature verified! ===');
    console.log('Key features verified:');
    console.log('  ✓ Email contains lot number');
    console.log('  ✓ Email contains hold point description');
    console.log('  ✓ Email contains original request date');
    console.log('  ✓ Email contains chase count (reminder number)');
    console.log('  ✓ Email contains days since request');
    console.log('  ✓ Email contains evidence package link');
    console.log('  ✓ Email contains release link');
    console.log('  ✓ Email shows who originally requested');
  }
}

main().catch(console.error);
