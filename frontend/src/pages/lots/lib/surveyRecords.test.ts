// Wave C5-c — the two things on this surface that are worth getting wrong:
// keeping the surveyor's verdict out of CIVOS's status vocabulary, and not
// losing a superseded record while grouping the chain.

import { describe, expect, it } from 'vitest';

import { STATUS_LABELS } from '@/lib/statusLabels';
import {
  SURVEY_STATUSES,
  acceptBlockedReason,
  canAcceptSurvey,
  countOutstandingSurveys,
  groupSurveyRevisions,
  isQuotableVerdict,
  surveyStatusLabel,
  surveyTranscribedBy,
  surveyVerdictLabel,
  type SurveyRecord,
} from './surveyRecords';

function makeSurvey(overrides: Partial<SurveyRecord> = {}): SurveyRecord {
  return {
    id: 'survey-1',
    lotId: 'lot-1',
    kind: 'conformance',
    status: 'received',
    requestedAt: '2026-07-20T00:00:00.000Z',
    surveyorName: 'R. Tanaka',
    surveyorCompany: 'Veris Ltd',
    surveyorRegistration: 'QLD Cadastral Reg. 4417',
    surveyedAt: '2026-07-26T00:00:00.000Z',
    surveyorVerdict: 'conforms',
    verdictSourceNote: 'MRTS04 Cl. 8.3.2',
    reviewedAt: null,
    acceptedAt: null,
    rejectionReason: null,
    supersededById: null,
    supersessionReason: null,
    notes: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    reportDocument: { id: 'doc-1', filename: 'CONF-D-014-RevC.pdf', mimeType: 'application/pdf' },
    requestedBy: { id: 'u1', fullName: 'A. Whitton' },
    reviewedBy: null,
    acceptedBy: null,
    ...overrides,
  };
}

describe('the surveyor verdict is not a CIVOS status', () => {
  // The load-bearing test. If a verdict and a status ever share a key in the
  // flat, global STATUS_LABELS map, a surveyor's "Conforms" can be rendered by
  // a surface that thinks it is showing CIVOS's own workflow state — which is
  // CIVOS publishing a conformance finding it never made.
  it('gives verdicts and statuses disjoint keys in the shared label map', () => {
    const statusKeys = SURVEY_STATUSES.map((status) => `survey_${status}`);
    const verdictKeys = ['conforms', 'does_not_conform', 'qualified', 'not_stated'].map(
      (verdict) => `survey_verdict_${verdict}`,
    );

    for (const key of [...statusKeys, ...verdictKeys]) {
      expect(STATUS_LABELS[key], `${key} must be spelled out, never title-cased`).toBeTruthy();
    }
    expect(statusKeys.filter((key) => verdictKeys.includes(key))).toEqual([]);
  });

  // Wave G5's `NcrTemplateProposal.status` is 'open' | 'accepted' | 'rejected'
  // and renders through the same helper. An unprefixed survey key would silently
  // relabel it.
  it('does not squat on the unprefixed keys other domains use', () => {
    expect(STATUS_LABELS.accepted).toBeUndefined();
    expect(STATUS_LABELS.received).toBeUndefined();
    expect(STATUS_LABELS.conforms).toBeUndefined();
    expect(STATUS_LABELS.superseded).toBeUndefined();
  });

  it('labels CIVOS acceptance as being about the record, not the lot', () => {
    expect(surveyStatusLabel('accepted')).toBe('Evidence record accepted');
    expect(surveyStatusLabel('received')).toBe('Report received');
  });

  it('quotes stated verdicts and refuses to quote a verdict that was never stated', () => {
    expect(surveyVerdictLabel('does_not_conform')).toBe('Does not conform');
    expect(isQuotableVerdict('does_not_conform')).toBe(true);

    // "The report states no verdict" is OUR sentence about their report.
    expect(surveyVerdictLabel('not_stated')).toBe('The report states no verdict');
    expect(isQuotableVerdict('not_stated')).toBe(false);
  });

  it('reports an untranscribed verdict as absent rather than inventing one', () => {
    expect(surveyVerdictLabel(null)).toBeNull();
    expect(isQuotableVerdict(null)).toBe(false);
  });
});

