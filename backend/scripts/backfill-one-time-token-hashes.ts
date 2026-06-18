#!/usr/bin/env tsx
import 'dotenv/config';

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireDatabaseTargetConfirmation } from './lib/database-target.js';
import { runScript } from './lib/run-script.js';

const prisma = new PrismaClient();

const HASH_PREFIX = 'sha256:';
const HASHED_TOKEN_PATTERN = /^sha256:[a-f0-9]{64}$/i;

type Mode = 'check' | 'apply';

interface BackfillResult {
  name: string;
  scanned: number;
  candidates: number;
  collisions: number;
  updated: number;
  skipped: number;
}

interface TokenRow {
  id: string;
  token: string;
}

interface BackfillTable<Row extends TokenRow> {
  name: string;
  loadRows: () => Promise<Row[]>;
  findCollision: (row: Row, hashedToken: string) => Promise<unknown | null>;
  updateRow: (row: Row, hashedToken: string) => Promise<number>;
  recordCandidate?: (row: Row) => void;
  afterScan?: () => void;
}

function getMode(argv = process.argv.slice(2)): Mode {
  if (argv.includes('--write') || argv.includes('apply')) {
    return 'apply';
  }

  return 'check';
}

function hashOneTimeToken(token: string): string {
  return `${HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function isPlaintextTokenCandidate(token: string): boolean {
  return !HASHED_TOKEN_PATTERN.test(token);
}

function requireApplyConfirmation(): void {
  requireDatabaseTargetConfirmation(
    'CONFIRM_TOKEN_HASH_BACKFILL',
    'token hash backfill. Take a backup before applying this data rewrite',
  );
}

async function backfillTokenTable<Row extends TokenRow>(
  table: BackfillTable<Row>,
  mode: Mode,
): Promise<BackfillResult> {
  const rows = await table.loadRows();
  const candidates = rows.filter((row) => isPlaintextTokenCandidate(row.token));
  let collisions = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of candidates) {
    table.recordCandidate?.(row);
    const hashedToken = hashOneTimeToken(row.token);
    const collision = await table.findCollision(row, hashedToken);

    if (collision) {
      collisions += 1;
      continue;
    }

    if (mode === 'apply') {
      const updatedCount = await table.updateRow(row, hashedToken);
      if (updatedCount === 1) {
        updated += 1;
      } else {
        skipped += 1;
      }
    }
  }

  table.afterScan?.();
  return {
    name: table.name,
    scanned: rows.length,
    candidates: candidates.length,
    collisions,
    updated,
    skipped,
  };
}

async function backfillPasswordResetTokens(mode: Mode, now: Date): Promise<BackfillResult> {
  const purposes = new Map<string, number>();
  const result = await backfillTokenTable(
    {
      name: 'password_reset_tokens',
      loadRows: () =>
        prisma.passwordResetToken.findMany({
          where: {
            usedAt: null,
            expiresAt: { gt: now },
          },
          select: {
            id: true,
            token: true,
            purpose: true,
          },
        }),
      findCollision: (row, hashedToken) =>
        prisma.passwordResetToken.findFirst({
          where: {
            token: hashedToken,
            NOT: { id: row.id },
          },
          select: { id: true },
        }),
      updateRow: async (row, hashedToken) => {
        const updateResult = await prisma.passwordResetToken.updateMany({
          where: { id: row.id, token: row.token },
          data: { token: hashedToken },
        });
        return updateResult.count;
      },
      recordCandidate: (row) => {
        purposes.set(row.purpose, (purposes.get(row.purpose) ?? 0) + 1);
      },
    },
    mode,
  );

  if (purposes.size > 0) {
    console.log(
      `[info] password_reset_tokens plaintext active candidates by purpose: ${Array.from(
        purposes.entries(),
      )
        .map(([purpose, count]) => `${purpose}=${count}`)
        .join(', ')}`,
    );
  }

  return result;
}

async function backfillEmailVerificationTokens(mode: Mode, now: Date): Promise<BackfillResult> {
  return backfillTokenTable(
    {
      name: 'email_verification_tokens',
      loadRows: () =>
        prisma.emailVerificationToken.findMany({
          where: {
            usedAt: null,
            expiresAt: { gt: now },
          },
          select: {
            id: true,
            token: true,
          },
        }),
      findCollision: (row, hashedToken) =>
        prisma.emailVerificationToken.findFirst({
          where: {
            token: hashedToken,
            NOT: { id: row.id },
          },
          select: { id: true },
        }),
      updateRow: async (row, hashedToken) => {
        const updateResult = await prisma.emailVerificationToken.updateMany({
          where: { id: row.id, token: row.token },
          data: { token: hashedToken },
        });
        return updateResult.count;
      },
    },
    mode,
  );
}

async function backfillHoldPointReleaseTokens(mode: Mode, now: Date): Promise<BackfillResult> {
  return backfillTokenTable(
    {
      name: 'hold_point_release_tokens',
      loadRows: () =>
        prisma.holdPointReleaseToken.findMany({
          where: {
            usedAt: null,
            expiresAt: { gt: now },
          },
          select: {
            id: true,
            token: true,
          },
        }),
      findCollision: (row, hashedToken) =>
        prisma.holdPointReleaseToken.findFirst({
          where: {
            token: hashedToken,
            NOT: { id: row.id },
          },
          select: { id: true },
        }),
      updateRow: async (row, hashedToken) => {
        const updateResult = await prisma.holdPointReleaseToken.updateMany({
          where: { id: row.id, token: row.token },
          data: { token: hashedToken },
        });
        return updateResult.count;
      },
    },
    mode,
  );
}

function printResult(result: BackfillResult): void {
  console.log(
    `[${result.name}] scanned=${result.scanned} candidates=${result.candidates} collisions=${result.collisions} updated=${result.updated} skipped=${result.skipped}`,
  );
}

async function main(): Promise<void> {
  const mode = getMode();
  if (mode === 'apply') {
    requireApplyConfirmation();
  }

  const now = new Date();
  console.log(`One-time token hash backfill mode: ${mode}`);
  const results = [
    await backfillPasswordResetTokens(mode, now),
    await backfillEmailVerificationTokens(mode, now),
    await backfillHoldPointReleaseTokens(mode, now),
  ];

  for (const result of results) {
    printResult(result);
  }

  const collisions = results.reduce((sum, result) => sum + result.collisions, 0);
  if (collisions > 0) {
    throw new Error(
      `Found ${collisions} hash collision(s). Resolve duplicate token rows before applying backfill.`,
    );
  }

  if (mode === 'check') {
    console.log('Dry run only. Re-run with --write and CONFIRM_TOKEN_HASH_BACKFILL to apply.');
  }
}

runScript(main, () => prisma.$disconnect());
