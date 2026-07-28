/**
 * Wave D `D1c.0` — the cost model (spec
 * `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.5.6). **AT-150.**
 *
 * Prices one full-project archive on the program's reference dataset (§12: 5,000
 * lots, 50 GB evidence) against **J8's ceiling of AUD 12.00 ex-GST**, per leg,
 * for one generation plus three downloads within the retention window.
 *
 * THE CEILING IS NOT THIS SCRIPT'S TO MOVE. §16.1 J8: "This is Jay's number, not
 * engineering's, and it is the one decision in this spec that a build agent may
 * not make." If the total is above it, the output says so and names which of the
 * three §4.5.6 fixes the numbers point at. It does not choose one.
 *
 * EVERY RATE IS PUBLISHED, CITED AND DATED (`RATES` below). Nothing is
 * estimated, inferred from a blog post, or averaged. Where a vendor publishes no
 * rate — Railway ingress, Supabase ingress — the gap is recorded as `null` with
 * `notPublished`, and modelled at zero with that assumption stated, rather than
 * guessed at.
 *
 * WHY THE NAIVE MODEL IS WRONG BY ~3x, and it is not a subtlety:
 *   - Railway bills SERVICE EGRESS on bytes a service pushes TO object storage.
 *     An upload is a billed transfer, not a free one.
 *   - A backend-mediated download is TWO billed transfers, not one: Supabase
 *     egress to the Railway service, then Railway egress to the browser.
 *   - Spec §10.2 REQUIRES that path — "No public link, no Supabase signed URL,
 *     no email attachment" — so the double transfer is a security requirement,
 *     not an implementation choice. The cheap alternative is modelled below as
 *     `signedUrlDirect` and is labelled for what it is: a §10.2 amendment and a
 *     threat-model revisit, i.e. not an engineering call.
 *
 * The archive/evidence ratio comes from the MEASURED compression ratio on the
 * §4.5.3 mix in the writer benchmark, read out of its results file — this script
 * does not invent a compression assumption.
 *
 * Run:
 *   cd backend
 *   node scripts/bench-zip-cost.mjs                       # newest zip-spike results
 *   node scripts/bench-zip-cost.mjs --spike=<results.json>
 * Flags: --retention-days=30,90  --out=PATH  --no-write
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..');
const RESULTS_DIR = path.join(HERE, 'bench-results');

// ---------------------------------------------------------------------------
// Published rates. Read 2026-07-29. USD unless stated.
// ---------------------------------------------------------------------------

const READ_ON = '2026-07-29';

const RATES = Object.freeze({
  railwayEgressPerGb: {
    usd: 0.05,
    url: 'https://docs.railway.com/pricing/understanding-your-bill',
    quote: 'Network egress (outbound data transfer) is charged at $0.05/GB.',
    readOn: READ_ON,
  },
  railwayUploadCountsAsEgress: {
    url: 'https://docs.railway.com/storage-buckets/billing',
    quote:
      'Note that service egress is not free. If your service sends data to users or uploads files to a bucket, that traffic counts as service egress.',
    readOn: READ_ON,
  },
  railwayIngressPerGb: {
    usd: null,
    notPublished:
      'Railway publishes no ingress rate and no "ingress is free" statement; the billable-resource list is vCPU, memory, volumes and network egress only. Modelled at 0 with that assumption stated, not asserted as free.',
    url: 'https://docs.railway.com/pricing/understanding-your-bill',
    readOn: READ_ON,
  },
  railwayVcpuPerMonth: {
    usd: 20,
    url: 'https://docs.railway.com/reference/pricing',
    quote: '$20 / vCPU / month ($0.000463 / vCPU / minute)',
    readOn: READ_ON,
  },
  railwayRamGbPerMonth: {
    usd: 10,
    url: 'https://docs.railway.com/reference/pricing',
    quote: '$10 / GB / month ($0.000231 / GB / minute)',
    readOn: READ_ON,
  },
  supabaseStoragePerGbMonth: {
    usd: 0.0213,
    plan: 'Pro',
    included: '100 GB',
    url: 'https://supabase.com/pricing',
    quote: '100 GB included, then $0.0213 per GB',
    readOn: READ_ON,
  },
  supabaseEgressUncachedPerGb: {
    usd: 0.09,
    plan: 'Pro',
    included: '250 GB',
    url: 'https://supabase.com/docs/guides/platform/manage-your-usage/egress',
    quote: '$0.09 per GB per month for uncached egress, $0.03 per GB per month for cached egress',
    readOn: READ_ON,
  },
  supabaseEgressCachedPerGb: {
    usd: 0.03,
    plan: 'Pro',
    included: '250 GB',
    url: 'https://supabase.com/pricing',
    quote: '250 GB included, then $0.03 per GB',
    readOn: READ_ON,
  },
  supabaseIngressPerGb: {
    usd: null,
    notPublished:
      'Supabase publishes no ingress/upload charge and no explicit "ingress is free" statement. Modelled at 0 with that assumption stated.',
    url: 'https://supabase.com/pricing',
    readOn: READ_ON,
  },
  audPerUsd: {
    // AUD -> USD. Divide a USD figure by this to get AUD.
    rate: 0.69685,
    asAt: '2026-07-28',
    url: 'https://api.frankfurter.dev/v1/latest?base=AUD&symbols=USD',
    note: 'ECB-derived reference rate. 2026-07-28 close; no 2026-07-29 rate was published at the time of reading. Cross-checked against https://tradingeconomics.com/australia/currency (0.6968).',
    readOn: READ_ON,
  },
});

/**
 * Supabase upload-path limits, for the §4.5.3 `upload_protocol_limit` term.
 * Recorded here because the spec's figure is STALE and the cap decision turns on it.
 */
