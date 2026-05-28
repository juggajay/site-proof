import { spawnSync } from 'node:child_process'

const relevantExtensions = {
  backendCode: ['.ts', '.js', '.mjs', '.cjs'],
  backendFormat: ['.ts', '.css', '.json'],
  frontendCode: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
  frontendFormat: ['.ts', '.tsx', '.css', '.json', '.js', '.mjs'],
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const getStagedFiles = () => {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  return result.stdout
    .split('\n')
    .map((file) => file.trim().replaceAll('\\', '/'))
    .filter(Boolean)
}

const hasMatchingFile = (files, prefix, extensions) =>
  files.some((file) => file.startsWith(prefix) && extensions.some((extension) => file.endsWith(extension)))

const stagedFiles = getStagedFiles()

if (stagedFiles.length === 0) {
  console.log('No staged files to check.')
  process.exit(0)
}

const commands = []

if (hasMatchingFile(stagedFiles, 'backend/', relevantExtensions.backendCode)) {
  commands.push(['npm', ['--prefix', 'backend', 'run', 'lint']])
}

if (hasMatchingFile(stagedFiles, 'backend/', relevantExtensions.backendFormat)) {
  commands.push(['npm', ['--prefix', 'backend', 'run', 'format:check']])
}

if (hasMatchingFile(stagedFiles, 'frontend/', relevantExtensions.frontendCode)) {
  commands.push(['npm', ['--prefix', 'frontend', 'run', 'lint']])
}

if (hasMatchingFile(stagedFiles, 'frontend/', relevantExtensions.frontendFormat)) {
  commands.push(['npm', ['--prefix', 'frontend', 'run', 'format:check']])
}

if (commands.length === 0) {
  console.log('No frontend/backend staged files require pre-commit checks.')
  process.exit(0)
}

for (const [command, args] of commands) {
  run(command, args)
}
