import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HoldPoint } from '@/pages/holdpoints/types';
import type { QualityAccess } from '@/pages/lots/types';
import type { LotEvidenceReadiness } from '@/types/evidenceReadiness';
import type { ProjectControlLine, ProjectLotGeometry } from './lotMapData';
import type { LotStatusEventRow } from './lotInspectorData';

// The data hooks are stubbed per test; every pure helper stays real, so the
// blocking rows / ordering / search behaviour under test is the shipped code.
type QueryStub<T> = { data: T; isLoading: boolean; error: unknown; refetch: () => void };
function stub<T>(data: T): QueryStub<T> {
  return { data, isLoading: false, error: null, refetch: vi.fn() };
}

const readinessQuery = vi.hoisted(() => ({
  current: {} as QueryStub<{ readiness: LotEvidenceReadiness } | undefined>,
}));
const eventsQuery = vi.hoisted(() => ({
  current: {} as QueryStub<{ events: LotStatusEventRow[] } | undefined>,
}));
const holdPointsQuery = vi.hoisted(() => ({ current: {} as QueryStub<HoldPoint[] | undefined> }));
const itpQuery = vi.hoisted(() => ({ current: {} as QueryStub<{ instance: null } | undefined> }));

vi.mock('./lotInspectorData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lotInspectorData')>()),
  useLotReadiness: () => readinessQuery.current,
  useLotStatusEvents: () => eventsQuery.current,
  useProjectHoldPoints: () => holdPointsQuery.current,
  useLotItpInstance: () => itpQuery.current,
}));

const qualityAccess = vi.hoisted(() => ({ current: undefined as QualityAccess | undefined }));
vi.mock('@/pages/lots/lotDetailData', () => ({
  useLotQualityAccessQuery: () => ({ data: qualityAccess.current }),
}));

const surveysData = vi.hoisted(() => ({
  current: undefined as { surveys: { supersededById: string | null }[] } | undefined,
}));
vi.mock('@/pages/lots/hooks/useLotSurveyMaterials', () => ({
  useLotSurveys: () => ({ data: surveysData.current }),
}));

vi.mock('@/components/documents/SecureDocumentImage', () => ({
  SecureDocumentImage: ({ documentId, alt }: { documentId: string; alt?: string }) => (
    <img data-testid={`secure-img-${documentId}`} alt={alt} />
  ),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { LotInspector } from './LotInspector';
import { buildMapLinkPaths } from './lotMapHelpers';

function geometry(over: Partial<ProjectLotGeometry> = {}): ProjectLotGeometry {
  return {
    id: 'geo-1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    status: 'in_progress',
    activityType: 'Earthworks',
    kind: 'chainage_offset',
    controlLineId: 'cl-1',
    geometryWgs84: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [151.0, -33.8],
            [151.001, -33.8],
            [151.001, -33.801],
            [151.0, -33.8],
          ],
        ],
      },
    },
    areaM2: 1234.6,
    lengthM: 100,
    chainageStart: 0,
    chainageEnd: 100,
    ...over,
  };
}

const controlLine: ProjectControlLine = {
  id: 'cl-1',
  projectId: 'proj-1',
  name: 'MC00 Mainline',
  coordinateSystem: 'EPSG:7856',
  points: [],
  geometryWgs84: null,
};

function readiness(over: Partial<LotEvidenceReadiness['conformStatus']>): {
  readiness: LotEvidenceReadiness;
} {
  return {
    readiness: {
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      status: 'in_progress',
      conformStatus: {
        canConform: false,
        blockingReasons: [],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: true,
          itpCompletedCount: 12,
          itpTotalCount: 12,
          testRequired: false,
          hasPassingTest: false,
          noOpenNcrs: true,
          openNcrs: [],
        },
        ...over,
      },
      conformance: { state: 'blocked', blockers: [], warnings: [], support: [] },
      claim: { state: 'blocked', blockers: [], warnings: [], support: [] },
      summary: { blockerCount: 0, warningCount: 0, supportCount: 0, actionBlockerCount: 0 },
    },
  };
}

const geometries = [
  geometry(),
  geometry({
    id: 'geo-2',
    lotId: 'lot-2',
    lotNumber: 'LOT-002',
    chainageStart: 100,
    chainageEnd: 200,
  }),
  geometry({
    id: 'geo-3',
    lotId: 'lot-3',
    lotNumber: 'LOT-003',
    chainageStart: 200,
    chainageEnd: 300,
  }),
];