const UPLOAD_LIMITS = Object.freeze({
  standardUpload: {
    maxBytes: 5 * 1000 ** 3,
    stated: '5 GB',
    url: 'https://supabase.com/docs/guides/storage/uploads/standard-uploads',
    quote:
      'Though you can upload up to 5GB files using the standard upload method, we recommend using TUS Resumable Upload for uploading files greater than 6MB in size for better reliability.',
    readOn: READ_ON,
  },
  resumableAndS3: {
    maxBytes: 500 * 1000 ** 3,
    stated: '500 GB on Pro and above',
    url: 'https://supabase.com/docs/guides/storage/uploads/file-limits',
    quote: 'On the Pro Plan and up, you can set this value to up to 500 GB.',
    readOn: READ_ON,
    correctsSpec:
      "Spec §4.5.3 says 'TUS/S3 paths reach 50 GB'. That is OUT OF DATE. Supabase raised the ceiling to 500 GB (https://supabase.com/blog/storage-500gb-uploads-cheaper-egress-pricing, 2025-07-18: 'Increasing the maximum file size to 500 GB, up from 50 GB') and the s3-uploads guide now states 500 GB. The 50 GB figure survives only on a stale troubleshooting page (https://supabase.com/docs/guides/troubleshooting/upload-file-size-restrictions-Y4wQLT), which contradicts both. The upload-protocol limb of the cap formula is therefore NOT the binding constraint it was assumed to be.",
    isPlanSetting:
      'It is a configurable global Storage setting capped by plan, not a hard product limit — Free 50 MB, Pro/Team 500 GB, Enterprise custom, and above 500 GB requires contacting Supabase.',
  },
});

// ---------------------------------------------------------------------------
// The reference dataset — spec §12
// ---------------------------------------------------------------------------

const REFERENCE = Object.freeze({
  lots: 5000,
  evidenceGb: 50, // decimal GB, matching how both vendors bill "per GB"
  source: 'docs/plans/wave-d-handover-spec-2026-07-28.md §12 (program §8 lines 138-139)',
  downloadsInCeiling: 3,
  ceilingWording:
    'a full-project archive on the program\'s reference dataset must cost CIVOS <= AUD 12.00 ex-GST all-in for one generation plus three downloads within the retention window',
  unitNote:
    'Cost arithmetic uses DECIMAL GB because that is the unit both vendors bill in. The §4.5.3 cap formula uses BINARY GiB as the spec directs. The two are kept separate and converted explicitly, never conflated.',
});

const CEILING_AUD = 12.0;

const usdToAud = (usd) => usd / RATES.audPerUsd.rate;
const round = (n, dp = 4) => Number(n.toFixed(dp));

// ---------------------------------------------------------------------------
// The leg model
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {number} p.evidenceGb          bytes read out of storage
 * @param {number} p.archiveGb           bytes written back (measured ratio applied)
 * @param {number} p.retentionDays
 * @param {number} p.downloads
 * @param {'backendMediated'|'signedUrlDirect'} p.deliveryPath
 * @param {'cached'|'uncached'} p.downloadCacheAssumption
 * @param {object} p.compute             { seconds, vcpu, ramGb }
 */
