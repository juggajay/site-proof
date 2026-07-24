/**
 * Pure helpers for the Supabase Storage backup manifest and its verification.
 *
 * Deliberately free of any network, filesystem, or Supabase SDK dependency so
 * the archive/verify contract can be unit tested without hitting production
 * storage. The CLI in `storage-backup.ts` does the I/O and delegates the
 * count/size/checksum bookkeeping to these functions.
 */

export interface ManifestObject {
  /** Object key inside the bucket, e.g. `projects/1/docs/plan.pdf`. */
  path: string;
  /** Size in bytes of the downloaded object. */
  size: number;
  /** Lowercase hex SHA-256 of the object bytes. */
  checksum: string;
}

export interface StorageBackupManifest {
  bucket: string;
  createdAt: string;
  objectCount: number;
  totalBytes: number;
  /** Sorted by `path` for stable, diffable output. */
  objects: ManifestObject[];
}

/**
 * Build a manifest from the objects that were actually downloaded. Sorts by
 * path so the manifest is deterministic, and derives the count/byte totals
 * from the object list itself (never from a separately-tracked counter that
 * could drift).
 */
export function buildManifest(
  bucket: string,
  objects: ManifestObject[],
  createdAt: string = new Date().toISOString(),
): StorageBackupManifest {
  const sorted = [...objects].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    bucket,
    createdAt,
    objectCount: sorted.length,
    totalBytes: sorted.reduce((sum, obj) => sum + obj.size, 0),
    objects: sorted,
  };
}

/**
 * Deterministically pick up to `sampleSize` indices spread evenly across
 * `count` objects. Used to choose which objects get a full checksum
 * re-computation during verification without re-hashing the whole archive.
 */
export function selectSampleIndices(count: number, sampleSize: number): number[] {
  if (count <= 0 || sampleSize <= 0) {
    return [];
  }

  const n = Math.min(sampleSize, count);
  const indices = new Set<number>();
  for (let i = 0; i < n; i += 1) {
    indices.add(Math.floor((i * count) / n));
  }
  // Always include the last object; boundaries are where truncation hides.
  indices.add(count - 1);
  return [...indices].sort((a, b) => a - b);
}

export class ManifestVerificationError extends Error {}

/**
 * Verify an extracted archive against its manifest.
 *
 * @param manifest         The manifest.json that shipped inside the archive.
 * @param present          Map of object path -> byte size for every file found
 *                         on disk after extraction (cheap `stat`, no hashing).
 * @param sampleChecksums  Map of object path -> freshly recomputed SHA-256 for
 *                         a sampled subset. Every entry must match the manifest.
 *
 * Throws {@link ManifestVerificationError} on the first discrepancy: a count
 * mismatch, a missing/extra file, a size mismatch, or a checksum mismatch. A
 * partial backup that silently looks complete is the failure mode we refuse to
 * ship, so any drift is fatal rather than logged-and-continued.
 */
export function verifyManifest(
  manifest: StorageBackupManifest,
  present: Map<string, number>,
  sampleChecksums: Map<string, string>,
): void {
  if (present.size !== manifest.objectCount) {
    throw new ManifestVerificationError(
      `Object count mismatch: manifest claims ${manifest.objectCount}, archive holds ${present.size}.`,
    );
  }

  const manifestByPath = new Map(manifest.objects.map((obj) => [obj.path, obj]));
  if (manifestByPath.size !== manifest.objects.length) {
    throw new ManifestVerificationError('Manifest contains duplicate object paths.');
  }

  for (const obj of manifest.objects) {
    const size = present.get(obj.path);
    if (size === undefined) {
      throw new ManifestVerificationError(`Manifest object missing from archive: ${obj.path}`);
    }
    if (size !== obj.size) {
      throw new ManifestVerificationError(
        `Size mismatch for ${obj.path}: manifest ${obj.size} bytes, archive ${size} bytes.`,
      );
    }
  }

  for (const path of present.keys()) {
    if (!manifestByPath.has(path)) {
      throw new ManifestVerificationError(`Archive contains file not in manifest: ${path}`);
    }
  }

  for (const [path, checksum] of sampleChecksums) {
    const obj = manifestByPath.get(path);
    if (!obj) {
      throw new ManifestVerificationError(`Sampled path not in manifest: ${path}`);
    }
    if (obj.checksum !== checksum) {
      throw new ManifestVerificationError(
        `Checksum mismatch for ${path}: manifest ${obj.checksum}, recomputed ${checksum}.`,
      );
    }
  }
}
