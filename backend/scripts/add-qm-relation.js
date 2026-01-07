import fs from 'fs';

const filePath = 'D:/site-proofv3/backend/prisma/schema.prisma';
let content = fs.readFileSync(filePath, 'utf8');

// Check if qmApprovedNCRs relation already exists
if (content.includes('qmApprovedNCRs')) {
  console.log('qmApprovedNCRs relation already exists in User model');
  process.exit(0);
}

// Add qmApprovedNCRs after closedNCRs in User model
const oldLine = '  closedNCRs      NCR[]             @relation("ClosedByUser")';
const newLines = `  closedNCRs      NCR[]             @relation("ClosedByUser")
  qmApprovedNCRs  NCR[]             @relation("QMApprovedByUser")`;

content = content.replace(oldLine, newLines);

fs.writeFileSync(filePath, content);
console.log('Added qmApprovedNCRs relation to User model');
