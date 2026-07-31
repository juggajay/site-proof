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
import { render, screen, within } from '@testing-library/react';
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

function renderSection({
  surveys = [makeSurvey()],
  deliveries = [] as unknown[],
  role = 'quality_manager',
} = {}) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path.includes('/surveys')) return Promise.resolve({ surveys, readiness: [] });
    if (path.includes('/deliveries')) return Promise.resolve({ deliveries });
    return Promise.resolve({});
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <Wrapper>
      <SurveyMaterialsSection lotId="lot-1" effectiveRole={role} />
    </Wrapper>,
  );
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
    renderSection({ surveys: [makeSurvey({ status: 'accepted', surveyorVerdict: 'conforms' })] });

    // CIVOS accepted the RECORD. It did not find the lot conformant.
    // The same label appears twice by design — once as the badge, once as the
    // final step of the progress list — because both are the same CIVOS state
    // and one vocabulary is the point. The badge is the one outside the `<ol>`.
    const labels = await screen.findAllByText('Evidence record accepted');
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

describe('accepting an evidence record', () => {
  it('confirms with the surveyor, the report and the stated verdict, and disclaims verification', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Accept evidence record' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/R\. Tanaka/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Veris Ltd/)).toBeInTheDocument();
    expect(within(dialog).getByText('CONF-D-014-RevC.pdf')).toBeInTheDocument();
    expect(within(dialog).getByText(/“Conforms”/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/recording the surveyor’s conclusion, not independently verifying/i),
    ).toBeInTheDocument();
  });

  it('is offered only to acceptor roles', async () => {
    renderSection({ role: 'site_engineer' });

    await screen.findByText('Surveyor-stated verdict');
    expect(
      screen.queryByRole('button', { name: 'Accept evidence record' }),
    ).not.toBeInTheDocument();
  });

  it('is disabled with a reason until a verdict has been transcribed', async () => {
    renderSection({ surveys: [makeSurvey({ surveyorVerdict: null })] });

    const button = await screen.findByRole('button', { name: 'Accept evidence record' });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Transcribe the surveyor's stated verdict/i)).toBeInTheDocument();
  });
});

describe('supersession', () => {
  const CURRENT = makeSurvey({ id: 'rev-2', status: 'accepted', surveyedAt: '2026-07-26' });
  const EARLIER = makeSurvey({
    id: 'rev-1',
    status: 'received',
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
    // The current record is accepted; the record it replaced is still
    // `received`. A superseded record was replaced precisely so it would stop
    // being chased, so nothing is outstanding.
    renderSection({ surveys: [CURRENT, EARLIER] });
    await screen.findByText('Current');
    expect(screen.queryByText(/outstanding/)).not.toBeInTheDocument();
  });

  it('counts a current non-terminal record as outstanding', async () => {
    renderSection({ surveys: [makeSurvey({ id: 'rev-2', status: 'received' }), EARLIER] });
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
