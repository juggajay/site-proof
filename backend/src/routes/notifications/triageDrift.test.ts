/**
 * Classifier decay guard.
 *
 * Every notification `type` literal in backend source must be classified in
 * `NOTIFICATION_TRIAGE` (or explicitly listed as not-a-notification-type). A new
 * notification type therefore cannot ship silently defaulting into "FYI".
 *
 * Asserted by TEXT SCAN, not by import: notification types are plain strings
 * spread across ~20 route and lib modules with no shared union, and importing
 * those modules pulls in Prisma and Express. Same technique as
 * `lib/itpProvenance.test.ts`, which text-parses the ITP seeders rather than
 * importing them.
 *
 * The scan is deliberately WIDE — every non-test `.ts` under `backend/src` whose
 * text mentions "notification" — because a narrow scan is what rots. A file that
 * starts producing notifications is in scope automatically. The cost of the
 * width is a handful of literals that are not notification types at all; those
 * go in NON_NOTIFICATION_TYPE_LITERALS with a reason, which is still an explicit
 * decision per literal.
 */

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { NON_NOTIFICATION_TYPE_LITERALS, NOTIFICATION_TRIAGE } from './triage.js';

const BACKEND_SRC = join(process.cwd(), 'src');
const TYPE_LITERAL = /type: '([a-z0-9_]+)'/g;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!entry.name.endsWith('.ts') || entry.name.includes('.test.')) return [];
    return [path];
  });
}

/** `type: '<literal>'` in every backend source file that mentions notifications. */
export function scanNotificationTypeLiterals(sourceFiles: string[]): Map<string, string[]> {
  const found = new Map<string, string[]>();

  for (const file of sourceFiles) {
    const source = readFileSync(file, 'utf8');
    if (!/notification/i.test(source)) continue;

    for (const match of source.matchAll(TYPE_LITERAL)) {
      const literal = match[1];
      const files = found.get(literal) ?? [];
      if (!files.includes(file)) files.push(file);
      found.set(literal, files);
    }
  }

  return found;
}

describe('notification triage classifier drift', () => {
  const literals = scanNotificationTypeLiterals(listSourceFiles(BACKEND_SRC));

  it('scans a plausible number of notification-producing files', () => {
    // A sanity floor: if a refactor breaks the scan it reports zero findings and
    // silently passes. The real defence is the assertion below, but only if the
    // scan actually found something.
    expect(literals.size).toBeGreaterThan(20);
    expect(literals.has('alert_escalation')).toBe(true);
    expect(literals.has('mention')).toBe(true);
  });

  it('classifies every notification type literal the backend produces', () => {
    const unclassified = [...literals.keys()]
      .filter((literal) => !(literal in NOTIFICATION_TRIAGE))
      .filter((literal) => !(literal in NON_NOTIFICATION_TYPE_LITERALS))
      .sort();

    expect(
      unclassified,
      unclassified.length === 0
        ? ''
        : `Unclassified notification type(s): ${unclassified
            .map((literal) => `${literal} (${literals.get(literal)?.join(', ')})`)
            .join('; ')}. Add each to NOTIFICATION_TRIAGE in triage.ts — decide ` +
            'whether it needs action — or to NON_NOTIFICATION_TYPE_LITERALS with a reason.',
    ).toEqual([]);
  });

  it('fails when an unclassified type literal is introduced', () => {
    // Proves the guard above actually bites. Written to a temp dir rather than
    // under src/ so the fixture cannot leak into the real scan.
    const fixture = join(mkdtempSync(join(tmpdir(), 'triage-drift-')), 'newNotification.ts');
    writeFileSync(
      fixture,
      "await prisma.notification.create({ data: { type: 'brand_new_unclassified_type' } });\n",
      'utf8',
    );

    const found = scanNotificationTypeLiterals([fixture]);
    const unclassified = [...found.keys()].filter(
      (literal) =>
        !(literal in NOTIFICATION_TRIAGE) && !(literal in NON_NOTIFICATION_TYPE_LITERALS),
    );

    expect(unclassified).toEqual(['brand_new_unclassified_type']);
  });

  it('does not classify types that no longer exist in source', () => {
    // Advisory in the other direction: a stale entry is harmless at runtime but
    // means the map is drifting away from the code it describes.
    const stale = Object.keys(NOTIFICATION_TRIAGE)
      .filter((type) => !literals.has(type))
      .sort();

    expect(stale, `Classified type(s) not found in backend source: ${stale.join(', ')}`).toEqual(
      [],
    );
  });
});
