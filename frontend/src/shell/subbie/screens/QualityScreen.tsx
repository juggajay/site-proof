/**
 * QualityScreen — /p/quality — the subbie shell's read-only QA visibility surface.
 *
 * Implements docs/design-subbie-shell-mock-v1.html #quality on the proven inner
 * ShellScreen. A COMBINED screen: a HOLD POINTS section (gated by the holdPoints
 * module) followed by a TEST RESULTS section (gated by the testResults module).
 * Only enabled sections render; if NEITHER module is on the screen shows an
 * access-denied notice (the Home "Holds & Tests" tile shows when either is on).
 *
 * NEW PRESENTATION over EXISTING LOGIC. Reuses the SAME TanStack queries +
 * normalizers the classic portal pages use (cache shared, no double-fetch):
 *   - hold points: GET /api/holdpoints/project/:projectId?subcontractorView=true
 *     (queryKeys.portalHoldPoints). Uses the classic portal's shared normalizer.
 *   - tests: GET /api/test-results?projectId=&subcontractorView=true
 *     (queryKeys.portalTestResults). `normalizeTestResult` likewise replicated.
 *
 * Read-only: no release / manage affordances anywhere (the HC releases hold
 * points; the subbie only sees status).
 */
import { Flag, FlaskConical, ShieldOff } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { cn } from '@/lib/utils';
import { getReleaseIdentityParts } from '@/pages/holdpoints/holdPointReleaseIdentity';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import {
  normalizeSubcontractorHoldPoint,
  type ApiSubcontractorHoldPoint,
  type SubcontractorHoldPoint,
} from '@/pages/subcontractor-portal/subcontractorHoldPointData';
import { useSubbieShellContext } from '../subbieShellContext';
import { useModuleAccessRevoked } from '../useModuleAccessRevoked';
import { ModuleAccessChangedNotice } from '../ModuleAccessChangedNotice';

// ── Test-result shapes (classic SubcontractorTestResultsPage contract) ────────

interface TestResult {
  id: string;
  lotId: string | null;
  lotNumber: string;
  testType: string;
  result: 'pass' | 'fail' | 'pending';
  value?: string;
}

interface ApiTestResult {
  id: string;
  lotId: string | null;
  lot?: { lotNumber?: string | null } | null;
  testType: string;
  passFail?: string | null;
  status?: string | null;
  resultValue?: number | string | null;
  resultUnit?: string | null;
  requirement?: string | null;
  sampleDate?: string | null;
  testDate?: string | null;
  resultDate?: string | null;
  createdAt: string;
}

// Faithful replica of the classic page's (un-exported) normalizeTestResult, with
// `requirement` carried through for the mock's "· req ≥ X" line when available.
function normalizeTestResult(test: ApiTestResult): TestResult & { requirement?: string } {
  const result = test.passFail === 'pass' || test.passFail === 'fail' ? test.passFail : 'pending';
  const value =
    test.resultValue != null
      ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
      : undefined;

  return {
    id: test.id,
    lotId: test.lotId ?? null,
    lotNumber: test.lot?.lotNumber || 'Unassigned lot',
    testType: test.testType,
    result,
    value,
    requirement: test.requirement || undefined,
  };
}

// ── Presentation helpers ──────────────────────────────────────────────────────

function formatReleaseDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mt-1 flex items-baseline justify-between">
      <span className="font-mono text-[11.5px] font-semibold tracking-[0.12em] text-muted-foreground">
        {children}
      </span>
      {count !== undefined && (
        <span className="font-mono text-[11.5px] font-medium text-muted-foreground/70">
          {count}
        </span>
      )}
    </div>
  );
}

// ── Hold-point card ───────────────────────────────────────────────────────────

