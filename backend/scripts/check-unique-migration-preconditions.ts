#!/usr/bin/env tsx
import 'dotenv/config';

import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { runScript } from './lib/run-script.js';

interface DuplicateCheck {
  name: string;
  sql: Prisma.Sql;
  remediation: string;
}

const duplicateChecks: DuplicateCheck[] = [
  {
    name: 'itp_completion_attachments completion/document duplicates',
    sql: Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT completion_id, document_id
        FROM itp_completion_attachments
        GROUP BY completion_id, document_id
        HAVING COUNT(*) > 1
      ) duplicates
    `,
    remediation:
      'Delete duplicate itp_completion_attachments rows before applying 20260615152000_add_itp_completion_attachment_unique.',
  },
  {
    name: 'drawings project/number/revision duplicates',
    sql: Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT project_id, drawing_number, revision
        FROM drawings
        GROUP BY project_id, drawing_number, revision
        HAVING COUNT(*) > 1
      ) duplicates
    `,
    remediation:
      'Resolve duplicate drawings before applying 20260615162000_add_drawing_revision_unique.',
  },
  {
    name: 'ncr_evidence ncr/document duplicates',
    sql: Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT ncr_id, document_id
        FROM ncr_evidence
        GROUP BY ncr_id, document_id
        HAVING COUNT(*) > 1
      ) duplicates
    `,
    remediation:
      'Delete duplicate ncr_evidence rows before applying a unique constraint on (ncr_id, document_id).',
  },
  {
    name: 'daily_dockets subcontractor/project/date duplicates',
    sql: Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT subcontractor_company_id, project_id, date
        FROM daily_dockets
        GROUP BY subcontractor_company_id, project_id, date
        HAVING COUNT(*) > 1
      ) duplicates
    `,
    remediation:
      'Resolve duplicate daily_dockets rows before applying a unique constraint on (subcontractor_company_id, project_id, date).',
  },
];

async function countDuplicates(sql: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint }>>(sql);
  const count = rows[0]?.count ?? 0;
  return typeof count === 'bigint' ? Number(count) : count;
}

async function runDuplicateCheck(check: DuplicateCheck): Promise<string | null> {
  const duplicateGroupCount = await countDuplicates(check.sql);
  if (duplicateGroupCount === 0) {
    console.log(`[pass] ${check.name}: no duplicate groups found.`);
    return null;
  }

  return `${check.name}: found ${duplicateGroupCount} duplicate group(s). ${check.remediation}`;
}

async function main(): Promise<void> {
  const failures = (await Promise.all(duplicateChecks.map(runDuplicateCheck))).filter(
    (failure): failure is string => Boolean(failure),
  );

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[fail] ${failure}`);
    }
    process.exit(1);
  }

  console.log('Unique-index migration preconditions passed.');
}

runScript(main, () => prisma.$disconnect());
