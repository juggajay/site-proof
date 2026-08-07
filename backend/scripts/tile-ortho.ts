#!/usr/bin/env tsx
// Requires GDAL (`gdalinfo` + `gdal2tiles.py`) installed locally, or run this
// script inside the built backend Docker image where Debian GDAL 3.6 is present.

import fs from 'node:fs';
import path from 'node:path';

import { runOrthoTiling } from '../src/lib/orthos/tiling.js';

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  process.stderr.write('Usage: npx tsx scripts/tile-ortho.ts <in.tif> <outdir>\n');
  process.exitCode = 2;
} else {
  const sourcePath = path.resolve(inputArg);
  const outputDirectory = path.resolve(outputArg);
  const result = await runOrthoTiling({
    sourcePath,
    outputDirectory,
    cwd: path.dirname(outputDirectory),
  });
  const tileBytes = (
    await Promise.all(result.tiles.map((tile) => fs.promises.stat(tile.absolutePath)))
  ).reduce((sum, stat) => sum + stat.size, 0);
  process.stdout.write(
    `${JSON.stringify(
      {
        sourcePath,
        outputDirectory,
        boundsWgs84: result.boundsWgs84,
        minZoom: result.minZoom,
        maxZoom: result.maxZoom,
        gsdCmPerPx: result.gsdCmPerPx,
        gdalInfoMs: result.gdalInfoMs,
        tileMs: result.tileMs,
        tileCount: result.tiles.length,
        tileBytes,
      },
      null,
      2,
    )}\n`,
  );
}
