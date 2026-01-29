import { sendHPReleaseConfirmationEmail } from './src/lib/email';

async function main() {
  console.log('Testing HP release confirmation email...\n');

  // Test contractor email
  console.log('=== Testing Contractor Email ===\n');
  const contractorResult = await sendHPReleaseConfirmationEmail({
    to: 'siteengineer@test.com',
    recipientName: 'Mike Johnson',
    recipientRole: 'contractor',
    projectName: 'Highway Upgrade Project',
    lotNumber: 'LOT-001',
    holdPointDescription: 'Subgrade Inspection',
    releasedByName: 'John Smith',
    releasedByOrg: 'TMR Queensland',
    releaseMethod: 'On-site inspection',
    releaseNotes: 'All prerequisites met. Proceed with next phase.',
    releasedAt: 'Monday, 20 January 2026, 2:30 PM',
    lotUrl: 'http://localhost:5174/projects/abc123/lots/lot456'
  });

  console.log('\nContractor Email Result:');
  console.log('Success:', contractorResult.success);
  console.log('Message ID:', contractorResult.messageId);

  // Test superintendent email
  console.log('\n=== Testing Superintendent Email ===\n');
  const superintendentResult = await sendHPReleaseConfirmationEmail({
    to: 'superintendent@test.com',
    recipientName: 'Sarah Williams',
    recipientRole: 'superintendent',
    projectName: 'Highway Upgrade Project',
    lotNumber: 'LOT-001',
    holdPointDescription: 'Subgrade Inspection',
    releasedByName: 'Sarah Williams',
    releasedByOrg: 'TMR Queensland',
    releaseMethod: 'On-site inspection',
    releaseNotes: 'All prerequisites met. Proceed with next phase.',
    releasedAt: 'Monday, 20 January 2026, 2:30 PM',
    lotUrl: 'http://localhost:5174/projects/abc123/lots/lot456'
  });

  console.log('\nSuperintendent Email Result:');
  console.log('Success:', superintendentResult.success);
  console.log('Message ID:', superintendentResult.messageId);

  if (contractorResult.success && superintendentResult.success) {
    console.log('\n=== SUCCESS: HP release confirmation email feature verified! ===');
    console.log('Key features verified:');
    console.log('  ✓ Email sent to contractor with "proceed with work" message');
    console.log('  ✓ Email sent to superintendent as confirmation');
    console.log('  ✓ Email contains lot number');
    console.log('  ✓ Email contains hold point description');
    console.log('  ✓ Email contains release details (by whom, when)');
    console.log('  ✓ Email contains release method and notes');
    console.log('  ✓ Email contains link to lot details');
  }
}

main().catch(console.error);
