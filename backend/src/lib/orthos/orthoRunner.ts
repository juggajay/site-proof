import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { prisma } from '../prisma.js';
import { logError, logInfo, logWarn } from '../serverLogger.js';
import {
  orthoSourceObjectRef,
  orthoTileObjectRef,
  orthoTileStorageRoot,
  type ModelObjectStore,
} from '../models/modelObjectStore.js';
import {
  claimNextOrtho,
  completeOrtho,
  failOrtho,
  heartbeatOrtho,
  ORTHO_HEARTBEAT_INTERVAL_MS,
} from './orthoLease.js';
import { runOrthoTiling, type GdalExecutor } from './tiling.js';

type PrismaClientLike = typeof prisma;

export type OrthoRunOutcome = 'ready' | 'failed' | 'fenced_out' | 'quarantined' | 'idle' | 'gone';

export interface OrthoRunnerOptions {
  readonly leaseOwner: string;
  readonly store: ModelObjectStore;
  readonly client?: PrismaClientLike;
  readonly heartbeatIntervalMs?: number;
  readonly runGdal?: GdalExecutor;
  readonly now?: () => Date;
}

async function forEachConcurrent<T>(
  values: readonly T[],
  concurrency: number,
  work: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await work(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
}

export async function runNextOrthoTiling(options: OrthoRunnerOptions): Promise<OrthoRunOutcome> {
  const client = options.client ?? prisma;
  const now = options.now ?? (() => new Date());
  const claim = await claimNextOrtho({ leaseOwner: options.leaseOwner, client, now: now() });
  if (!claim) return 'idle';
  if (claim.kind === 'quarantined') {
    logWarn('[Ortho Tiling] Layer quarantined', { orthoId: claim.orthoId });
    return 'quarantined';
  }

  const ortho = await client.orthoLayer.findUnique({ where: { id: claim.orthoId } });
  if (!ortho) return 'gone';

  const expectedSourceRef = orthoSourceObjectRef(ortho.projectId, ortho.id);
  const tileRoot = orthoTileStorageRoot(ortho.projectId, ortho.id);
  // Deterministic so a process killed mid-GDAL leaves output that the reclaimed
  // lease can continue with `--resume`. Normal exits remove it in `finally`.
  const tempDirectory = path.join(os.tmpdir(), `siteproof-ortho-${ortho.id}`);
  const sourcePath = path.join(tempDirectory, 'source.tif');
  const outputDirectory = path.join(tempDirectory, 'tiles');
  let heartbeatInFlight: Promise<void> | null = null;
  let fencedOut = false;

  const heartbeat = async () => {
    if (fencedOut) return;
    const renewed = await heartbeatOrtho({
      orthoId: ortho.id,
      leaseToken: claim.leaseToken,
      client,
      now: now(),
    });
    if (!renewed) fencedOut = true;
  };
  const heartbeatTimer = setInterval(() => {
    heartbeatInFlight = heartbeat().catch((error) => {
      logWarn('[Ortho Tiling] Heartbeat failed', { orthoId: ortho.id, error });
    });
  }, options.heartbeatIntervalMs ?? ORTHO_HEARTBEAT_INTERVAL_MS);

  try {
    if (ortho.sourceStorageRef !== expectedSourceRef) {
      throw new Error('Source storage reference is missing or outside this ortho layer');
    }
    await fs.promises.mkdir(tempDirectory, { recursive: true });
    await pipeline(
      await options.store.readStream(expectedSourceRef),
      fs.createWriteStream(sourcePath),
    );

    const tiled = await runOrthoTiling({
      sourcePath,
      outputDirectory,
      cwd: tempDirectory,
      runGdal: options.runGdal,
    });
    // ponytail: no extent-overlap gate; add if wrong-site uploads actually happen.
    if (fencedOut) return 'fenced_out';

    const uploadStartedAt = Date.now();
    await forEachConcurrent(tiled.tiles, 8, async (tile) => {
      const ref = orthoTileObjectRef(tileRoot, tile.z, tile.x, tile.y);
      await options.store.writeFromFile(tile.absolutePath, ref, 'image/png');
    });
    const uploadMs = Date.now() - uploadStartedAt;
    if (fencedOut) return 'fenced_out';

    const diagnostics = {
      gdalInfoMs: tiled.gdalInfoMs,
      tileMs: tiled.tileMs,
      uploadMs,
      tileCount: tiled.tiles.length,
      gsdCmPerPx: tiled.gsdCmPerPx,
    };
    const published = await completeOrtho({
      orthoId: ortho.id,
      leaseToken: claim.leaseToken,
      tileStorageRoot: tileRoot,
      boundsWgs84: tiled.boundsWgs84,
      minZoom: tiled.minZoom,
      maxZoom: tiled.maxZoom,
      tileCount: tiled.tiles.length,
      diagnostics,
      tiledAt: now(),
      client,
    });
    if (!published) return 'fenced_out';
    logInfo('[Ortho Tiling] Layer ready', { orthoId: ortho.id, ...diagnostics });
    return 'ready';
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    logError('[Ortho Tiling] Layer failed', { orthoId: ortho.id, reason });
    const recorded = await failOrtho({
      orthoId: ortho.id,
      leaseToken: claim.leaseToken,
      reason,
      diagnostics: { error: reason },
      client,
    });
    return recorded ? 'failed' : 'fenced_out';
  } finally {
    clearInterval(heartbeatTimer);
    await heartbeatInFlight;
    await fs.promises.rm(tempDirectory, { recursive: true, force: true }).catch((error) => {
      logWarn('[Ortho Tiling] Temporary-file cleanup failed', { orthoId: ortho.id, error });
    });
  }
}
