// Wave C5-c — the lot page's survey & materials section.
//
// THE property under test: a surveyor's stated verdict must never be rendered
// in CIVOS's status language. A green "CONFORMS" chip is CIVOS asserting the
// lot conforms — it holds no level, no deviation and no tolerance for the lot
// and has no standing to assert it. The verdict is a neutral attributed
// quotation; the colour belongs to CIVOS's own workflow state.
//
// Plus supersession: the current record is marked, the prior ones are grouped
// under it and reachable, and neither the outstanding count nor the section
// silently loses one.

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyMaterialsSection } from './SurveyMaterialsSection';
import type { SurveyRecord } from '../lib/surveyRecords';

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: apiFetchMock };
});
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

function makeSurvey(overrides: Partial<SurveyRecord> = {}): SurveyRecord {
  return {
    id: 'survey-current',
    lotId: 'lot-1',
    kind: 'conformance',
    status: 'received',
    requestedAt: '2026-07-20T00:00:00.000Z',
    surveyorName: 'R. Tanaka',
    surveyorCompany: 'Veris Ltd',
    surveyorRegistration: 'QLD Cadastral Reg. 4417',
    surveyedAt: '2026-07-26T00:00:00.000Z',
    surveyorVerdict: 'conforms',
    verdictSourceNote: 'levels within ±25 mm of design, MRTS04 Cl. 8.3.2',
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

const LOT_SURVEYS_PATH = '/api/lots/lot-1/surveys?includeSuperseded=true';
const CREATE_PATH = '/api/lots/lot-1/surveys';

function renderSection({
  surveys = [makeSurvey()],
  deliveries = [] as unknown[],
  documents = [{ id: 'doc-9', filename: 'CONF-D-014-RevD.pdf' }],
  role = 'quality_manager',
} = {}) {
  apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path.startsWith('/api/documents')) return Promise.resolve({ documents });
    if (path === LOT_SURVEYS_PATH) return Promise.resolve({ surveys, readiness: [] });
    if (path === '/api/lots/lot-1/deliveries') return Promise.resolve({ deliveries });
    // The create route returns the record it made; the supersede call needs its id.
    if (path === CREATE_PATH && options?.method === 'POST') {
      return Promise.resolve({ id: 'survey-new' });
    }
    return Promise.resolve({});
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <Wrapper>
      <SurveyMaterialsSection lotId="lot-1" projectId="project-1" effectiveRole={role} />
    </Wrapper>,
  );
}

/** The parsed body of the last call to `path`, or null if it was never called. */
function lastBody(path: string): Record<string, unknown> | null {
  const call = [...apiFetchMock.mock.calls].reverse().find(([p]) => p === path);
  return call ? JSON.parse((call[1] as { body: string }).body) : null;
}

function callsTo(path: string): number {
  return apiFetchMock.mock.calls.filter(([p]) => p === path).length;
}

/** Open the editor from the named trigger and hand back the modal it opened. */
async function openEditor(
  user: ReturnType<typeof userEvent.setup>,
  trigger: string | RegExp,
): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: trigger }));
  return screen.findByRole('dialog');
}

/** Every colour class this codebase uses to signal a workflow outcome. */
const STATUS_COLOUR =
  /text-success|bg-success|text-destructive|bg-destructive|text-warning|bg-warning/;

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('the surveyor verdict never reads as a CIVOS judgement', () => {
  it('renders the verdict as an attributed quotation, not a status chip', async () => {
    renderSection();

    const caption = await screen.findByText('Surveyor-stated verdict');
    const block = caption.closest('figure');
    expect(block).not.toBeNull();

    // The surveyor's words, quoted.
    expect(within(block!).getByText(/“Conforms”/)).toBeInTheDocument();
    // Cited: the report it was read off, and the CIVOS user who typed it in.
    expect(within(block!).getByText(/CONF-D-014-RevC\.pdf/)).toBeInTheDocument();
    expect(within(block!).getByText(/Transcribed into CIVOS by/)).toBeInTheDocument();
    expect(within(block!).getByText('A. Whitton')).toBeInTheDocument();
  });

  it('gives the verdict block no status colour anywhere inside it', async () => {
    renderSection();
    const block = (await screen.findByText('Surveyor-stated verdict')).closest('figure')!;

    for (const node of [block, ...Array.from(block.querySelectorAll('*'))]) {
      expect(node.className, `"${node.textContent?.slice(0, 40)}" must stay neutral`).not.toMatch(
        STATUS_COLOUR,
      );
    }
  });

  it('reserves the status colour for the CIVOS workflow state', async () => {
    renderSection({ surveys: [makeSurvey({ status: 'received', surveyorVerdict: 'conforms' })] });

    // CIVOS received the REPORT. It did not accept it and did not find the lot
    // conformant. The same label appears twice by design — once as the badge,
    // once as the final step of the progress list — because both are the same
    // CIVOS state and one vocabulary is the point. The badge is outside the `<ol>`.
    const labels = await screen.findAllByText('Report received');
    const badge = labels.find((node) => !node.closest('ol'));
    expect(badge).toBeDefined();
    expect(badge!.className).toMatch(/success/);

    // And the surveyor's "Conforms" beside it is still uncoloured.
    const verdict = screen.getByText(/“Conforms”/);
    expect(verdict.className).not.toMatch(STATUS_COLOUR);
  });

  it('does not quote a verdict the report never stated', async () => {
    renderSection({ surveys: [makeSurvey({ surveyorVerdict: 'not_stated' })] });

    expect(await screen.findByText('The report states no verdict')).toBeInTheDocument();
    expect(screen.queryByText(/“The report states no verdict”/)).not.toBeInTheDocument();
  });

  it('says a verdict is untranscribed rather than implying a result', async () => {
    renderSection({ surveys: [makeSurvey({ surveyorVerdict: null })] });

    expect(await screen.findByText('Not yet transcribed from the report.')).toBeInTheDocument();
  });
});

