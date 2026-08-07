import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('../', import.meta.url));
const allowedDirectWriteFiles = new Set(['lib/lotStatusTransition.ts']);
const directLotWritePattern = /\.lot\.(update|updateMany|upsert)\s*\(/g;
const statusDataPattern = /data\s*:\s*\{[\s\S]*?\bstatus\s*:/;

function isolateCall(source: string, start: number, end: number): string {
  let depth = 0;
  let opened = false;
  for (let index = start; index < end; index += 1) {
    if (source[index] === '(') {
      depth += 1;
      opened = true;
    } else if (source[index] === ')') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start, end);
}

export function findDirectLotStatusWrites(source: string): number[] {
  const matches = Array.from(source.matchAll(directLotWritePattern));
  return matches.flatMap((match, index) => {
    const start = match.index;
    const end = Math.min(matches[index + 1]?.index ?? source.length, start + 3000);
    const callSlice = isolateCall(source, start, end);
    // If a future non-status write false-positives because its `where` follows
    // `data`, reorder the args — do not weaken this pattern.
    if (!statusDataPattern.test(callSlice)) return [];
    return [source.slice(0, start).split('\n').length];
  });
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return [];
      return [entryPath];
    }),
  );
  return nested.flat();
}

describe('lot status write guard', () => {
  it('finds direct status writes without flagging guards or creates', () => {
    expect(
      findDirectLotStatusWrites(`await tx.lot.update({
        where: { id: lotId },
        data: { status: 'completed' },
      });`),
    ).toEqual([1]);
    expect(
      findDirectLotStatusWrites(`await tx.lot.updateMany({
        where: { status: 'claimed' },
        data: { claimedInId: null },
      });`),
    ).toEqual([]);
    expect(
      findDirectLotStatusWrites(`await tx.lot.create({
        data: { status: 'not_started' },
      });`),
    ).toEqual([]);
  });

  it('routes every lot status transition through the ledger service', async () => {
    const findings: string[] = [];
    for (const file of await collectTypeScriptFiles(srcDir)) {
      const relativePath = path.relative(srcDir, file).replace(/\\/g, '/');
      if (allowedDirectWriteFiles.has(relativePath)) continue;
      const source = await readFile(file, 'utf8');
      findings.push(...findDirectLotStatusWrites(source).map((line) => `${relativePath}:${line}`));
    }

    expect(
      findings,
      'Direct lot-status writes bypass the LotStatusEvent ledger. Route this write through transitionLotStatus/transitionLotStatusesWhere in backend/src/lib/lotStatusTransition.ts.',
    ).toEqual([]);
  });
});
