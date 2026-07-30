// Wave D `D1c.2` — the assembler: determinism, the hard output cap, omissions,
// and entry order.
//
// **AT-128** determinism · **AT-129** no silent omission · §4.5.3's hard output
// cap · §4.7.2's manifest entries.
//
// NO DATABASE AND NO STORAGE. The assembler takes its members, its metadata and
// its sink as parameters, so every assertion here is over bytes it produced
// from values this file holds. The DB-backed half — claim, publish, cancel,
// sweep — is `exportWorker.db.test.ts`.

import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  assembleArchive,
  AssemblyAbortedError,
  MANIFEST_CSV_PATH,
  MANIFEST_JSON_PATH,
  MANIFEST_SUMMARY_PATH,
  OutputCapExceededError,
  README_PATH,
} from './exportAssembly.js';
import type { LedgerMember, MemberMetadata } from './exportMemberSources.js';
import { MemberObjectMissingError } from './exportMemberSources.js';

const CUTOFF = new Date('2026-07-20T04:00:00.000Z');

function member(overrides: Partial<LedgerMember> & { archivePath: string }): LedgerMember {
  return {
    id: `m-${overrides.archivePath}`,
    sourceType: 'document',
    sourceId: `src-${overrides.archivePath}`,
    sourceRevision: 'v:1',
    storageLocator: `uploads/documents/${overrides.archivePath}`,
    byteSize: null,
    sourceChecksum: null,
    state: 'pending',
    omissionReason: null,
    orderKey: overrides.archivePath,
    ...overrides,
  };
}

function facts(overrides: Partial<MemberMetadata> = {}): MemberMetadata {
  return {
    lotNumber: 'LOT-001',
    documentType: 'photo',
    originalFilename: 'a.jpg',
    uploadedAt: '2026-07-01T00:00:00.000Z',
    uploadedBy: 'Jay',
    filenameRule: 'chainage_span',
    ...overrides,
  };
}

const MEMBERS: LedgerMember[] = [
  member({ archivePath: 'LOT-001/documents/CH1250-1310_a.jpg' }),
  member({ archivePath: 'LOT-001/documents/CH1250-1310_b.jpg' }),
];

const METADATA = new Map<string, MemberMetadata>(
  MEMBERS.map((m) => [m.id, facts({ originalFilename: m.archivePath.slice(-5) })]),
);

/** Collects the archive into a buffer — the sink contract, with no storage. */
function bufferSink(collected: { bytes?: Buffer }) {
  return async (body: Readable): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(chunk as Buffer);
    collected.bytes = Buffer.concat(chunks);
    return 'memory://archive.zip';
  };
}

function run(options: {
  members?: LedgerMember[];
  generatedAt?: Date;
  outputCapBytes?: number;
  readObject?: (locator: string) => Promise<Buffer>;
  onMemberProcessed?: (processed: number) => boolean | Promise<boolean>;
}) {
  const collected: { bytes?: Buffer } = {};
  const members = options.members ?? MEMBERS;

  return assembleArchive({
    members,
    metadata: METADATA,
    summary: {
      exportId: 'export-1',
      projectId: 'project-1',
      scope: { kind: 'project' },
      generatedAt: options.generatedAt ?? new Date('2026-07-29T00:00:00.000Z'),
      generatedBy: 'user-1',
      civosVersion: 'test',
      snapshotCutoffAt: CUTOFF,
      lots: [
        { lotNumber: 'LOT-001', folio: 'issued' },
        { lotNumber: 'LOT-002', folio: 'none' },
      ],
      unauthorizedExclusionCount: 0,
    },
    sink: bufferSink(collected),
    readObject:
      options.readObject ??
      (async (locator) => Buffer.from(`the bytes of ${locator}`.repeat(40), 'utf8')),
    outputCapBytes: options.outputCapBytes ?? 8 * 1024 ** 3,
    entryDate: CUTOFF,
    onMemberProcessed: options.onMemberProcessed,
  }).then((result) => ({ result, collected }));
}

/** Entry names, read back out of the central directory without a ZIP library:
 * every local file header starts `PK\3\4` and carries its name inline. Enough
 * to assert ORDER and PRESENCE, which is what these tests need. */
function localHeaderNames(zip: Buffer): string[] {
  const names: string[] = [];
  for (let index = 0; index < zip.length - 30; index += 1) {
    if (zip.readUInt32LE(index) !== 0x04034b50) continue;
    const nameLength = zip.readUInt16LE(index + 26);
    names.push(zip.subarray(index + 30, index + 30 + nameLength).toString('utf8'));
  }
  return names;
}

