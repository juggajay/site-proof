/**
 * verify-marketing-claims — recompute the numeric claims on the public landing
 * page from the shipped ITP template seeders, and fail if they have drifted.
 *
 * Run: `npm run verify:claims` (from backend/). Exits non-zero on any mismatch.
 *
 * SAFETY — this script parses the seeder files AS TEXT. It never imports them,
 * never executes them, and never opens a database connection.
 *
 * That is not a stylistic preference. All 40 seeders are executable scripts
 * with top-level side effects: none has an entry guard, each constructs a DB
 * client at module scope and calls its `main` at load, taking an advisory lock
 * and writing global ITP templates to whatever DATABASE_URL is in the
 * environment. A dynamic import() of a seeder *runs* it — and an agent running
 * this script locally with backend/.env loaded would point that at production.
 * The seeders also export nothing, so there is no safe import to reach for.
 *
 * The frontend production-readiness suite asserts this file contains no seeder
 * import and no DB client import (AT-G39). The safe implementation and the
 * dangerous one are three characters apart.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');

export const SEED_DIR = resolve(scriptDir, 'seeds/itp-templates');
export const MANIFEST_PATH = resolve(SEED_DIR, 'index.mjs');
export const LANDING_PAGE_PATH = resolve(repoRoot, 'frontend/src/pages/LandingPage.tsx');

/**
 * Public presentation for each jurisdiction group in the seeder manifest, in
 * the order the landing page shows them. A new manifest `state` value fails
 * the run until it is given a row here and on the page — a library that grows
 * without the claim growing is the exact drift this script exists to catch.
 */
export const AUTHORITIES = [
  { state: 'austroads', auth: 'AUSTROADS', region: 'National baseline' },
  { state: 'nsw', auth: 'TfNSW', region: 'New South Wales' },
  { state: 'qld', auth: 'TMR', region: 'Queensland' },
  { state: 'sa', auth: 'DIT', region: 'South Australia' },
  { state: 'vic', auth: 'VicRoads', region: 'Victoria' },
  { state: 'wa', auth: 'MRWA', region: 'Western Australia' },
  { state: 'national', auth: 'WSA / AUS-SPEC', region: 'National standards' },
];

// A checklist point is a *quoted literal* pointType. The quoting is
// load-bearing: 39 of the 40 seeders carry one `pointType: item.pointType,`
// mapper line, so a naive `pointType:` count returns 3,540 instead of 3,501 —
// wrong, and stably wrong, which is the failure mode hardest to notice.
const CHECKLIST_POINT_PATTERN = /^\s*pointType:\s*'/gm;
const HOLD_POINT_PATTERN = /^\s*pointType:\s*'hold_point'/gm;
// Templates are top-level object literals, so their activityType sits at
// exactly two spaces of indent; the same mapper artefact inflates a naive
// `activityType:` count to 191.
const TEMPLATE_PATTERN = /^ {2}activityType:\s*'/gm;

const MANIFEST_ROW_PATTERN =
  /\{\s*state:\s*'([^']+)',\s*activity:\s*'([^']+)',\s*file:\s*'([^']+)',\s*label:\s*'([^']+)'\s*,?\s*\}/g;

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

/** Counts for a single seeder's source text. Exported for AT-G39's fixture. */
export function countInSource(source) {
  return {
    templates: countMatches(source, TEMPLATE_PATTERN),
    checklistPoints: countMatches(source, CHECKLIST_POINT_PATTERN),
    holdPoints: countMatches(source, HOLD_POINT_PATTERN),
  };
}

/** The manifest is read as text too — importing it would run its CLI `main`. */
export function readSeederManifest() {
  const source = readFileSync(MANIFEST_PATH, 'utf8');
  const rows = [...source.matchAll(MANIFEST_ROW_PATTERN)].map(([, state, activity, file, label]) => ({
    state,
    activity,
    file,
    label,
  }));

  if (rows.length === 0) {
    throw new Error(`No seeder rows parsed from ${MANIFEST_PATH} — the manifest shape changed.`);
  }

  return rows;
}

export function computeSeederCounts() {
  const seeders = readSeederManifest();
  const byState = new Map();
  const total = { templates: 0, checklistPoints: 0, holdPoints: 0 };

  for (const seeder of seeders) {
    const counts = countInSource(readFileSync(resolve(SEED_DIR, seeder.file), 'utf8'));
    const running = byState.get(seeder.state) ?? { templates: 0, checklistPoints: 0, holdPoints: 0, files: 0 };

    running.files += 1;
    for (const key of ['templates', 'checklistPoints', 'holdPoints']) {
      running[key] += counts[key];
      total[key] += counts[key];
    }
    byState.set(seeder.state, running);
  }

  const unknown = [...byState.keys()].filter(
    (state) => !AUTHORITIES.some((authority) => authority.state === state),
  );
  if (unknown.length > 0) {
    throw new Error(
      `Seeder manifest carries jurisdiction(s) with no public presentation: ${unknown.join(', ')}. ` +
        'Add them to AUTHORITIES and to TEMPLATE_CELLS on the landing page.',
    );
  }

  const byAuthority = AUTHORITIES.filter((authority) => byState.has(authority.state)).map(
    (authority) => ({ ...authority, ...byState.get(authority.state) }),
  );

  return { seederCount: seeders.length, byAuthority, total };
}

const TEMPLATE_CELLS_PATTERN = /const TEMPLATE_CELLS = \[([\s\S]*?)\n\];/;
const TEMPLATE_CELL_PATTERN = /\{\s*auth:\s*'([^']+)',\s*region:\s*'([^']+)',\s*n:\s*'([^']+)'\s*,?\s*\}/g;
const INLINE_CLAIM_PATTERN = /<span>([\d,]+) ITP templates · ([\d,]+) checklist points/;
const FOOT_CLAIM_PATTERN = /([\d,]+) templates · ([\d,]+) checklist points · ([\d,]+) hold points/;