function priceLegs(p) {
  const months = p.retentionDays / 30.437; // mean Gregorian month
  const dl = p.downloadCacheAssumption === 'cached'
    ? RATES.supabaseEgressCachedPerGb.usd
    : RATES.supabaseEgressUncachedPerGb.usd;

  const legs = [];

  legs.push({
    leg: 'original-reads',
    what: `worker reads ${p.evidenceGb} GB of evidence objects out of Supabase Storage`,
    gb: p.evidenceGb,
    billedBy: 'Supabase (uncached egress) + Railway ingress',
    // A one-off archive read of cold objects is a CDN miss. Modelling it at the
    // cached rate would be the optimistic assumption §4.5.6 warns against.
    rateUsdPerGb: RATES.supabaseEgressUncachedPerGb.usd,
    usd: p.evidenceGb * RATES.supabaseEgressUncachedPerGb.usd,
    note: 'Uncached: an archive read is a one-off pull of cold objects, not a CDN-warm read. Railway ingress modelled at 0 (not published).',
  });

  legs.push({
    leg: 'archive-upload',
    what: `worker pushes the ${round(p.archiveGb, 1)} GB archive to Supabase Storage`,
    gb: p.archiveGb,
    billedBy: 'Railway (service egress). Supabase ingress not published, modelled 0.',
    rateUsdPerGb: RATES.railwayEgressPerGb.usd,
    usd: p.archiveGb * RATES.railwayEgressPerGb.usd,
    note: 'THE LEG THE NAIVE MODEL DROPS. Railway bills a service for bytes it uploads to a bucket.',
  });

  legs.push({
    leg: 'storage-retention',
    what: `${round(p.archiveGb, 1)} GB held for ${p.retentionDays} days`,
    gb: p.archiveGb,
    billedBy: 'Supabase Storage',
    rateUsdPerGb: RATES.supabaseStoragePerGbMonth.usd,
    usd: p.archiveGb * RATES.supabaseStoragePerGbMonth.usd * months,
    note: `§10.5 sets a TTL but names no number ("default conservative, configurable per project"). ${p.retentionDays} days is a DECLARED MODELLING ASSUMPTION, not a spec value.`,
  });

  const perDownloadUsd =
    p.deliveryPath === 'backendMediated'
      ? p.archiveGb * (dl + RATES.railwayEgressPerGb.usd)
      : p.archiveGb * dl;

  for (let i = 1; i <= p.downloads; i += 1) {
    legs.push({
      leg: i === 1 ? 'download-first' : `download-${i}`,
      what:
        p.deliveryPath === 'backendMediated'
          ? `${round(p.archiveGb, 1)} GB Supabase -> Railway -> browser (two billed transfers)`
          : `${round(p.archiveGb, 1)} GB Supabase -> browser (one billed transfer)`,
      gb: p.archiveGb,
      billedBy:
        p.deliveryPath === 'backendMediated'
          ? `Supabase (${p.downloadCacheAssumption} egress) AND Railway (service egress)`
          : `Supabase (${p.downloadCacheAssumption} egress)`,
      rateUsdPerGb:
        p.deliveryPath === 'backendMediated' ? dl + RATES.railwayEgressPerGb.usd : dl,
      usd: perDownloadUsd,
      note:
        p.deliveryPath === 'backendMediated'
          ? 'Spec §10.2 requires this path: "No public link, no Supabase signed URL, no email attachment." The double transfer is a SECURITY REQUIREMENT, not an implementation choice.'
          : 'Requires amending §10.2. Modelled for comparison only.',
    });
  }

  const hours = p.compute.seconds / 3600;
  legs.push({
    leg: 'compute',
    what: `${Math.round(p.compute.seconds)} s of archive job at ${p.compute.vcpu} vCPU / ${p.compute.ramGb} GB RAM`,
    gb: null,
    billedBy: 'Railway (vCPU + memory, metered per second)',
    rateUsdPerGb: null,
    usd:
      hours * p.compute.vcpu * (RATES.railwayVcpuPerMonth.usd / 730) +
      hours * p.compute.ramGb * (RATES.railwayRamGbPerMonth.usd / 730),
    note: '730 h/month. Wall clock extrapolated from the measured writer throughput; RAM from the measured peak RSS.',
  });

  const totalUsd = legs.reduce((n, l) => n + l.usd, 0);
  return {
    legs: legs.map((l) => ({ ...l, usd: round(l.usd), aud: round(usdToAud(l.usd)) })),
    totalUsd: round(totalUsd),
    totalAud: round(usdToAud(totalUsd), 2),
  };
}

/** The largest evidence payload that fits the ceiling on a given path. */
function capThatFits(p) {
  const at50 = priceLegs({ ...p, evidenceGb: 50, archiveGb: 50 * p.ratio });
  const audPerEvidenceGb = (at50.totalAud - usdToAud(at50.legs.at(-1).usd)) / 50;
  return round(CEILING_AUD / audPerEvidenceGb, 1);
}

