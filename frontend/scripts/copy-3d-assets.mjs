// Copies the web-ifc wasm and the fragments worker into public/wasm/ so the 3D
// viewer is fully self-hosted — no unpkg/CDN fetches at runtime. Mirrors
// copy-pdf-assets.mjs and the spatial spike's copy-assets.mjs.
//
// web-ifc-mt.wasm is deliberately NOT copied: the multithreaded build only
// activates under crossOriginIsolated (COOP/COEP), which this app must never
// set — its Emscripten pthread worker URL resolves to /undefined under Vite
// and Init() never returns. Single-threaded wasm is correct on every device.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(frontendRoot, 'public', 'wasm');

mkdirSync(target, { recursive: true });
cpSync(join(frontendRoot, 'node_modules', 'web-ifc', 'web-ifc.wasm'), join(target, 'web-ifc.wasm'));
cpSync(
  join(frontendRoot, 'node_modules', '@thatopen', 'fragments', 'dist', 'Worker', 'worker.mjs'),
  join(target, 'frag-worker.mjs'),
);
console.log('3D viewer assets copied to public/wasm/');
