import fs from 'fs';

const filePath = 'D:/site-proofv3/backend/prisma/schema.prisma';
let content = fs.readFileSync(filePath, 'utf8');

// Check if severity field already exists
if (content.includes('severity')) {
  console.log('Severity field already exists in NCR model');
  process.exit(0);
}

// Process line by line
const lines = content.split('\n');
const newLines = [];
let inNCRModel = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  if (trimmed.startsWith('model NCR {')) {
    inNCRModel = true;
  }

  if (inNCRModel && trimmed.startsWith('@@map("ncrs")')) {
    inNCRModel = false;
  }

  // Insert severity after category line
  if (inNCRModel && trimmed.startsWith('category') && trimmed.includes('String')) {
    newLines.push(line);
    newLines.push('  severity                  String    @default("minor") // minor, major');
    continue;
  }

  // Insert QM approval fields after status line
  if (inNCRModel && trimmed.startsWith('status') && trimmed.includes('@default("open")')) {
    newLines.push(line);
    newLines.push('  qmApprovalRequired        Boolean   @default(false) @map("qm_approval_required")');
    newLines.push('  qmApprovedById            String?   @map("qm_approved_by")');
    newLines.push('  qmApprovedAt              DateTime? @map("qm_approved_at")');
    continue;
  }

  // Add relation for qmApprovedBy after closedBy relation
  if (inNCRModel && trimmed.startsWith('closedBy') && trimmed.includes('ClosedByUser')) {
    newLines.push(line);
    newLines.push('  qmApprovedBy             User?                 @relation("QMApprovedByUser", fields: [qmApprovedById], references: [id])');
    continue;
  }

  newLines.push(line);
}

fs.writeFileSync(filePath, newLines.join('\n'));
console.log('NCR schema updated successfully with severity and QM approval fields');