const onClose = vi.fn();
const onSelectLot = vi.fn();

function renderInspector(over: Partial<Parameters<typeof LotInspector>[0]> = {}) {
  return render(
    <LotInspector
      projectId="proj-1"
      geometry={geometries[1]}
      geometries={geometries}
      controlLines={[controlLine]}
      linkPaths={buildMapLinkPaths('proj-1', undefined)}
      isMobile={false}
      pastView={false}
      onClose={onClose}
      onSelectLot={onSelectLot}
      {...over}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  readinessQuery.current = stub(undefined);
  eventsQuery.current = stub(undefined);
  holdPointsQuery.current = stub(undefined);
  itpQuery.current = stub(undefined);
  qualityAccess.current = undefined;
  surveysData.current = undefined;
});

describe('LotInspector', () => {
  it('leads with identity: lot number, plain-words status, activity, chainage', () => {
    renderInspector();
    expect(screen.getByTestId('lot-inspector-title-lot-2')).toHaveTextContent('LOT-002');
    // m6 order: status in plain words right under the number, never a raw enum.
    expect(screen.getByText(/In Progress · Earthworks · Ch 100–200/)).toBeInTheDocument();
  });

  it('renders the blocking block: hold points with age, outstanding tests, open NCRs, checklist', () => {
    readinessQuery.current = stub(
      readiness({
        canConform: false,
        prerequisites: {
          itpAssigned: true,
          itpCompleted: false,
          itpCompletedCount: 5,
          itpTotalCount: 12,
          testRequired: true,
          hasPassingTest: false,
          outstandingTestItems: [
            { itemId: 'i1', description: 'Compaction', testType: 'Density', state: 'no_result' },
          ],
          noOpenNcrs: false,
          openNcrs: [{ id: 'n1', ncrNumber: 'NCR-004', status: 'open' }],
        },
      }),
    );
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    holdPointsQuery.current = stub([
      {
        id: 'hp1',
        lotId: 'lot-2',
        status: 'notified',
        description: 'Subgrade inspection',
        createdAt: tenDaysAgo,
      } as HoldPoint,
    ]);

    renderInspector();
    const blocking = screen.getByTestId('lot-inspector-blocking');
    expect(within(blocking).getByText('Blocking conformance')).toBeInTheDocument();
    expect(within(blocking).getByTestId('lot-inspector-hp-hp1')).toHaveTextContent(
      /Subgrade inspection/,
    );
    expect(within(blocking).getByTestId('lot-inspector-hp-hp1')).toHaveTextContent('10d');
    expect(within(blocking).getByTestId('lot-inspector-test-i1')).toHaveTextContent('No result');
    expect(within(blocking).getByTestId('lot-inspector-ncr-n1')).toHaveTextContent('NCR-004');
    expect(within(blocking).getByTestId('lot-inspector-checklist')).toHaveTextContent('5 of 12');
  });

  it('falls back to backend-worded reasons when no structured blocker explains the block', () => {
    readinessQuery.current = stub(
      readiness({ canConform: false, blockingReasons: ['Lot is already conformed'] }),
    );
    renderInspector();
    expect(screen.getByTestId('lot-inspector-blocking')).toHaveTextContent(
      'Lot is already conformed',
    );
  });

  it('shows Ready to conform, with the CTA only for a role the server says can conform', () => {
    readinessQuery.current = stub(readiness({ canConform: true }));
    const { unmount } = renderInspector();
    expect(screen.getByTestId('lot-inspector-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('lot-inspector-conform-cta')).not.toBeInTheDocument();
    unmount();

    qualityAccess.current = {
      role: 'quality_manager',
      isQualityManager: true,
      canConformLots: true,
      canVerifyTestResults: true,
      canCloseNCRs: true,
      canManageITPTemplates: true,
    };
    renderInspector();
    fireEvent.click(screen.getByTestId('lot-inspector-conform-cta'));
    expect(navigate).toHaveBeenCalledWith('/projects/proj-1/lots/lot-2');
  });

  it('walks next/prev along the alignment through the one selection callback', () => {
    renderInspector();
    fireEvent.click(screen.getByTestId('lot-inspector-prev'));
    expect(onSelectLot).toHaveBeenCalledWith('lot-1');
    fireEvent.click(screen.getByTestId('lot-inspector-next'));
    expect(onSelectLot).toHaveBeenCalledWith('lot-3');
  });

  it('disables prev at the start of the alignment', () => {
    renderInspector({ geometry: geometries[0] });
    expect(screen.getByTestId('lot-inspector-prev')).toBeDisabled();
    expect(screen.getByTestId('lot-inspector-next')).toBeEnabled();
  });

  it('search finds lots by number and re-targets selection, excluding the current lot', () => {
    renderInspector();
    fireEvent.change(screen.getByTestId('lot-inspector-search'), {
      target: { value: 'LOT-003' },
    });
    fireEvent.click(screen.getByTestId('lot-inspector-result-lot-3'));
    expect(onSelectLot).toHaveBeenCalledWith('lot-3');

    fireEvent.change(screen.getByTestId('lot-inspector-search'), {
      target: { value: 'LOT-002' },
    });
    expect(screen.getByTestId('lot-inspector-search-results')).toHaveTextContent(
      'No matching lots',
    );
  });

  it('renders the status history from the ledger, newest first, marking reconstructed rows', () => {
    eventsQuery.current = stub({
      events: [
        {
          fromStatus: null,
          toStatus: 'not_started',
          effectiveAt: '2026-01-15T00:00:00.000Z',
          recordedAt: '2026-06-01T00:00:00.000Z',
          source: 'backfill',
        },
        {
          fromStatus: 'not_started',
          toStatus: 'ncr_raised',
          effectiveAt: '2026-02-01T00:00:00.000Z',
          recordedAt: '2026-02-01T00:00:00.000Z',
          source: 'system',
        },
      ],
    });
    renderInspector();
    const history = screen.getByTestId('lot-inspector-history');
    const first = within(history).getByTestId('lot-inspector-event-0');
    expect(first).toHaveTextContent('Not Started → NCR Raised');
    const second = within(history).getByTestId('lot-inspector-event-1');
    expect(second).toHaveTextContent('Created — Not Started');
    expect(second).toHaveTextContent('(reconstructed)');
  });

  it('offers a retry when the history read fails, instead of an empty strip', () => {
    eventsQuery.current = { ...stub(undefined), error: new Error('boom') };
    renderInspector();
    const history = screen.getByTestId('lot-inspector-history');
    expect(history).toHaveTextContent(/Couldn’t load history/);
    fireEvent.click(within(history).getByText('Try again'));
    expect(eventsQuery.current.refetch).toHaveBeenCalled();
  });

  it('states geometry provenance with the control line, and Surveyed only on a live record', () => {
    surveysData.current = { surveys: [{ supersededById: null }] };
    renderInspector();
    expect(screen.getByTestId('lot-inspector-provenance')).toHaveTextContent(
      'From chainage · MC00 Mainline',
    );
    expect(screen.getByTestId('lot-inspector-surveyed')).toBeInTheDocument();
  });

  it('shows no Surveyed badge when every record is superseded', () => {
    surveysData.current = { surveys: [{ supersededById: 'newer' }] };
    renderInspector();
    expect(screen.queryByTestId('lot-inspector-surveyed')).not.toBeInTheDocument();
  });

  it('keeps the full lot page and Directions one tap away', () => {
    renderInspector();
    fireEvent.click(screen.getByTestId('lot-inspector-open-lot'));
    expect(navigate).toHaveBeenCalledWith('/projects/proj-1/lots/lot-2');
    const directions = screen.getByTestId('lot-inspector-directions');
    expect(directions.getAttribute('href')).toMatch(
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d/,
    );
    expect(directions).toHaveAttribute('target', '_blank');
  });

  it('withdraws the live QA blocks in Past view and says why', () => {
    readinessQuery.current = stub(readiness({ canConform: true }));
    renderInspector({ pastView: true });
    expect(screen.queryByTestId('lot-inspector-blocking')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lot-inspector-evidence')).not.toBeInTheDocument();
    expect(screen.getByTestId('lot-inspector-past-note')).toBeInTheDocument();
    // History is history — it stays.
    expect(screen.getByTestId('lot-inspector-history')).toBeInTheDocument();
  });

  it('closes on Escape and on the close button', () => {
    renderInspector();
    fireEvent.click(screen.getByTestId('lot-inspector-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
