/**
 * Committed benchmark records for the TypeScript benches (`bench-f05.ts`,
 * `bench-c3-test-coverage.ts`).
 *
 * Why this exists: the 2026-07-28 deep review found every performance number in
 * the wave exit-evidence docs (C3 "146 ms", C1 "2,654 ms") was unreproducible
 * from the repo — the harnesses were committed and correctly shaped, but no
 * output artefact was, so the numbers lived only in PR bodies. Each bench now
 * writes a timestamped JSON record next to the `.mjs` benches' records, so the
 * next auditor greps `scripts/bench-results/` instead of trusting prose.
 *
 * Shape and naming match `bench-pdf-folio.mjs`: `<name>-<ISO stamp with : and .
 * replaced by ->.json`, top-level `benchmark`/`spec`/`startedAt`/`finishedAt`/
 * `machine`/`options`/`results`/`verdict`.
 *
 * `machine.load` is the one addition. These two benches are DB-backed and
 * wall-clock-sensitive, so a record taken on a busy machine is not comparable
 * with one taken on an idle machine. Recording the contention alongside the
 * measurement is what makes a slow record interpretable rather than alarming.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BENCH_RESULTS_DIR = path.join(HERE, 'bench-results');

export interface MachineLoad {
  /** Busy fraction of all cores, sampled over `sampleMs`. 100 = fully saturated. */
  cpuBusyPercent: number;
  sampleMs: number;
  freeMemMiB: number;
  /** Rough concurrency proxy: how many cores' worth of work is queued. */
  cpuCount: number;
}

function cpuTotals(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const value of Object.values(cpu.times)) total += value;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

/** Samples aggregate CPU busy-ness over `sampleMs` of real time. */
export async function sampleMachineLoad(sampleMs = 1000): Promise<MachineLoad> {
  const before = cpuTotals();
  await new Promise((resolve) => setTimeout(resolve, sampleMs));
  const after = cpuTotals();
  const idle = after.idle - before.idle;
  const total = after.total - before.total;
  return {
    cpuBusyPercent: total > 0 ? Number((100 * (1 - idle / total)).toFixed(1)) : 0,
    sampleMs,
    freeMemMiB: Math.round(os.freemem() / (1024 * 1024)),
    cpuCount: os.cpus().length,
  };
}

export interface BenchRecord {
  benchmark: string;
  spec: string;
  startedAt: string;
  finishedAt?: string;
  machine?: unknown;
  [key: string]: unknown;
}

/**
 * Writes `record` to `scripts/bench-results/<name>-<stamp>.json` and returns the
 * repo-relative path, which is what an evidence doc should cite.
 *
 * `record.startedAt` supplies the stamp, so the filename and the record agree
 * even when the run took an hour.
 */
export function writeBenchResult(name: string, record: BenchRecord): string {
  fs.mkdirSync(BENCH_RESULTS_DIR, { recursive: true });
  const stamp = record.startedAt.replace(/[:.]/g, '-');
  const file = path.join(BENCH_RESULTS_DIR, `${name}-${stamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return `backend/${path.relative(path.join(HERE, '..'), file).replace(/\\/g, '/')}`;
}

/** `machine` block in the `bench-pdf-folio.mjs` shape, plus sampled load. */
export async function machineBlock(): Promise<Record<string, unknown>> {
  return {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cpus: os.cpus()[0]?.model ?? 'unknown',
    totalMemMiB: Math.round(os.totalmem() / (1024 * 1024)),
    load: await sampleMachineLoad(),
  };
}
