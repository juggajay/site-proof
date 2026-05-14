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
  { state: 'qld', activity: 'earthworks', file: 'seed-itp-templates-qld-earthworks.js', label: 'QLD TMR earthworks' },
  { state: 'qld', activity: 'asphalt', file: 'seed-itp-templates-qld-asphalt.js', label: 'QLD TMR asphalt' },
  { state: 'qld', activity: 'drainage', file: 'seed-itp-templates-qld-drainage.js', label: 'QLD TMR drainage' },
  { state: 'qld', activity: 'environmental', file: 'seed-itp-templates-qld-environmental.js', label: 'QLD TMR environmental' },
  { state: 'qld', activity: 'pavements', file: 'seed-itp-templates-qld-pavements.js', label: 'QLD TMR pavements' },
  { state: 'qld', activity: 'road-furniture', file: 'seed-itp-templates-qld-road-furniture.js', label: 'QLD TMR road furniture' },
  { state: 'qld', activity: 'structures', file: 'seed-itp-templates-qld-structures.js', label: 'QLD TMR structures' },
  { state: 'sa', activity: 'earthworks', file: 'seed-itp-templates-sa-earthworks.js', label: 'SA DIT earthworks' },
  { state: 'sa', activity: 'asphalt', file: 'seed-itp-templates-sa-asphalt.js', label: 'SA DIT asphalt' },
  { state: 'sa', activity: 'drainage', file: 'seed-itp-templates-sa-drainage.js', label: 'SA DIT drainage' },
  { state: 'sa', activity: 'environmental', file: 'seed-itp-templates-sa-environmental.js', label: 'SA DIT environmental' },
  { state: 'sa', activity: 'pavements', file: 'seed-itp-templates-sa-pavements.js', label: 'SA DIT pavements' },
  { state: 'sa', activity: 'road-furniture', file: 'seed-itp-templates-sa-road-furniture.js', label: 'SA DIT road furniture' },
  { state: 'sa', activity: 'structures', file: 'seed-itp-templates-sa-structures.js', label: 'SA DIT structures' },
  { state: 'vic', activity: 'earthworks', file: 'seed-itp-templates-vic-earthworks.js', label: 'VIC VicRoads earthworks' },
  { state: 'vic', activity: 'asphalt', file: 'seed-itp-templates-vic-asphalt.js', label: 'VIC VicRoads asphalt' },
  { state: 'vic', activity: 'drainage', file: 'seed-itp-templates-vic-drainage.js', label: 'VIC VicRoads drainage' },
  { state: 'vic', activity: 'environmental', file: 'seed-itp-templates-vic-environmental.js', label: 'VIC VicRoads environmental' },
  { state: 'vic', activity: 'pavements', file: 'seed-itp-templates-vic-pavements.js', label: 'VIC VicRoads pavements' },
  { state: 'vic', activity: 'road-furniture', file: 'seed-itp-templates-vic-road-furniture.js', label: 'VIC VicRoads road furniture' },
  { state: 'vic', activity: 'structures', file: 'seed-itp-templates-vic-structures.js', label: 'VIC VicRoads structures' },
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
    states: null,
    activities: null,
    scripts: null,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--list') {
      options.list = true;
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
  --state=<csv>             Filter by state: austroads, nsw, qld, sa, vic.
  --activity=<csv>          Filter by activity: baseline, earthworks, asphalt, drainage,
                            environmental, pavements, road-furniture, structures.
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

function runSeeder(seeder) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(scriptDir, seeder.file)], {
      cwd: backendRoot,
      env: process.env,
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

async function execute(selected) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: resolve(backendRoot, '.env') });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to execute ITP template seeders.');
  }

  for (const seeder of selected) {
    console.log(`\n=== Running ${seeder.file} ===`);
    await runSeeder(seeder);
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
    console.log('\nDry run only. Add --execute to write global ITP templates to the configured database.');
    return;
  }

  await execute(selected);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