// ---------------------------------------------------------------------------

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

function newestSpike() {
  const files = fs
    .readdirSync(RESULTS_DIR)
    .filter((f) => f.startsWith('zip-spike-') && f.endsWith('.json'))
    .sort();
  if (!files.length) throw new Error('no zip-spike results found — run bench-zip-spike.mjs first');
  return path.join(RESULTS_DIR, files[files.length - 1]);
}

// Lazy: `arg('spike', newestSpike())` would evaluate the default eagerly and
// throw "no results found" even when --spike was supplied.
const spikePath = path.resolve(arg('spike', null) ?? newestSpike());
const spike = JSON.parse(fs.readFileSync(spikePath, 'utf8'));

// The compression ratio is MEASURED, on the §4.5.3 mix, in the writer benchmark.
const ratios = (spike.compressionRatioOnFixture2Mix ?? []).filter((r) => r.ratio);
if (!ratios.length) throw new Error(`${spikePath} carries no measured compression ratio`);
// Worst (least favourable) measured ratio — the honest one for a headroom margin.
const ratio = Math.max(...ratios.map((r) => r.ratio));

// Throughput and peak RSS, taken from the largest completed leg of whichever
// candidates the spike found selectable (or all of them, if none was).
const pool = spike.results.filter((r) => r.selectable).length
  ? spike.results.filter((r) => r.selectable)
  : spike.results;
const throughputs = pool
  .map((r) => r.raw?.legs?.['total-8gib'])
  .filter((l) => l && !l.error && l.bytesOut && l.wallClockMs)
  .map((l) => ({ mbPerS: l.bytesOut / 1e6 / (l.wallClockMs / 1000), rssGb: l.rssMiB.max / 1024 }));
if (!throughputs.length) throw new Error('no completed 8 GiB leg to extrapolate throughput from');
const slowest = throughputs.reduce((a, b) => (a.mbPerS <= b.mbPerS ? a : b));

const archiveGb = REFERENCE.evidenceGb * ratio;
const compute = {
  seconds: (archiveGb * 1000) / slowest.mbPerS,
  vcpu: 1,
  ramGb: round(Math.max(0.25, slowest.rssGb), 3),
  basis: `slowest selectable candidate on the 8 GiB leg: ${round(slowest.mbPerS, 1)} MB/s, peak RSS ${round(slowest.rssGb * 1024, 1)} MiB; vCPU modelled at 1 fully utilised (deflate is CPU-bound)`,
};

const retentionDays = arg('retention-days', '30,90')
  .split(',')
  .map(Number)
  .filter((n) => n > 0);

const scenarios = [];
for (const days of retentionDays) {
  const base = {
    evidenceGb: REFERENCE.evidenceGb,
    archiveGb,
    retentionDays: days,
    downloads: REFERENCE.downloadsInCeiling,
    compute,
    ratio,
  };
  scenarios.push({
    id: `as-specified-${days}d`,
    deliveryPath: 'backendMediated',
    downloadCacheAssumption: 'uncached',
    compliesWithSpec: '§10.2 and §4.7.4 as written',
    ...priceLegs({ ...base, deliveryPath: 'backendMediated', downloadCacheAssumption: 'uncached' }),
  });
  scenarios.push({
    id: `signed-url-direct-uncached-${days}d`,
    deliveryPath: 'signedUrlDirect',
    downloadCacheAssumption: 'uncached',
    compliesWithSpec:
      'NO — requires amending §10.2 ("No public link, no Supabase signed URL") and re-running the D1b threat model. A commercial/security decision, not an engineering one.',
    ...priceLegs({ ...base, deliveryPath: 'signedUrlDirect', downloadCacheAssumption: 'uncached' }),
  });
  scenarios.push({
    id: `signed-url-direct-cached-${days}d`,
    deliveryPath: 'signedUrlDirect',
    downloadCacheAssumption: 'cached',
    compliesWithSpec:
      'NO — as above, and additionally assumes every download is a CDN cache HIT, which is the most optimistic reading of the published rates.',
    ...priceLegs({ ...base, deliveryPath: 'signedUrlDirect', downloadCacheAssumption: 'cached' }),
  });
}

const headline = scenarios.find((s) => s.id === `as-specified-${retentionDays[0]}d`);
const overBy = round(headline.totalAud / CEILING_AUD, 2);

