import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDir, '../../..');

const seeders = [
  { state: 'austroads', activity: 'baseline', file: 'seed-itp-templates-austroads.js', label: 'Austroads baseline' },
  { state: 'nsw', activity: 'earthworks', file: 'seed-itp-templates-nsw.js', label: 'NSW TfNSW earthworks' },
  { state: 'nsw', activity: 'asphalt', file: 'seed-itp-templates-nsw-asphalt.js', label: 'NSW TfNSW asphalt' },
  { state: 'nsw', activity: 'drainage', file: 'seed-itp-templates-nsw-drainage.js', label: 'NSW TfNSW drainage' },
  { state: 'nsw', activity: 'pavements', file: 'seed-itp-templates-nsw-pavements.js', label: 'NSW TfNSW pavements' },
  { state: 'nsw', activity: 'structures', file: 'seed-itp-templates-nsw-structures.js', label: 'NSW TfNSW structures' },
  { state: 'nsw', activity: 'environmental', file: 'seed-itp-templates-nsw-environmental.js', label: 'NSW TfNSW environmental' },
  { state: 'nsw', activity: 'road-furniture', file: 'seed-itp-templates-nsw-road-furniture.js', label: 'NSW TfNSW road furniture' },
  { state: 'qld', activity: 'earthworks', file: 'seed-itp-templates-qld-earthworks.js', label: 'QLD TMR earthworks' },
  { state: 'qld', activity: 'asphalt', file: 'seed-itp-templates-qld-asphalt.js', label: 'QLD TMR asphalt' },
  { state: 'qld', activity: 'drainage', file: 'seed-itp-templates-qld-drainage.js', label: 'QLD TMR drainage' },
  { state: 'qld', activity: 'environmental', file: 'seed-itp-templates-qld-environmental.js', label: 'QLD TMR environmental' },
  { state: 'qld', activity: 'pavements', file: 'seed-itp-templates-qld-pavements.js', label: 'QLD TMR pavements' },
  { state: 'qld', activity: 'conduits', file: 'seed-itp-templates-qld-conduits.js', label: 'QLD TMR conduits' },
  { state: 'qld', activity: 'road-furniture', file: 'seed-itp-templates-qld-road-furniture.js', label: 'QLD TMR road furniture' },
  { state: 'qld', activity: 'structures', file: 'seed-itp-templates-qld-structures.js', label: 'QLD TMR structures' },
  { state: 'sa', activity: 'earthworks', file: 'seed-itp-templates-sa-earthworks.js', label: 'SA DIT earthworks' },
  { state: 'sa', activity: 'asphalt', file: 'seed-itp-templates-sa-asphalt.js', label: 'SA DIT asphalt' },
  { state: 'sa', activity: 'seals', file: 'seed-itp-templates-sa-seals.js', label: 'SA DIT sprayed seals' },
  { state: 'sa', activity: 'drainage', file: 'seed-itp-templates-sa-drainage.js', label: 'SA DIT drainage' },
  { state: 'sa', activity: 'environmental', file: 'seed-itp-templates-sa-environmental.js', label: 'SA DIT environmental' },
  { state: 'sa', activity: 'pavements', file: 'seed-itp-templates-sa-pavements.js', label: 'SA DIT pavements' },
  { state: 'sa', activity: 'conduits', file: 'seed-itp-templates-sa-conduits.js', label: 'SA DIT conduits' },
  { state: 'sa', activity: 'road-furniture', file: 'seed-itp-templates-sa-road-furniture.js', label: 'SA DIT road furniture' },
  { state: 'sa', activity: 'structures', file: 'seed-itp-templates-sa-structures.js', label: 'SA DIT structures' },
  { state: 'vic', activity: 'earthworks', file: 'seed-itp-templates-vic-earthworks.js', label: 'VIC VicRoads earthworks' },
  { state: 'vic', activity: 'asphalt', file: 'seed-itp-templates-vic-asphalt.js', label: 'VIC VicRoads asphalt' },
  { state: 'vic', activity: 'drainage', file: 'seed-itp-templates-vic-drainage.js', label: 'VIC VicRoads drainage' },
  { state: 'vic', activity: 'environmental', file: 'seed-itp-templates-vic-environmental.js', label: 'VIC VicRoads environmental' },
  { state: 'vic', activity: 'pavements', file: 'seed-itp-templates-vic-pavements.js', label: 'VIC VicRoads pavements' },
  { state: 'vic', activity: 'road-furniture', file: 'seed-itp-templates-vic-road-furniture.js', label: 'VIC VicRoads road furniture' },
  { state: 'vic', activity: 'structures', file: 'seed-itp-templates-vic-structures.js', label: 'VIC VicRoads structures' },
  { state: 'vic', activity: 'conduits', file: 'seed-itp-templates-vic-conduits.js', label: 'VIC VicRoads conduits' },
  { state: 'national', activity: 'flatwork', file: 'seed-itp-templates-national-flatwork.js', label: 'National AUS-SPEC concrete flatwork' },
  { state: 'national', activity: 'utilities', file: 'seed-itp-templates-national-utilities.js', label: 'National WSA water & sewer utilities' },
  { state: 'wa', activity: 'earthworks', file: 'seed-itp-templates-wa-earthworks.js', label: 'WA Main Roads WA earthworks' },
  { state: 'wa', activity: 'pavements', file: 'seed-itp-templates-wa-pavements.js', label: 'WA Main Roads WA pavements' },
  { state: 'wa', activity: 'surfacing', file: 'seed-itp-templates-wa-surfacing.js', label: 'WA Main Roads WA bituminous surfacing' },
  { state: 'wa', activity: 'drainage', file: 'seed-itp-templates-wa-drainage.js', label: 'WA Main Roads WA drainage & kerbing' },
  { state: 'wa', activity: 'structures', file: 'seed-itp-templates-wa-structures.js', label: 'WA Main Roads WA structures' },
];