describe('assembleArchive — entry order and the manifest set (§4.7.2)', () => {
  it('writes the README, members in ledger order, then csv, json, and the summary LAST', async () => {
    const { collected } = await run({});

    expect(localHeaderNames(collected.bytes!)).toEqual([
      README_PATH,
      'LOT-001/documents/CH1250-1310_a.jpg',
      'LOT-001/documents/CH1250-1310_b.jpg',
      MANIFEST_CSV_PATH,
      MANIFEST_JSON_PATH,
      MANIFEST_SUMMARY_PATH,
    ]);
  });

  it('the README is a self-contained branded page that points the reader at manifest.csv', async () => {
    const { collected } = await run({});
    const zip = collected.bytes!.toString('latin1');

    // Stored README bytes are findable in the raw zip only if deflate left the
    // phrases intact — assert via a fresh single-entry read instead: the text
    // is static, so the builder IS the content.
    const { buildArchiveReadme } = await import('./exportManifest.js');
    const readme = buildArchiveReadme();
    expect(readme).toContain('<!doctype html>');
    expect(readme).toContain('manifest.csv');
    expect(readme).toContain('THE ONE TO OPEN');
    expect(readme).toContain('does not certify');
    // Folder names must match the shipped category folders, not aspiration.
    for (const folder of ['folio/', 'documents/', 'itp/', 'hold-points/', 'ncr/']) {
      expect(readme).toContain(folder);
    }
    // Self-contained: the page renders on an air-gapped machine, so no
    // scripts and no external resource loads (an <a href> is fine — it is
    // optional navigation, not a render dependency).
    expect(readme).not.toMatch(/<script|<link|src=|@import|url\(/i);
    expect(zip).toContain(README_PATH);
  });

  it('records the filename rule per member, which **AT-140** requires', async () => {
    const { result } = await run({});
    expect(result.rows.map((row) => row.filenameRule)).toEqual(['chainage_span', 'chainage_span']);
    expect(result.rows[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('**AT-128** — determinism over one frozen ledger', () => {
  it('two runs under one clock are BYTE-IDENTICAL', async () => {
    const first = await run({ generatedAt: new Date('2026-07-29T00:00:00.000Z') });
    const second = await run({ generatedAt: new Date('2026-07-29T00:00:00.000Z') });

    expect(second.collected.bytes!.equals(first.collected.bytes!)).toBe(true);
    expect(second.result.sha256).toBe(first.result.sha256);
  });

  it('two runs under DIFFERENT clocks differ only in the excluded summary', async () => {
    const first = await run({ generatedAt: new Date('2026-07-29T00:00:00.000Z') });
    const later = await run({ generatedAt: new Date('2026-08-01T09:30:00.000Z') });

    // The whole-archive hash MOVES — `manifest-summary.json` carries
    // generated-at, which is exactly why §4.7.2 excludes it…
    expect(later.result.sha256).not.toBe(first.result.sha256);
    // …and the digest over everything else does NOT.
    expect(later.result.contentDigest).toBe(first.result.contentDigest);

    // And the divergence really is confined to the summary: the archives are
    // identical up to the byte where its local header begins.
    const a = first.collected.bytes!;
    const b = later.collected.bytes!;
    const summaryStart = a.indexOf(Buffer.from(MANIFEST_SUMMARY_PATH, 'utf8'));
    expect(summaryStart).toBeGreaterThan(0);
    expect(a.subarray(0, summaryStart).equals(b.subarray(0, summaryStart))).toBe(true);
  });
});

describe('§4.5.3 — the HARD OUTPUT CAP, enforced during the write', () => {
  const TINY_CAP = 64;

  it('ABORTS when the output exceeds the cap, and produces no archive', async () => {
    await expect(run({ outputCapBytes: TINY_CAP })).rejects.toBeInstanceOf(OutputCapExceededError);
  });

  it("names the cap and the bytes produced, so the failure reason is the user's next step", async () => {
    const error = await run({ outputCapBytes: TINY_CAP }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OutputCapExceededError);
    expect((error as OutputCapExceededError).message).toContain(String(TINY_CAP));
    expect((error as OutputCapExceededError).message).toContain('no partial archive was kept');
  });

  // PROOF OF CATCH. This is the same input, the same members, the same sink —
  // with the cap check effectively disabled. It COMPLETES and the sink keeps
  // every byte. That completed archive, over an input the cap was set to
  // refuse, IS the bug the test above catches: a truncated-or-oversized archive
  // reported as a successful legal record.
  it('WITHOUT the cap the identical run completes and the oversized object survives', async () => {
    const { result, collected } = await run({ outputCapBytes: Number.MAX_SAFE_INTEGER });

    expect(result.writtenCount).toBe(2);
    expect(Number(result.outputBytes)).toBeGreaterThan(TINY_CAP);
    expect(collected.bytes!.length).toBeGreaterThan(TINY_CAP);
  });
});

describe('**AT-129** — a missing object is an omission, never a silent drop', () => {
  it('records the reason, keeps going, and completes the archive', async () => {
    const { result } = await run({
      readObject: async (locator) => {
        if (locator.endsWith('_b.jpg')) {
          throw new MemberObjectMissingError('The stored object is missing');
        }
        return Buffer.from('bytes');
      },
    });

    expect(result.writtenCount).toBe(1);
    expect(result.omissions).toEqual([
      {
        archivePath: 'LOT-001/documents/CH1250-1310_b.jpg',
        sourceType: 'document',
        sourceId: 'src-LOT-001/documents/CH1250-1310_b.jpg',
        reason: 'The stored object is missing',
      },
    ]);

    // The manifest rows carry only what was WRITTEN; the omission is the
    // summary's business, and it is asserted above.
    expect(result.rows).toHaveLength(1);
  });

  it('a NON-omission read failure fails the job — a broken bucket is not an omission', async () => {
    await expect(
      run({
        readObject: async () => {
          throw new Error('connection reset');
        },
      }),
    ).rejects.toThrow('connection reset');
  });
});

describe('§4.7.5 — the progress callback is the abort channel', () => {
  it('a `false` heartbeat aborts the assembly', async () => {
    await expect(run({ onMemberProcessed: () => false })).rejects.toBeInstanceOf(
      AssemblyAbortedError,
    );
  });

  it('reports monotonically increasing progress', async () => {
    const seen: number[] = [];
    await run({
      onMemberProcessed: (processed) => {
        seen.push(processed);
        return true;
      },
    });
    expect(seen).toEqual([1, 2]);
  });
});
