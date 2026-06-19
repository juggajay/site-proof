import { describe, expect, it } from 'vitest';
import {
  analyzePasswordHashes,
  formatPasswordHashReadinessReport,
  passwordHashReadinessExitCode,
  type PasswordHashAnalysis,
} from './passwordHashReadiness.js';
import {
  classifyPasswordHash,
  isBcryptPasswordHash,
  isLegacySha256PasswordHash,
} from './passwordHashPolicy.js';

describe('password hash policy', () => {
  it('classifies supported password hash formats', () => {
    expect(classifyPasswordHash(null)).toBe('empty');
    expect(classifyPasswordHash('')).toBe('empty');
    expect(
      classifyPasswordHash('$2a$12$abcdefghijklmnopqrstuuA7P0P8uUI25C1F0D3sEDaDQDFIxY2nS'),
    ).toBe('bcrypt');
    expect(
      classifyPasswordHash('$2b$12$abcdefghijklmnopqrstuuA7P0P8uUI25C1F0D3sEDaDQDFIxY2nS'),
    ).toBe('bcrypt');
    expect(
      classifyPasswordHash('$2y$12$abcdefghijklmnopqrstuuA7P0P8uUI25C1F0D3sEDaDQDFIxY2nS'),
    ).toBe('bcrypt');
    expect(classifyPasswordHash('a'.repeat(64))).toBe('legacy_sha256');
    expect(classifyPasswordHash('ABCDEF0123456789'.repeat(4))).toBe('legacy_sha256');
    expect(classifyPasswordHash('not-a-supported-hash')).toBe('unknown');
  });

  it('exposes focused predicates for auth code', () => {
    expect(
      isBcryptPasswordHash('$2b$12$abcdefghijklmnopqrstuuA7P0P8uUI25C1F0D3sEDaDQDFIxY2nS'),
    ).toBe(true);
    expect(isLegacySha256PasswordHash('a'.repeat(64))).toBe(true);
    expect(isLegacySha256PasswordHash('g'.repeat(64))).toBe(false);
  });

  it('summarizes password hash readiness without requiring user identifiers', () => {
    const analysis: PasswordHashAnalysis = analyzePasswordHashes([
      { passwordHash: null },
      { passwordHash: '$2b$12$abcdefghijklmnopqrstuuA7P0P8uUI25C1F0D3sEDaDQDFIxY2nS' },
      { passwordHash: 'a'.repeat(64) },
      { passwordHash: 'unsupported' },
    ]);

    expect(analysis).toEqual({
      totalUsers: 4,
      passwordUsers: 3,
      bcrypt: 1,
      legacy_sha256: 1,
      empty: 1,
      unknown: 1,
    });
  });

  it('formats a non-PII readiness report', () => {
    const report = formatPasswordHashReadinessReport({
      totalUsers: 2,
      passwordUsers: 1,
      bcrypt: 1,
      legacy_sha256: 0,
      empty: 1,
      unknown: 0,
    });

    expect(report).toContain('No user emails, IDs, or password hashes are printed');
    expect(report).toContain('All password-enabled users have bcrypt hashes');
    expect(report).not.toContain('@');
  });

  it('computes readiness exit codes for migration gates', () => {
    const clean: PasswordHashAnalysis = {
      totalUsers: 1,
      passwordUsers: 1,
      bcrypt: 1,
      legacy_sha256: 0,
      empty: 0,
      unknown: 0,
    };
    const legacy: PasswordHashAnalysis = { ...clean, bcrypt: 0, legacy_sha256: 1 };
    const unknown: PasswordHashAnalysis = { ...clean, bcrypt: 0, unknown: 1 };

    expect(passwordHashReadinessExitCode(clean, ['node', 'script'])).toBe(0);
    expect(passwordHashReadinessExitCode(legacy, ['node', 'script'])).toBe(0);
    expect(passwordHashReadinessExitCode(legacy, ['node', 'script', '--fail-on-legacy'])).toBe(1);
    expect(passwordHashReadinessExitCode(unknown, ['node', 'script', '--fail-on-legacy'])).toBe(0);
    expect(passwordHashReadinessExitCode(unknown, ['node', 'script', '--fail-on-non-bcrypt'])).toBe(
      1,
    );
  });
});
