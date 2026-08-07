import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pipeline } from 'node:stream/promises';

import { IfcImporter } from '@thatopen/fragments';

import { prisma } from '../prisma.js';
import { logError, logInfo, logWarn } from '../serverLogger.js';
import {
  claimNextVersion,
  completeVersion,
  failVersion,
  HEARTBEAT_INTERVAL_MS,
  heartbeatVersion,
} from './conversionLease.js';
import { fragmentObjectRef, sourceObjectRef, type ModelObjectStore } from './modelObjectStore.js';

export const CONVERTER_VERSION = 'fragments@3.4.7+web-ifc@0.0.77';

type PrismaClientLike = typeof prisma;

export type ConversionRunOutcome =
  | 'ready'
  | 'cache_hit'
  | 'failed'
  | 'fenced_out'
  | 'quarantined'
  | 'idle'
  | 'gone';

export interface ConversionRunnerOptions {
  readonly leaseOwner: string;
  readonly store: ModelObjectStore;
  readonly client?: PrismaClientLike;
  readonly heartbeatIntervalMs?: number;
  readonly convert?: (source: Buffer) => Promise<Uint8Array>;
  readonly now?: () => Date;
}

export async function convertIfcBuffer(source: Buffer): Promise<Uint8Array> {
  const require = createRequire(import.meta.url);
  const wasmDir = `${path.dirname(require.resolve('web-ifc'))}/`;
  const importer = new IfcImporter();
  importer.wasm = { absolute: true, path: wasmDir };
  return importer.process({ bytes: new Uint8Array(source) });
}

export async function runNextConversion(
  options: ConversionRunnerOptions,
): Promise<ConversionRunOutcome> {
  const client = options.client ?? prisma;
  const now = options.now ?? (() => new Date());
  const claim = await claimNextVersion({ leaseOwner: options.leaseOwner, client, now: now() });
  if (!claim) return 'idle';
  if (claim.kind === 'quarantined') {
    logWarn('[Model Conversion] Version quarantined', { versionId: claim.versionId });
    return 'quarantined';
  }

  const version = await client.designModelVersion.findUnique({
    where: { id: claim.versionId },
    include: { model: { select: { id: true, projectId: true } } },
  });
  if (!version) return 'gone';

  const expectedSourceRef = sourceObjectRef(version.model.projectId, version.modelId, version.id);
  const destinationRef = fragmentObjectRef(version.model.projectId, version.modelId, version.id);
  let tempDirectory: string | null = null;
  let heartbeatInFlight: Promise<void> | null = null;
  let fencedOut = false;

  const heartbeat = async () => {
    if (fencedOut) return;
    const renewed = await heartbeatVersion({
      versionId: version.id,
      leaseToken: claim.leaseToken,
      client,
      now: now(),
    });
    if (!renewed) fencedOut = true;
  };
  const heartbeatTimer = setInterval(() => {
    heartbeatInFlight = heartbeat().catch((error) => {
      logWarn('[Model Conversion] Heartbeat failed', { versionId: version.id, error });
    });
  }, options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);

  try {
    if (version.sourceStorageRef !== expectedSourceRef) {
      throw new Error('Source storage reference is missing or outside this model version');
    }

    const cacheHit = await client.designModelVersion.findFirst({
      where: {
        id: { not: version.id },
        sourceSha256: version.sourceSha256,
        converterVersion: CONVERTER_VERSION,
        status: 'ready',
        fragStorageRef: { not: null },
        model: { projectId: version.model.projectId },
      },
      include: { model: { select: { id: true } } },
      orderBy: { convertedAt: 'desc' },
    });

    if (cacheHit?.fragStorageRef && cacheHit.fragSizeBytes !== null) {
      const cacheRef = fragmentObjectRef(version.model.projectId, cacheHit.modelId, cacheHit.id);
      if (cacheHit.fragStorageRef === cacheRef) {
        await options.store.copy(cacheRef, destinationRef);
        if (fencedOut) return 'fenced_out';
        const published = await completeVersion({
          versionId: version.id,
          leaseToken: claim.leaseToken,
          fragStorageRef: destinationRef,
          fragSizeBytes: cacheHit.fragSizeBytes,
          converterVersion: CONVERTER_VERSION,
          diagnostics: { cacheHitFromVersionId: cacheHit.id },
          convertedAt: now(),
          client,
        });
        return published ? 'cache_hit' : 'fenced_out';
      }
    }

    tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'siteproof-model-'));
    const sourcePath = path.join(tempDirectory, 'source.ifc');
    const fragPath = path.join(tempDirectory, 'model.frag');

    const readStartedAt = Date.now();
    await pipeline(
      await options.store.readStream(expectedSourceRef),
      fs.createWriteStream(sourcePath),
    );
    const source = await fs.promises.readFile(sourcePath);
    const readMs = Date.now() - readStartedAt;

    const convertStartedAt = Date.now();
    const fragBytes = await (options.convert ?? convertIfcBuffer)(source);
    const convertMs = Date.now() - convertStartedAt;
    if (fencedOut) return 'fenced_out';

    await fs.promises.writeFile(fragPath, fragBytes);
    await options.store.writeFromFile(fragPath, destinationRef);
    if (fencedOut) return 'fenced_out';

    const fragSizeBytes = BigInt(fragBytes.byteLength);
    const published = await completeVersion({
      versionId: version.id,
      leaseToken: claim.leaseToken,
      fragStorageRef: destinationRef,
      fragSizeBytes,
      converterVersion: CONVERTER_VERSION,
      diagnostics: {
        readMs,
        convertMs,
        sourceSizeBytes: version.sourceSizeBytes.toString(),
        fragSizeBytes: fragSizeBytes.toString(),
        peakRssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
      },
      convertedAt: now(),
      client,
    });
    if (!published) return 'fenced_out';
    logInfo('[Model Conversion] Version ready', {
      versionId: version.id,
      sourceBytes: version.sourceSizeBytes.toString(),
      fragBytes: fragSizeBytes.toString(),
    });
    return 'ready';
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    logError('[Model Conversion] Version failed', { versionId: version.id, reason });
    const recorded = await failVersion({
      versionId: version.id,
      leaseToken: claim.leaseToken,
      reason,
      diagnostics: { error: reason },
      client,
    });
    return recorded ? 'failed' : 'fenced_out';
  } finally {
    clearInterval(heartbeatTimer);
    await heartbeatInFlight;
    if (tempDirectory) {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true }).catch((error) => {
        logWarn('[Model Conversion] Temporary-file cleanup failed', {
          versionId: version.id,
          error,
        });
      });
    }
  }
}
