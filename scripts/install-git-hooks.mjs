import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const hookMarker = '# siteproof-managed-precommit'
const hookBody = `#!/usr/bin/env sh
${hookMarker}
npm run precommit
`

const gitPathResult = spawnSync('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
})

if (gitPathResult.status !== 0) {
  console.log('Skipping pre-commit hook install: git metadata not found.')
  process.exit(0)
}

const preCommitPath = resolve(gitPathResult.stdout.trim())
const hooksDir = dirname(preCommitPath)

mkdirSync(hooksDir, { recursive: true })

if (existsSync(preCommitPath)) {
  const existing = readFileSync(preCommitPath, 'utf8')
  if (!existing.includes(hookMarker)) {
    console.log('Skipping pre-commit hook install: unmanaged .git/hooks/pre-commit already exists.')
    process.exit(0)
  }
}

writeFileSync(preCommitPath, hookBody, 'utf8')
chmodSync(preCommitPath, 0o755)
console.log('Installed SiteProof pre-commit hook.')