function HoldPointCard({ holdPoint }: { holdPoint: SubcontractorHoldPoint }) {
  const released = holdPoint.status === 'released';
  const rejected = holdPoint.status === 'rejected';
  const releaseIdentity = released ? getReleaseIdentityParts(holdPoint) : null;
  const releaseLabel =
    releaseIdentity?.primary && releaseIdentity.primary !== 'Release recorded'
      ? `Released by ${releaseIdentity.primary}`
      : 'Release recorded';
  // pending + notified → WAITING (mock); released / rejected distinct.
  const badge = released
    ? { label: 'RELEASED', cls: 'shell-badge-ok' }
    : rejected
      ? { label: 'REJECTED', cls: 'shell-badge-bad' }
      : { label: 'WAITING', cls: 'shell-badge-pend' };

  const iconColor = released ? 'text-success' : rejected ? 'text-destructive' : 'text-warning';

  const meta =
    released && holdPoint.releasedAt
      ? `${releaseLabel} · ${formatReleaseDate(holdPoint.releasedAt)}`
      : rejected
        ? 'Released was rejected — check with the head contractor.'
        : "Waiting on release. Work past this point can't start yet.";

  return (
    <div className="shell-card">
      <div className="flex items-start gap-3">
        <Flag size={19} className={cn('mt-px shrink-0', iconColor)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-foreground">
            {holdPoint.description}
            {holdPoint.lotNumber ? ` — ${holdPoint.lotNumber}` : ''}
          </div>
          <div className="mt-[3px] text-[13px] leading-snug text-muted-foreground">{meta}</div>
          {released && releaseIdentity?.secondary && (
            <div className="mt-[2px] text-[12.5px] leading-snug text-muted-foreground">
              {releaseIdentity.secondary}
            </div>
          )}
        </div>
        <span className={cn('shell-badge', badge.cls)}>{badge.label}</span>
      </div>
    </div>
  );
}

// ── Test-result card ──────────────────────────────────────────────────────────

function TestResultCard({ test }: { test: TestResult & { requirement?: string } }) {
  const badge =
    test.result === 'pass'
      ? { label: 'PASS', cls: 'shell-badge-ok' }
      : test.result === 'fail'
        ? { label: 'FAIL', cls: 'shell-badge-bad' }
        : { label: 'PENDING', cls: 'shell-badge-pend' };

  const iconColor =
    test.result === 'pass'
      ? 'text-success'
      : test.result === 'fail'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <div className="shell-card">
      <div className="flex items-start gap-3">
        <FlaskConical size={19} className={cn('mt-px shrink-0', iconColor)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-foreground">
            {test.testType}
            {test.lotNumber ? ` — ${test.lotNumber}` : ''}
          </div>
          {test.value ? (
            <div className="mt-[3px] font-mono text-[12.5px] text-muted-foreground">
              {test.value}
              {test.requirement ? ` · req ${test.requirement}` : ''}
            </div>
          ) : (
            <div className="mt-[3px] text-[13px] leading-snug text-muted-foreground">
              Result not in yet.
            </div>
          )}
        </div>
        <span className={cn('shell-badge', badge.cls)}>{badge.label}</span>
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function QualityScreen() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const lotFilter = searchParams.get('lotId');
  const { projectId, subcontractorCompanyId, isModuleEnabled } = useSubbieShellContext();

  const holdsEnabled = isModuleEnabled('holdPoints');
  const testsEnabled = isModuleEnabled('testResults');
  const eitherEnabled = holdsEnabled || testsEnabled;
  const encodedProjectId = projectId ? encodeURIComponent(projectId) : '';
  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });
  const parentPath = `/p${projectQuery}`;

  const holdPointsQuery = useQuery({
    queryKey: queryKeys.portalHoldPoints(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const scopeQuery = buildPortalCompanyQuery({ subcontractorCompanyId });
      const res = await apiFetch<{ holdPoints: ApiSubcontractorHoldPoint[] }>(
        `/api/holdpoints/project/${encodedProjectId}${scopeQuery ? `${scopeQuery}&` : '?'}subcontractorView=true`,
      );
      return (res.holdPoints || []).map(normalizeSubcontractorHoldPoint);
    },
    enabled: !!user?.id && !!projectId && holdsEnabled,
  });

  const testsQuery = useQuery({
    queryKey: queryKeys.portalTestResults(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ testResults?: ApiTestResult[] }>(
        `/api/test-results${projectQuery}${projectQuery ? '&' : '?'}subcontractorView=true`,
      );
      return (res.testResults || []).map(normalizeTestResult);
    },
    enabled: !!user?.id && !!projectId && testsEnabled,
  });

  const allHoldPoints = holdPointsQuery.data ?? [];
  const allTests = testsQuery.data ?? [];

  // Optional lotId scope (from the lot hub) — client-side filter, no re-fetch.
  const holdPoints = lotFilter
    ? allHoldPoints.filter((hp) => hp.lotId === lotFilter)
    : allHoldPoints;
  const tests = lotFilter ? allTests.filter((t) => t.lotId === lotFilter) : allTests;

  // Label the scoped lot from whatever matched (payload carries lot number).
  const scopedLotNumber = lotFilter
    ? (holdPoints[0]?.lotNumber ?? tests[0]?.lotNumber ?? null)
    : null;
  const viewAllPath = `/p/quality${projectQuery}`;

  // Hold points: WAITING (pending+notified) first, then released, then rejected.
  const waiting = holdPoints.filter((hp) => hp.status === 'pending' || hp.status === 'notified');
  const released = holdPoints.filter((hp) => hp.status === 'released');
  const rejected = holdPoints.filter((hp) => hp.status === 'rejected');
  const orderedHolds = [...waiting, ...released, ...rejected];

  // Tests: Failed first, then Pending, then Passed (classic order).
  const failed = tests.filter((t) => t.result === 'fail');
  const pendingTests = tests.filter((t) => t.result === 'pending');
  const passed = tests.filter((t) => t.result === 'pass');
  const orderedTests = [...failed, ...pendingTests, ...passed];

  const holdsError = holdsEnabled && holdPointsQuery.error ? holdPointsQuery.error : null;
  const testsError = testsEnabled && testsQuery.error ? testsQuery.error : null;
  const accessRevoked = useModuleAccessRevoked(holdsError ?? testsError);

  // Neither module → access denied.
  if (!eitherEnabled) {
    return (
      <ShellScreen
        variant="inner"
        title="Holds &amp; Tests"
        parent={parentPath}
        sub={<span className="text-muted-foreground">Read-only</span>}
      >
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldOff size={28} className="text-muted-foreground/50" aria-hidden="true" />
          <p className="max-w-[280px] text-[14px] leading-relaxed text-muted-foreground">
            The head contractor hasn’t shared hold points or test results with your company on this
            project.
          </p>
        </div>
      </ShellScreen>
    );
  }

  return (
    <ShellScreen
      variant="inner"
      title="Holds &amp; Tests"
      parent={parentPath}
      sub={
        <span className="text-muted-foreground">
          Read-only — the head contractor releases these
        </span>
      }
    >
      {accessRevoked && <ModuleAccessChangedNotice />}

      {/* Lot-scope banner — when the lot hub deep-links here with ?lotId= */}
      {lotFilter && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-[13px]">
          <span className="text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">{scopedLotNumber ?? 'this lot'}</span>
          </span>
          <Link to={viewAllPath} className="font-semibold text-foreground underline">
            View all
          </Link>
        </div>
      )}

      {/* HOLD POINTS section (holdPoints module) */}
      {!accessRevoked && holdsEnabled && (
        <>
          <SectionLabel count={holdPoints.length || undefined}>HOLD POINTS</SectionLabel>
          {holdsError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
              {extractErrorMessage(holdsError, 'Failed to load hold points')}
            </div>
          ) : holdPoints.length === 0 ? (
            <p className="px-1 py-2 text-[13.5px] text-muted-foreground">
              No hold points on your lots yet.
            </p>
          ) : (
            orderedHolds.map((hp) => <HoldPointCard key={hp.id} holdPoint={hp} />)
          )}
        </>
      )}

      {/* TEST RESULTS section (testResults module) */}
      {!accessRevoked && testsEnabled && (
        <>
          <SectionLabel count={tests.length || undefined}>TEST RESULTS</SectionLabel>
          {testsError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
              {extractErrorMessage(testsError, 'Failed to load test results')}
            </div>
          ) : tests.length === 0 ? (
            <p className="px-1 py-2 text-[13.5px] text-muted-foreground">
              No test results on your lots yet.
            </p>
          ) : (
            orderedTests.map((t) => <TestResultCard key={t.id} test={t} />)
          )}
        </>
      )}
    </ShellScreen>
  );
}