describe('returning a survey for correction', () => {
  // There is no accept action, and its absence is the point: acceptance in AU
  // civil is the hold-point release and the lot conformance, not an act on this
  // record (research §4). The one write here refers a defective deliverable
  // back to the surveyor.
  it('offers no acceptance anywhere on the surface', async () => {
    renderSection();
    await screen.findByText('Surveyor-stated verdict');

    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reject$/ })).not.toBeInTheDocument();
  });

  it('names the surveyor and the report, and refuses to send without a reason', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Return for correction' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/R\. Tanaka/)).toBeInTheDocument();
    expect(within(dialog).getByText('CONF-D-014-RevC.pdf')).toBeInTheDocument();

    // The reason is the whole value of the state: six distinct return triggers
    // are evidenced and each demands a different fix from the surveyor.
    const confirm = within(dialog).getByRole('button', { name: 'Return for correction' });
    expect(confirm).toBeDisabled();

    await user.type(
      within(dialog).getByLabelText('What has to be corrected?'),
      'Chainage gaps exceed 50 m',
    );
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/surveys/survey-current/status',
      expect.objectContaining({
        body: JSON.stringify({
          status: 'returned_for_correction',
          returnReason: 'Chainage gaps exceed 50 m',
        }),
      }),
    );
  });

  it('is offered only to the decider roles', async () => {
    renderSection({ role: 'site_engineer' });

    await screen.findByText('Surveyor-stated verdict');
    expect(screen.queryByRole('button', { name: 'Return for correction' })).not.toBeInTheDocument();
  });

  it('is not offered on a record whose report has not arrived', async () => {
    renderSection({ surveys: [makeSurvey({ status: 'requested' })] });

    await screen.findByText('Surveyor-stated verdict');
    expect(screen.queryByRole('button', { name: 'Return for correction' })).not.toBeInTheDocument();
  });

  it('shows a returned record its reason and where the workflow goes next', async () => {
    renderSection({
      surveys: [
        makeSurvey({
          status: 'returned_for_correction',
          returnReason: 'RTK GNSS used for vertical compliance on subgrade',
        }),
      ],
    });

    expect(
      await screen.findByText(/RTK GNSS used for vertical compliance on subgrade/),
    ).toBeInTheDocument();
    // NOT a dead end: the corrected report is a new, cross-referenced record.
    expect(
      screen.getByText(/File the corrected report as a new survey record/),
    ).toBeInTheDocument();
  });
});

