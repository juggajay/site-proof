import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const preCommitMarker = '# siteproof-managed-precommit'
const preCommitBody = `#!/usr/bin/env sh
${preCommitMarker}
npm run precommit
`

// master has no server-side branch protection (private repo, free plan), so
// every clone gets a local guard instead. PR merges happen server-side via
// the GitHub API and are unaffected. Escape hatch for genuine emergencies:
// SITEPROOF_ALLOW_MASTER_PUSH=1 git push ...
const prePushMarker = '# siteproof-managed-prepush'
const prePushBody = `#!/usr/bin/env sh
${prePushMarker}
if [ "$SITEPROOF_ALLOW_MASTER_PUSH" = "1" ]; then
  exit 0
fi
while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_ref" = "refs/heads/master" ]; then
    echo "Blocked: direct pushes to master are not allowed." >&2
    echo "Open a PR and merge after CI passes." >&2
    echo "Emergency override: SITEPROOF_ALLOW_MASTER_PUSH=1 git push ..." >&2
    exit 1
  fi
done
exit 0
`

function installHook(hookFile, marker, body, label) {
  const gitPathResult = spawnSync('git', ['rev-parse', '--git-path', `hooks/${hookFile}`], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  if (gitPathResult.status !== 0) {
    console.log(`Skipping ${label} hook install: git metadata not found.`)
    return
  }

  const hookPath = resolve(gitPathResult.stdout.trim())

  mkdirSync(dirname(hookPath), { recursive: true })

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8')
    if (!existing.includes(marker)) {
      console.log(`Skipping ${label} hook install: unmanaged .git/hooks/${hookFile} already exists.`)
      return
    }
  }

  writeFileSync(hookPath, body, 'utf8')
  chmodSync(hookPath, 0o755)
  console.log(`Installed SiteProof ${label} hook.`)
}

installHook('pre-commit', preCommitMarker, preCommitBody, 'pre-commit')
installHook('pre-push', prePushMarker, prePushBody, 'pre-push')
