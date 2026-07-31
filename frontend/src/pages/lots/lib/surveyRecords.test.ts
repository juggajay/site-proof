// Wave C5-c — the two things on this surface that are worth getting wrong:
// keeping the surveyor's verdict out of CIVOS's status vocabulary, and not
// losing a superseded record while grouping the chain.

import { describe, expect, it } from 'vitest';

import { STATUS_LABELS } from '@/lib/statusLabels';
import {
  SURVEY_STATUSES,
  canReturnSurvey,
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
    receivedAt: null,
    returnReason: null,
    supersededById: null,
    supersessionReason: null,
    notes: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    reportDocument: { id: 'doc-1', filename: 'CONF-D-014-RevC.pdf', mimeType: 'application/pdf' },
    requestedBy: { id: 'u1', fullName: 'A. Whitton' },
    receivedBy: null,
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

  it('labels CIVOS state as ARRIVAL, and never as acceptance', () => {
    expect(surveyStatusLabel('received')).toBe('Report received');
    expect(surveyStatusLabel('returned_for_correction')).toBe('Returned for correction');
    // The retired keys are GONE, not left as harmless spares: a label for a
    // state the backend cannot store is one that gets rendered by mistake.
    expect(STATUS_LABELS.survey_accepted).toBeUndefined();
    expect(STATUS_LABELS.survey_rejected).toBeUndefined();
    expect(STATUS_LABELS.survey_in_progress).toBeUndefined();
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
  it('counts current records whose report has not arrived', () => {
    const groups = groupSurveyRevisions([
      makeSurvey({ id: 'awaiting', status: 'requested' }),
      makeSurvey({ id: 'in-hand', status: 'received' }),
      // Superseded: replaced precisely so it would stop counting.
      makeSurvey({ id: 'old', status: 'requested', supersededById: 'in-hand' }),
    ]);

    expect(countOutstandingSurveys(groups)).toBe(1);
  });

  // The substantive change from `rejected`, which was terminal and stopped
  // counting. A return is a loop: the lot is still waiting on the fixed report.
  it('still counts a returned record - it is not closed', () => {
    const groups = groupSurveyRevisions([
      makeSurvey({ id: 'sent-back', status: 'returned_for_correction' }),
    ]);
    expect(countOutstandingSurveys(groups)).toBe(1);
  });

  it('is zero when every current report has arrived', () => {
    const groups = groupSurveyRevisions([makeSurvey({ status: 'received' })]);
    expect(countOutstandingSurveys(groups)).toBe(0);
  });
});

describe('canReturnSurvey mirrors the backend transition map', () => {
  it('offers the return only from `received`', () => {
    expect(canReturnSurvey(makeSurvey({ status: 'received' }))).toBe(true);
    // Nothing has arrived to refer back.
    expect(canReturnSurvey(makeSurvey({ status: 'requested' }))).toBe(false);
    // Already returned: the corrected report is a NEW record, not this one.
    expect(canReturnSurvey(makeSurvey({ status: 'returned_for_correction' }))).toBe(false);
  });

  it('never offers it on a superseded record - history does not change state', () => {
    expect(canReturnSurvey(makeSurvey({ status: 'received', supersededById: 'rev-2' }))).toBe(
      false,
    );
  });

  it('does not depend on the verdict - receipt is not a judgement about one', () => {
    // The old accept gate required a transcribed verdict. Returning a report
    // because it is unopenable or computed against the wrong surface does not.
    expect(canReturnSurvey(makeSurvey({ surveyorVerdict: null }))).toBe(true);
  });
});

describe('surveyTranscribedBy', () => {
  // Mirrors `surveyRecordedBy` in routes/folio/assemble.ts: most recent actor
  // wins, so the lot page and the issued folio name the same person.
  it('prefers whoever recorded receipt, then whoever filed the record', () => {
    expect(
      surveyTranscribedBy(
        makeSurvey({
          receivedBy: { id: 'u2', fullName: 'B. Receiver' },
          receivedAt: '2026-07-26T00:00:00.000Z',
        }),
      ).name,
    ).toBe('B. Receiver');

    expect(surveyTranscribedBy(makeSurvey()).name).toBe('A. Whitton');
  });
});