describe('supersession', () => {
  const CURRENT = makeSurvey({ id: 'rev-2', status: 'received', surveyedAt: '2026-07-26' });
  const EARLIER = makeSurvey({
    id: 'rev-1',
    status: 'returned_for_correction',
    returnReason: 'CH1310–CH1330 high by 40 mm, outside the stated tolerance',
    surveyorVerdict: 'does_not_conform',
    verdictSourceNote: 'CH1310–CH1330 high by 40 mm',
    surveyedAt: '2026-07-22',
    supersededById: 'rev-2',
    supersessionReason: 're-survey after trim and re-roll of CH1310–CH1330',
  });

  it('marks the current record and groups the prior one under it', async () => {
    const user = userEvent.setup();
    renderSection({ surveys: [CURRENT, EARLIER] });

    expect(await screen.findByText('Current')).toBeInTheDocument();

    // The earlier record is behind a disclosure, not gone.
    const disclosure = screen.getByRole('button', { name: /1 earlier record/ });
    expect(screen.queryByText(/“Does not conform”/)).not.toBeInTheDocument();

    await user.click(disclosure);
    expect(screen.getByText(/“Does not conform”/)).toBeInTheDocument();
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(
      screen.getByText(/re-survey after trim and re-roll of CH1310–CH1330/),
    ).toBeInTheDocument();
  });

  it('does not count a superseded record as outstanding', async () => {
    // The current record's report is in; the record it replaced was returned
    // for correction. A superseded record was replaced precisely so it would
    // stop being chased, so nothing is outstanding.
    renderSection({ surveys: [CURRENT, EARLIER] });
    await screen.findByText('Current');
    expect(screen.queryByText(/outstanding/)).not.toBeInTheDocument();
  });

  it('counts a current record still waiting on its report as outstanding', async () => {
    renderSection({ surveys: [makeSurvey({ id: 'rev-2', status: 'requested' }), EARLIER] });
    expect(await screen.findByText('1 outstanding')).toBeInTheDocument();
  });

  it('states when no supersession reason was recorded instead of styling over it', async () => {
    const user = userEvent.setup();
    renderSection({
      surveys: [CURRENT, makeSurvey({ ...EARLIER, supersessionReason: null })],
    });

    await user.click(await screen.findByRole('button', { name: /1 earlier record/ }));
    expect(screen.getByText(/no reason was recorded/)).toBeInTheDocument();
  });
});

// The gap this suite closes: C5.2 shipped the backend and a READ-ONLY card, so
// with the flag on no survey record could be created from the browser at all —
// while the returned-record copy instructed the reader to "file the corrected
// report as a new survey record", an act with no affordance anywhere.
describe('filing a survey record', () => {
  it('offers the editor to the creator roles', async () => {
    // `site_engineer` is in SURVEY_CREATORS and NOT in SURVEY_DECIDERS: they may
    // file a record without being able to judge one.
    renderSection({ role: 'site_engineer' });
    expect(await screen.findByRole('button', { name: /Record a survey/ })).toBeInTheDocument();
  });

  it.each(['foreman', 'viewer'])('does not offer it to %s', async (role) => {
    renderSection({ role });
    await screen.findByText('Surveyor-stated verdict');
    expect(screen.queryByRole('button', { name: /Record a survey/ })).not.toBeInTheDocument();
  });

  it('offers it from the empty state, which is where every fresh lot starts', async () => {
    renderSection({ surveys: [] });

    const empty = await screen.findByText('No survey records filed against this lot.');
    expect(
      within(empty.parentElement!).getByRole('button', { name: /Record a survey/ }),
    ).toBeInTheDocument();
  });

  it('sends the transcribed record and re-reads the lot', async () => {
    const user = userEvent.setup();
    renderSection({ surveys: [] });

    const dialog = await openEditor(user, /Record a survey/);
    await user.selectOptions(within(dialog).getByLabelText('Survey type'), 'conformance');
    await user.type(within(dialog).getByLabelText('Surveyor'), 'R. Tanaka');
    await user.type(within(dialog).getByLabelText('Surveying company'), 'Veris Ltd');
    await user.selectOptions(
      within(dialog).getByLabelText('What the report states'),
      'does_not_conform',
    );

    const readsBefore = callsTo(LOT_SURVEYS_PATH);
    await user.click(within(dialog).getByRole('button', { name: 'File record' }));

    await waitFor(() => expect(lastBody(CREATE_PATH)).not.toBeNull());
    expect(lastBody(CREATE_PATH)).toEqual({
      kind: 'conformance',
      // Nothing has arrived yet, so the record is filed as requested — and the
      // verdict transcribed off a report is carried, never computed.
      status: 'requested',
      reportDocumentId: null,
      surveyorName: 'R. Tanaka',
      surveyorCompany: 'Veris Ltd',
      surveyorRegistration: null,
      surveyedAt: null,
      surveyorVerdict: 'does_not_conform',
      verdictSourceNote: null,
      notes: null,
    });

    // Readiness counts unreceived records, so the lot must re-read.
    await waitFor(() => expect(callsTo(LOT_SURVEYS_PATH)).toBeGreaterThan(readsBefore));
  });

  it('refuses to file an arrived report with no surveyor and no report file', async () => {
    const user = userEvent.setup();
    renderSection({ surveys: [] });

    const dialog = await openEditor(user, /Record a survey/);
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'received');
    await user.click(within(dialog).getByRole('button', { name: 'File record' }));

    expect(
      await within(dialog).findByText(/Record the surveyor who performed the survey/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Attach the report before recording it as received.'),
    ).toBeInTheDocument();
    expect(lastBody(CREATE_PATH)).toBeNull();
  });
});

