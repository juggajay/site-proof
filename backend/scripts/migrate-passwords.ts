#!/usr/bin/env tsx
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  analyzePasswordHashes,
  formatPasswordHashReadinessReport,
  passwordHashReadinessExitCode,
} from '../src/lib/passwordHashReadiness.js';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.user.findMany({
      select: { passwordHash: true },
    });
    const analysis = analyzePasswordHashes(rows);
    console.log(formatPasswordHashReadinessReport(analysis));
    process.exitCode = passwordHashReadinessExitCode(analysis, process.argv);
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  void main().catch((error) => {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'Password hash readiness check failed. Verify DATABASE_URL and database connectivity.',
      );
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Password hash readiness check failed:', message);
    }
    process.exit(1);
  });
}
