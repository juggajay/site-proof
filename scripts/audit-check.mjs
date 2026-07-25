// CI audit gate: `npm audit --audit-level=high` with documented exceptions.
// Fails on any high/critical advisory whose GHSA id is not in
// scripts/audit-allowlist.json. Run from the package directory being audited.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const allowlistPath =
  process.env.AUDIT_ALLOWLIST ?? new URL('./audit-allowlist.json', import.meta.url);
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));

let raw;
try {
  raw = execSync('npm audit --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
  // npm audit exits non-zero when vulnerabilities exist; the JSON is on stdout.
  if (!err.stdout) throw err;
  raw = err.stdout;
}
const audit = JSON.parse(raw);

const ghsaOf = (url) => url?.match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/)?.[0];
const blocking = new Map();
const suppressed = new Map();
for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
  if (vuln.severity !== 'high' && vuln.severity !== 'critical') continue;
  for (const via of vuln.via) {
    if (typeof via !== 'object') continue; // string vias chain to another package's entry
    const id = ghsaOf(via.url);
    const entry = `${id ?? via.url} [${via.severity}] ${via.title}`;
    (id && allowlist[id] ? suppressed : blocking).set(entry, true);
  }
}

for (const entry of suppressed.keys()) {
  console.log(`allowlisted: ${entry} — ${allowlist[ghsaOf(entry)].reason}`);
}
if (blocking.size > 0) {
  console.error('npm audit: non-allowlisted high/critical advisories:');
  for (const entry of blocking.keys()) console.error(`  ${entry}`);
  process.exit(1);
}
console.log('npm audit: no non-allowlisted high/critical advisories.');
