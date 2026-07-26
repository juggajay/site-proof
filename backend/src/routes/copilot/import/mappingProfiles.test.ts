import { describe, expect, it } from 'vitest';

import { AppError } from '../../../lib/AppError.js';
import { AU_ITP_HEADERS } from '../../../test/itpWorkbookFixture.js';
import {
  applyTransform,
  assertAllowedFieldMap,
  BUILT_IN_PROFILES,
  deriveFieldMapFromHeaders,
  resolveColumnIndexes,
  suggestBuiltInProfile,
} from './mappingProfiles.js';

const HEADERS = [...AU_ITP_HEADERS];

describe('assertAllowedFieldMap — the apply-time gate', () => {
  it('accepts a well-formed map', () => {
    const map = assertAllowedFieldMap(
      [{ target: 'description', source: { header: 'Inspection / Test Activity' } }],
      'itp_template',
    );
    expect(map).toHaveLength(1);
  });

  it('refuses a target outside the allow-list, even when the profile was saved earlier', () => {
    expect(() =>
      assertAllowedFieldMap([{ target: 'projectId', source: { header: 'X' } }], 'itp_template'),
    ).toThrow(/not a field this import can write/);
  });

  it('refuses an unknown transform', () => {
    expect(() =>
      assertAllowedFieldMap(
        [{ target: 'description', source: { header: 'X' }, transform: 'exec_shell' }],
        'itp_template',
      ),
    ).toThrow(/not a supported transform/);
  });

  it('refuses two columns mapped to the same target', () => {
    expect(() =>
      assertAllowedFieldMap(
        [
          { target: 'description', source: { header: 'A' } },
          { target: 'description', source: { header: 'B' } },
        ],
        'itp_template',
      ),
    ).toThrow(/Two columns are both mapped/);
  });

  it('refuses a kind that has no importer yet (test_register stays reserved)', () => {
    expect(() =>
      assertAllowedFieldMap([{ target: 'description', source: { header: 'A' } }], 'test_register'),
    ).toThrow(/are not supported yet/);
  });

  it('refuses structurally invalid JSON', () => {
    expect(() => assertAllowedFieldMap({ not: 'an array' }, 'itp_template')).toThrow(AppError);
    expect(() => assertAllowedFieldMap([], 'itp_template')).toThrow(AppError);
  });

  it('validates every shipped built-in profile', () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(() => assertAllowedFieldMap(profile.fieldMap, profile.kind)).not.toThrow();
    }
  });
});

describe('header aliasing', () => {
  it('derives the AU ITP columns from their headers', () => {
    const map = deriveFieldMapFromHeaders(HEADERS);
    const targets = map.map((entry) => entry.target);
    expect(targets).toContain('activityType');
    expect(targets).toContain('description');
    expect(targets).toContain('acceptanceCriteria');
    expect(targets).toContain('pointType');
    expect(targets).toContain('responsibleParty');
    expect(targets).toContain('testType');
  });

  it('auto-suggests the generic AU profile for an AU ITP sheet', () => {
    expect(suggestBuiltInProfile(HEADERS)?.key).toBe('generic_au_itp_excel');
  });

  it('suggests nothing for an unrecognisable layout', () => {
    expect(suggestBuiltInProfile(['Foo', 'Bar', 'Baz'])).toBeNull();
  });

  it('resolves target -> column index, ignoring punctuation and case', () => {
    const indexes = resolveColumnIndexes(
      [{ target: 'description', source: { header: 'inspection test activity' } }],
      HEADERS,
    );
    expect(indexes.get('description')).toBe(1);
  });
});

describe('transforms', () => {
  it('maps W/H/S to the codebase point-type vocabulary', () => {
    expect(applyTransform('whs_to_point_type', 'H')).toBe('hold_point');
    expect(applyTransform('whs_to_point_type', 'Hold Point')).toBe('hold_point');
    expect(applyTransform('whs_to_point_type', 'W')).toBe('witness');
    expect(applyTransform('whs_to_point_type', 'S')).toBe('standard');
    expect(applyTransform('whs_to_point_type', 'Surveillance')).toBe('standard');
    expect(applyTransform('whs_to_point_type', '')).toBe('');
    // Unrecognised values fall through empty so the DB default applies rather
    // than a guess being written as fact.
    expect(applyTransform('whs_to_point_type', 'zzz')).toBe('');
  });

  it('maps responsible party', () => {
    expect(applyTransform('responsible_party', 'Contractor')).toBe('contractor');
    expect(applyTransform('responsible_party', 'Superintendent')).toBe('superintendent');
    expect(applyTransform('responsible_party', 'RE')).toBe('superintendent');
  });

  it('maps evidence required', () => {
    expect(applyTransform('evidence_required', 'Photo record')).toBe('photo');
    expect(applyTransform('evidence_required', 'Test certificate')).toBe('test');
    expect(applyTransform('evidence_required', 'Signed checklist')).toBe('signature');
  });

  it('trims by default', () => {
    expect(applyTransform(undefined, '  spaced  ')).toBe('spaced');
    expect(applyTransform('none', '  spaced  ')).toBe('spaced');
  });
});