describe('the corrected report, from the record that promised it', () => {
  const RETURNED = makeSurvey({
    status: 'returned_for_correction',
    returnReason: 'Chainage gaps exceed 50 m',
  });

  it('files a new record and points the returned one at it', async () => {
    const user = userEvent.setup();
    renderSection({ surveys: [RETURNED] });

    const dialog = await openEditor(user, 'File the corrected report');
    // `kind` is locked: `(lot_id, kind)` is the identity the backend's
    // supersession check uses, so the replacement must match.
    expect(within(dialog).queryByLabelText('Survey type')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Conformance')).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('Report file'), 'doc-9');
    await user.type(
      within(dialog).getByLabelText('Why this survey was redone'),
      're-survey after trim and re-roll',
    );
    await user.click(within(dialog).getByRole('button', { name: 'File record' }));

    await waitFor(() => expect(lastBody(CREATE_PATH)).not.toBeNull());
    // The corrected report arrived — that is what filing it means.
    expect(lastBody(CREATE_PATH)).toMatchObject({
      kind: 'conformance',
      status: 'received',
      reportDocumentId: 'doc-9',
      surveyorName: 'R. Tanaka',
      // Carried forward: the same surveyor. NOT carried: the verdict the
      // returned report stated, which is what this record replaces.
      surveyorVerdict: null,
    });

    // The OLD record points at the NEW one, never the other way round.
    await waitFor(() =>
      expect(lastBody('/api/surveys/survey-current/supersede')).toEqual({
        supersededById: 'survey-new',
        reason: 're-survey after trim and re-roll',
      }),
    );
  });

  it('is offered only to the decider roles', async () => {
    renderSection({ surveys: [RETURNED], role: 'site_engineer' });

    await screen.findByText('Surveyor-stated verdict');
    expect(
      screen.queryByRole('button', { name: 'File the corrected report' }),
    ).not.toBeInTheDocument();
  });
});

describe('what the backend freezes, the card does not offer', () => {
  it('gives a superseded revision no edit affordance', async () => {
    const user = userEvent.setup();
    const current = makeSurvey({ id: 'rev-2' });
    const earlier = makeSurvey({ id: 'rev-1', supersededById: 'rev-2' });
    renderSection({ surveys: [current, earlier] });

    await user.click(await screen.findByRole('button', { name: /1 earlier record/ }));

    // Exactly one Edit button on the card — the current record's. A superseded
    // record is what its replacement was written against; editing it rewrites
    // history, and the route refuses it.
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
  });

  it('lets the current record be corrected', async () => {
    const user = userEvent.setup();
    renderSection();

    const dialog = await openEditor(user, 'Edit');

    // A received record has no status edge out except the return, so the status
    // control is a fact here rather than a select.
    expect(within(dialog).queryByLabelText('Status')).not.toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Surveyor'));
    await user.type(within(dialog).getByLabelText('Surveyor'), 'R. Tanaka-Wu');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(lastBody('/api/surveys/survey-current')).not.toBeNull());
    const patch = lastBody('/api/surveys/survey-current')!;
    expect(patch.surveyorName).toBe('R. Tanaka-Wu');
    // PATCH accepts none of these three — they move by their own routes, or not
    // at all — and sending them would be a 400 on a strict schema.
    expect(patch).not.toHaveProperty('kind');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('reportDocumentId');
  });
});

describe('empty states are stated, never collapsed', () => {
  it('shows both empty sections rather than hiding them', async () => {
    renderSection({ surveys: [], deliveries: [] });

    expect(
      await screen.findByText('No survey records filed against this lot.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/No deliveries linked to this lot/)).toBeInTheDocument();
  });

  // The downstream contract, verified against the shipped backend: the folio
  // takes both (routes/folio/assemble.ts), the hold-point package takes surveys
  // only (routes/holdpoints/surveyEvidence.ts).
  it('states the downstream contract exactly', async () => {
    renderSection();
    expect(
      await screen.findByText(
        /Surveys and deliveries enter the lot folio; only surveys enter the hold-point evidence package\./,
      ),
    ).toBeInTheDocument();
  });
});