function parseClaimNumber(value) {
  return Number(value.replace(/,/g, ''));
}

export function readLandingClaims() {
  const source = readFileSync(LANDING_PAGE_PATH, 'utf8');

  const cellsBlock = TEMPLATE_CELLS_PATTERN.exec(source);
  if (!cellsBlock) throw new Error('Could not locate TEMPLATE_CELLS in LandingPage.tsx.');
  const cells = [...cellsBlock[1].matchAll(TEMPLATE_CELL_PATTERN)].map(([, auth, region, n]) => ({
    auth,
    region,
    n: parseClaimNumber(n),
  }));

  const inline = INLINE_CLAIM_PATTERN.exec(source);
  if (!inline) throw new Error('Could not locate the "N ITP templates · N checklist points" claim.');

  const foot = FOOT_CLAIM_PATTERN.exec(source);
  if (!foot) throw new Error('Could not locate the "N templates · N checklist points · N hold points" claim.');

  return {
    cells,
    inline: { templates: parseClaimNumber(inline[1]), checklistPoints: parseClaimNumber(inline[2]) },
    foot: {
      templates: parseClaimNumber(foot[1]),
      checklistPoints: parseClaimNumber(foot[2]),
      holdPoints: parseClaimNumber(foot[3]),
    },
  };
}

export function compareClaims(computed = computeSeederCounts(), claimed = readLandingClaims()) {
  const problems = [];

  if (claimed.cells.length !== computed.byAuthority.length) {
    problems.push(
      `TEMPLATE_CELLS has ${claimed.cells.length} rows; the seeder library covers ${computed.byAuthority.length} authorities.`,
    );
  }

  computed.byAuthority.forEach((authority, index) => {
    const cell = claimed.cells[index];
    if (!cell) {
      problems.push(`TEMPLATE_CELLS is missing a row for ${authority.auth} (${authority.templates} templates).`);
      return;
    }
    if (cell.auth !== authority.auth || cell.region !== authority.region) {
      problems.push(
        `TEMPLATE_CELLS row ${index + 1} is "${cell.auth} / ${cell.region}"; expected "${authority.auth} / ${authority.region}".`,
      );
    }
    if (cell.n !== authority.templates) {
      problems.push(`${authority.auth}: page claims ${cell.n} templates, seeders carry ${authority.templates}.`);
    }
  });

  const expect = (label, claimedValue, computedValue) => {
    if (claimedValue !== computedValue) {
      problems.push(`${label}: page claims ${format(claimedValue)}, seeders carry ${format(computedValue)}.`);
    }
  };

  expect('Inline claim templates', claimed.inline.templates, computed.total.templates);
  expect('Inline claim checklist points', claimed.inline.checklistPoints, computed.total.checklistPoints);
  expect('Template footnote templates', claimed.foot.templates, computed.total.templates);
  expect('Template footnote checklist points', claimed.foot.checklistPoints, computed.total.checklistPoints);
  expect('Template footnote hold points', claimed.foot.holdPoints, computed.total.holdPoints);

  return { ok: problems.length === 0, problems };
}

/** Locale-independent thousands separators — CI must not change the output. */
export function format(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatReport(computed) {
  const columns = [
    ['Authority', (row) => row.auth],
    ['Region', (row) => row.region],
    ['Files', (row) => format(row.files)],
    ['Templates', (row) => format(row.templates)],
    ['Checklist points', (row) => format(row.checklistPoints)],
    ['Hold points', (row) => format(row.holdPoints)],
  ];

  const totalRow = {
    auth: 'TOTAL',
    region: '',
    files: computed.seederCount,
    ...computed.total,
  };
  const rows = [...computed.byAuthority, totalRow].map((row) => columns.map(([, read]) => read(row)));
  const widths = columns.map(([heading], index) =>
    Math.max(heading.length, ...rows.map((row) => row[index].length)),
  );

  const line = (cells) =>
    '  ' + cells.map((cell, index) => (index < 2 ? cell.padEnd(widths[index]) : cell.padStart(widths[index]))).join('  ');

  return [
    `ITP template library — computed from ${computed.seederCount} seeder files (text parse; nothing imported or executed)`,
    '',
    line(columns.map(([heading]) => heading)),
    '  ' + widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.slice(0, -1).map(line),
    '  ' + widths.map((width) => '-'.repeat(width)).join('  '),
    line(rows[rows.length - 1]),
  ].join('\n');
}

function main() {
  const computed = computeSeederCounts();
  console.log(formatReport(computed));

  const { ok, problems } = compareClaims(computed);
  console.log('');

  if (ok) {
    console.log('Landing page claims match the computed library.');
    return;
  }

  console.error('Landing page claims have drifted from the seeder library:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nUpdate frontend/src/pages/LandingPage.tsx from the table above.');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
