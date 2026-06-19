import { classifyPasswordHash, type PasswordHashKind } from './passwordHashPolicy.js';

export type PasswordHashRow = {
  passwordHash: string | null;
};

export type PasswordHashAnalysis = Record<PasswordHashKind, number> & {
  totalUsers: number;
  passwordUsers: number;
};

export function analyzePasswordHashes(rows: PasswordHashRow[]): PasswordHashAnalysis {
  const analysis: PasswordHashAnalysis = {
    totalUsers: rows.length,
    passwordUsers: 0,
    bcrypt: 0,
    legacy_sha256: 0,
    empty: 0,
    unknown: 0,
  };

  for (const row of rows) {
    const kind = classifyPasswordHash(row.passwordHash);
    analysis[kind] += 1;
    if (kind !== 'empty') {
      analysis.passwordUsers += 1;
    }
  }

  return analysis;
}

export function formatPasswordHashReadinessReport(analysis: PasswordHashAnalysis): string {
  const statusMessage =
    analysis.legacy_sha256 > 0
      ? 'Legacy SHA256 password hashes remain. Keep legacy verification enabled until these users either log in successfully and auto-rehash, or complete a forced password reset.'
      : analysis.unknown > 0
        ? 'Unknown password hash formats remain. Review before removing compatibility code.'
        : 'All password-enabled users have bcrypt hashes.';

  return [
    '=== Password Hash Readiness ===',
    '',
    'No user emails, IDs, or password hashes are printed by this report.',
    '',
    `Total users: ${analysis.totalUsers}`,
    `Users with passwords: ${analysis.passwordUsers}`,
    `bcrypt hashes: ${analysis.bcrypt}`,
    `Legacy SHA256 hashes: ${analysis.legacy_sha256}`,
    `Unknown password hash formats: ${analysis.unknown}`,
    `Passwordless/OAuth-only users: ${analysis.empty}`,
    '',
    statusMessage,
  ].join('\n');
}

export function passwordHashReadinessExitCode(
  analysis: PasswordHashAnalysis,
  args: readonly string[],
): 0 | 1 {
  const failOnNonBcrypt = args.includes('--fail-on-non-bcrypt');
  const failOnLegacy = failOnNonBcrypt || args.includes('--fail-on-legacy');
  const hasDisallowedHash =
    (failOnLegacy && analysis.legacy_sha256 > 0) || (failOnNonBcrypt && analysis.unknown > 0);
  return hasDisallowedHash ? 1 : 0;
}
