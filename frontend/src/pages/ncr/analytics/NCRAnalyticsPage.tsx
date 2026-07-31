/**
 * Wave G G5 — the management learning loop's read surface
 * (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5.1, AT-G26).
 *
 * `GET /api/ncrs/analytics/:projectId` has computed root-cause breakdowns,
 * monthly trends, repeat issues and repeat offenders since it shipped, and had
 * **zero frontend consumers**. This page is the first one. It adds no
 * aggregation of its own: everything shown is computed server-side, so a number
 * on this page and a number in a report cannot disagree.
 *
 * Two honesty rules the page holds to:
 *
 *  - **"Activity not classified" is shown, never hidden.** `Lot.activitySlug` is
 *    nullable and an NCR may carry no lot; a work-type chart that quietly
 *    dropped those would overstate how much of the corpus it describes (AT-G28).
 *  - **Recurring-failure coverage is stated.** The checklist-item link only
 *    exists for NCRs raised after G5, so the section says how many NCRs it can
 *    see rather than implying it sees them all.
 *
 * The "Propose a template change" affordance self-gates on a 404, the same way
 * G1's revision timeline does — `/api/ncr-learning` does not exist while
 * NCR_LEARNING_LOOP_ENABLED is unset, and no frontend flag mirror is needed.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, TrendingUp } from 'lucide-react';

import { ApiError, apiGet } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/components/charts';

import {
  RecurringItemsSection,
  RepeatIssuesSection,
  RepeatOffendersSection,
} from './NCRAnalyticsSections';
import { ProposeTemplateChangeModal } from './ProposeTemplateChangeModal';
import type { ChartDatum, NcrAnalytics, RecurringChecklistItem } from './ncrAnalyticsTypes';

function SummaryTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-3xl font-bold mt-1">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function BreakdownChart({
  title,
  description,
  data,
}: {
  title: string;
  description?: string;
  data: ChartDatum[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No NCRs in this range.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="value" name="NCRs" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NCRAnalyticsPage() {
  const { projectId } = useParams();
  const [proposalTarget, setProposalTarget] = useState<RecurringChecklistItem | null>(null);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.ncrAnalytics(projectId ?? ''),
    queryFn: () => apiGet<NcrAnalytics>(`/api/ncrs/analytics/${encodeURIComponent(projectId!)}`),
    enabled: Boolean(projectId),
  });

  if (!projectId) {
    return <p className="text-sm text-muted-foreground">Open this page from inside a project.</p>;
  }

  if (analyticsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading NCR trends…</p>;
  }

  if (analyticsQuery.error) {
    const forbidden =
      analyticsQuery.error instanceof ApiError && analyticsQuery.error.status === 403;
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          {forbidden ? 'NCR trends are an office view' : 'Could not load NCR trends'}
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {forbidden
            ? 'Repeat-failure and subcontractor trends are visible to owners, admins, project managers, site managers and quality managers.'
            : 'Try again, or check that you still have access to this project.'}
        </p>
      </div>
    );
  }

  const data = analyticsQuery.data;
  if (!data) return null;

  const { summary, charts, repeatIssues, repeatOffenders, recurringItems } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <h1 className="text-3xl font-bold">NCR trends</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            What keeps going wrong on this project, and where it keeps going wrong.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/projects/${projectId}/ncr`}>
            <ArrowLeft className="h-4 w-4" />
            NCR register
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryTile label="Total NCRs" value={String(summary.total)} />
        <SummaryTile label="Open" value={String(summary.open)} />
        <SummaryTile
          label="Overdue"
          value={String(summary.overdue)}
          hint={summary.overdue > 0 ? 'Past due date and not closed' : undefined}
        />
        <SummaryTile
          label="Average days to close"
          value={summary.avgDaysToClose ? summary.avgDaysToClose.toFixed(1) : '—'}
          hint={`${summary.closureRate}% closed`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownChart title={charts.rootCause.title} data={charts.rootCause.data} />
        <BreakdownChart title={charts.category.title} data={charts.category.data} />
      </div>

      <BreakdownChart
        title={charts.activity.title}
        description={charts.activity.description}
        data={charts.activity.data}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{charts.volumeTrend.title}</CardTitle>
          <CardDescription>{charts.volumeTrend.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {charts.volumeTrend.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No NCRs in this range.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.volumeTrend.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line type="monotone" dataKey="count" name="NCRs raised" stroke="#0ea5e9" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <RepeatIssuesSection section={repeatIssues} />
      <RepeatOffendersSection section={repeatOffenders} />
      <RecurringItemsSection section={recurringItems} onPropose={setProposalTarget} />

      {proposalTarget ? (
        <ProposeTemplateChangeModal
          projectId={projectId}
          item={proposalTarget}
          onClose={() => setProposalTarget(null)}
        />
      ) : null}
    </div>
  );
}

export default NCRAnalyticsPage;