// The floor: generation only, zero downloads. If THIS is already over the
// ceiling, no delivery-path change can rescue the 50 GB reference dataset.
const floor = priceLegs({
  evidenceGb: REFERENCE.evidenceGb,
  archiveGb,
  retentionDays: retentionDays[0],
  downloads: 0,
  deliveryPath: 'backendMediated',
  downloadCacheAssumption: 'uncached',
  compute,
});

const caps = Object.fromEntries(
  scenarios
    .filter((s) => s.id.endsWith(`${retentionDays[0]}d`))
    .map((s) => [
      s.id,
      capThatFits({
        archiveGb,
        ratio,
        retentionDays: retentionDays[0],
        downloads: REFERENCE.downloadsInCeiling,
        deliveryPath: s.deliveryPath,
        downloadCacheAssumption: s.downloadCacheAssumption,
        compute,
      }),
    ]),
);

const report = {
  benchmark: 'wave-d/D1c.0 archive cost model',
  spec: 'docs/plans/wave-d-handover-spec-2026-07-28.md Rev 3 §4.5.6, §12, §16.1 J8',
  acceptanceTest: 'AT-150 (cost reported per leg)',
  generatedAt: new Date().toISOString(),
  spikeResults: path.relative(BACKEND_ROOT, spikePath).replace(/\\/g, '/'),
  ceiling: {
    audExGst: CEILING_AUD,
    wording: REFERENCE.ceilingWording,
    owner: 'Jay (J8). Declared before measurement. A build agent may not move it.',
  },
  reference: REFERENCE,
  rates: RATES,
  uploadLimits: UPLOAD_LIMITS,
  measuredInputs: {
    compressionRatioOnFixture2Mix: ratio,
    compressionRatioPerCandidate: ratios,
    archiveGb: round(archiveGb, 2),
    compute,
  },
  scenarios,
  generationOnlyFloor: {
    ...floor,
    meaning:
      'Read + upload + storage, ZERO downloads, on the spec-compliant path. This is the irreducible cost of producing the artefact at all.',
  },
  capThatFitsTheCeilingGbEvidence: caps,
  verdict: {
    headlineScenario: headline.id,
    totalAud: headline.totalAud,
    ceilingAud: CEILING_AUD,
    pass: headline.totalAud <= CEILING_AUD,
    overCeilingByFactor: overBy,
    generationOnlyFloorAud: floor.totalAud,
    floorAlreadyOverCeiling: floor.totalAud > CEILING_AUD,
    theThreeFixes:
      '§4.5.6 names three, all Jay decisions: (1) a lower cap, (2) a cheaper delivery path, (3) a priced add-on. This script reports which the numbers point at. It does not choose.',
  },
};

const line = (s) => process.stdout.write(`${s}\n`);
line('');
line(`Wave D D1c.0 — archive cost model   reference: ${REFERENCE.lots} lots / ${REFERENCE.evidenceGb} GB evidence`);
line(`measured compression ratio (§4.5.3 mix): ${ratio}  ->  archive ${round(archiveGb, 1)} GB`);
line('');
line('leg                     GB      rate            USD       AUD');
for (const l of headline.legs)
  line(
    [
      l.leg.padEnd(23),
      (l.gb === null ? '—' : String(round(l.gb, 1))).padEnd(7),
      (l.rateUsdPerGb === null ? 'cpu+ram' : `$${l.rateUsdPerGb}/GB`).padEnd(15),
      `$${l.usd.toFixed(2)}`.padEnd(9),
      `A$${l.aud.toFixed(2)}`,
    ].join(' '),
  );
line(`${''.padEnd(23)} ${''.padEnd(7)} ${'TOTAL'.padEnd(15)} $${headline.totalUsd.toFixed(2)}  A$${headline.totalAud.toFixed(2)}`);
line('');
line(`CEILING (J8): A$${CEILING_AUD.toFixed(2)} ex-GST    MEASURED: A$${headline.totalAud.toFixed(2)}    ${headline.totalAud <= CEILING_AUD ? 'PASS' : `FAIL — ${overBy}x over`}`);
line(`generation-only floor (0 downloads): A$${floor.totalAud.toFixed(2)}${floor.totalAud > CEILING_AUD ? '  — ALREADY OVER THE CEILING' : ''}`);
line('');
for (const [id, cap] of Object.entries(caps)) line(`cap that fits A$12.00 on ${id}: ${cap} GB of evidence`);
line('');

if (!process.argv.includes('--no-write')) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  const out = arg('out', path.join(RESULTS_DIR, `zip-cost-${stamp}.json`));
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  line(`results: ${path.relative(BACKEND_ROOT, out).replace(/\\/g, '/')}`);
}