function parseCsv(value) {
  return new Set(
    value
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseArgs(argv) {
  const options = {
    execute: false,
    list: false,
    supersede: false,
    states: null,
    activities: null,
    scripts: null,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--supersede') {
      options.supersede = true;
    } else if (arg.startsWith('--state=')) {
      options.states = parseCsv(arg.slice('--state='.length));
    } else if (arg.startsWith('--activity=')) {
      options.activities = parseCsv(arg.slice('--activity='.length));
    } else if (arg.startsWith('--script=')) {
      options.scripts = parseCsv(arg.slice('--script='.length));
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function selectSeeders(options) {
  return seeders.filter((seeder) => {
    if (options.states && !options.states.has(seeder.state)) return false;
    if (options.activities && !options.activities.has(seeder.activity)) return false;
    if (options.scripts && !options.scripts.has(seeder.file.toLowerCase())) return false;
    return true;
  });
}

function printHelp() {
  console.log(`Usage: pnpm seed:itp -- [options]

Options:
  --list                    List selected seeders and exit.
  --execute                 Run selected seeders. Without this flag, this is a dry run.
  --supersede               Push a spec revision INTO the library: where a seeder's
                            provenance names a different spec edition than the row
                            already in the database, create the new edition as a NEW
                            template and mark the old one superseded. Existing project
                            ITP instances keep their snapshots untouched. Operator-only
                            — there is no API route for this. Requires --execute.
  --state=<csv>             Filter by state: austroads, nsw, qld, sa, vic, wa, national.
  --activity=<csv>          Filter by activity: baseline, earthworks, asphalt, seals, surfacing,
                            drainage, environmental, pavements, conduits, road-furniture, structures,
                            flatwork, utilities.
  --script=<csv>            Filter by exact seeder filename.
  --help                    Show this help.

Examples:
  pnpm seed:itp -- --list
  pnpm seed:itp -- --state=qld --activity=structures
  pnpm seed:itp -- --state=qld --activity=structures --execute
`);
}

function printSelection(selected) {
  console.log(`Selected ${selected.length} ITP template seeder(s):`);
  for (const seeder of selected) {
    console.log(`- ${seeder.state}/${seeder.activity}: ${seeder.file} (${seeder.label})`);
  }
}

function runSeeder(seeder, childEnv) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(scriptDir, seeder.file)], {
      cwd: backendRoot,
      env: childEnv,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${seeder.file} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`));
    });
  });
}

async function execute(selected, options) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: resolve(backendRoot, '.env') });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to execute ITP template seeders.');
  }

  // Wave G G2 §2.2(f): the seeders are spawned as separate processes, so the
  // supersede mode and the run label reach them through the environment. A
  // seeder invoked directly (`node seed-itp-templates-x.js`) sees neither and
  // keeps its create-once behaviour.
  const runLabel = `itp-seed-${new Date().toISOString()}`;
  const childEnv = options.supersede
    ? { ...process.env, ITP_SEED_SUPERSEDE: '1', ITP_SEED_RUN_LABEL: runLabel }
    : process.env;

  if (options.supersede) {
    console.log(`\nSupersede mode. Run label: ${runLabel}`);
    console.log(
      'A template whose seeder names a NEW spec edition will be re-created and the old row retired.',
    );
    console.log('Existing project ITP instances keep their snapshots — nothing is rewritten.');
  }

  for (const seeder of selected) {
    console.log(`\n=== Running ${seeder.file} ===`);
    await runSeeder(seeder, childEnv);
  }

  console.log(`\nCompleted ${selected.length} ITP template seeder(s).`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selected = selectSeeders(options);

  if (selected.length === 0) {
    throw new Error('No ITP template seeders matched the supplied filters.');
  }

  printSelection(selected);

  if (options.list) {
    return;
  }

  if (!options.execute) {
    if (options.supersede) {
      console.log('\n--supersede requires --execute. Nothing was written.');
    }
    console.log('\nDry run only. Add --execute to write global ITP templates to the configured database.');
    return;
  }

  await execute(selected, options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