describe('groupSurveyRevisions', () => {
  it('nests a superseded record under the record that replaced it', () => {
    const current = makeSurvey({ id: 'rev-2' });
    const original = makeSurvey({
      id: 'rev-1',
      supersededById: 'rev-2',
      supersessionReason: 're-survey after trim and re-roll',
    });

    const groups = groupSurveyRevisions([current, original]);

    expect(groups).toHaveLength(1);
    expect(groups[0].current.id).toBe('rev-2');
    expect(groups[0].earlier.map((r) => r.id)).toEqual(['rev-1']);
  });

  it('follows a multi-step chain so A -> B -> C lands A and B under C', () => {
    const c = makeSurvey({ id: 'c' });
    const b = makeSurvey({ id: 'b', supersededById: 'c' });
    const a = makeSurvey({ id: 'a', supersededById: 'b' });

    const groups = groupSurveyRevisions([c, b, a]);

    expect(groups).toHaveLength(1);
    expect(groups[0].current.id).toBe('c');
    expect(groups[0].earlier.map((r) => r.id)).toEqual(['b', 'a']);
  });

  // A superseded survey record is the evidence that the first result was bad.
  // Losing one to a broken chain is worse than not grouping at all.
  it('keeps a record whose replacement is missing from the page', () => {
    const orphan = makeSurvey({ id: 'orphan', supersededById: 'never-fetched' });

    const groups = groupSurveyRevisions([orphan]);

    expect(groups).toHaveLength(1);
    expect(groups[0].current.id).toBe('orphan');
  });

  it('terminates on a cyclic chain instead of spinning', () => {
    const x = makeSurvey({ id: 'x', supersededById: 'y' });
    const y = makeSurvey({ id: 'y', supersededById: 'x' });

    const groups = groupSurveyRevisions([x, y]);

    expect(groups.flatMap((g) => [g.current.id, ...g.earlier.map((r) => r.id)]).sort()).toEqual([
      'x',
      'y',
    ]);
  });

  it('keeps separate chains apart and preserves input order', () => {
    const conformance = makeSurvey({ id: 'conf-2', kind: 'conformance' });
    const conformanceOld = makeSurvey({
      id: 'conf-1',
      kind: 'conformance',
      supersededById: 'conf-2',
    });
    const asBuilt = makeSurvey({ id: 'ab-1', kind: 'as_built' });

    const groups = groupSurveyRevisions([conformance, conformanceOld, asBuilt]);

    expect(groups.map((g) => g.current.id)).toEqual(['conf-2', 'ab-1']);
    expect(groups[0].earlier.map((r) => r.id)).toEqual(['conf-1']);
    expect(groups[1].earlier).toEqual([]);
  });
});

describe('countOutstandingSurveys', () => {
  it('counts only current, non-terminal records', () => {
    const groups = groupSurveyRevisions([
      makeSurvey({ id: 'awaiting', status: 'received' }),
      makeSurvey({ id: 'done', status: 'accepted' }),
      // Terminal: closed, nothing to chase.
      makeSurvey({ id: 'knocked-back', status: 'rejected' }),
      // Superseded: replaced precisely so it would stop counting.
      makeSurvey({ id: 'old', status: 'received', supersededById: 'done' }),
    ]);

    expect(countOutstandingSurveys(groups)).toBe(1);
  });

  it('is zero when every current record is closed', () => {
    const groups = groupSurveyRevisions([makeSurvey({ status: 'accepted' })]);
    expect(countOutstandingSurveys(groups)).toBe(0);
  });
});

describe('canAcceptSurvey mirrors the backend assertAcceptable', () => {
  it('accepts when a surveyor and a transcribed verdict are both present', () => {
    expect(canAcceptSurvey(makeSurvey())).toBe(true);
    expect(acceptBlockedReason(makeSurvey())).toBeNull();
  });

  // "A human looked" is the requirement, so a report that gave no verdict is a
  // recordable answer rather than a gap that blocks acceptance.
  it("treats 'not_stated' as a real verdict", () => {
    expect(canAcceptSurvey(makeSurvey({ surveyorVerdict: 'not_stated' }))).toBe(true);
  });

  it('refuses without a surveyor or without a verdict, and says which', () => {
    expect(canAcceptSurvey(makeSurvey({ surveyorName: null }))).toBe(false);
    expect(acceptBlockedReason(makeSurvey({ surveyorName: null }))).toMatch(/who performed/i);

    expect(canAcceptSurvey(makeSurvey({ surveyorVerdict: null }))).toBe(false);
    expect(acceptBlockedReason(makeSurvey({ surveyorVerdict: null }))).toMatch(/verdict/i);
  });

  it('offers acceptance only from `received`', () => {
    expect(canAcceptSurvey(makeSurvey({ status: 'requested' }))).toBe(false);
    expect(canAcceptSurvey(makeSurvey({ status: 'accepted' }))).toBe(false);
  });
});

describe('surveyTranscribedBy', () => {
  // Mirrors `surveyRecordedBy` in routes/folio/assemble.ts: most recent actor
  // wins, so the lot page and the issued folio name the same person.
  it('prefers the acceptor, then the reviewer, then whoever opened the record', () => {
    expect(
      surveyTranscribedBy(
        makeSurvey({
          acceptedBy: { id: 'u3', fullName: 'D. Harding' },
          acceptedAt: '2026-07-27T08:14:00.000Z',
          reviewedBy: { id: 'u2', fullName: 'B. Reviewer' },
          reviewedAt: '2026-07-26T00:00:00.000Z',
        }),
      ).name,
    ).toBe('D. Harding');

    expect(
      surveyTranscribedBy(
        makeSurvey({
          reviewedBy: { id: 'u2', fullName: 'B. Reviewer' },
          reviewedAt: '2026-07-26T00:00:00.000Z',
        }),
      ).name,
    ).toBe('B. Reviewer');

    expect(surveyTranscribedBy(makeSurvey()).name).toBe('A. Whitton');
  });
});
