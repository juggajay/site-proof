import { AlertTriangle, ClipboardCheck, Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface DashboardIssueSummaryWidgetProps {
  title: string;
  countLabel: string;
  count: number;
  linkLabel: string;
  to: string;
  headerIcon: ReactNode;
  countIcon: ReactNode;
  onNavigate: (to: string) => void;
}

function DashboardIssueSummaryWidget({
  title,
  countLabel,
  count,
  linkLabel,
  to,
  headerIcon,
  countIcon,
  onNavigate,
}: DashboardIssueSummaryWidgetProps) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4 border-b flex items-center gap-2">
        {headerIcon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-4">
        <button
          onClick={() => onNavigate(to)}
          className="w-full flex items-center justify-between mb-4 p-2 -m-2 rounded hover:bg-muted transition-colors"
          type="button"
        >
          <div className="flex items-center gap-2">
            {countIcon}
            <span>{countLabel}</span>
          </div>
          <span className="text-2xl font-bold">{count}</span>
        </button>
        <Link to={to} className="text-sm text-primary hover:underline">
          {linkLabel}
        </Link>
      </div>
    </div>
  );
}

interface HoldPointsSummaryWidgetProps {
  openHoldPoints: number;
  onNavigate: (to: string) => void;
}

export function HoldPointsSummaryWidget({
  openHoldPoints,
  onNavigate,
}: HoldPointsSummaryWidgetProps) {
  return (
    <DashboardIssueSummaryWidget
      title="Hold Points"
      countLabel="Open Hold Points"
      count={openHoldPoints}
      linkLabel="View all hold points →"
      to="/projects?view=holdpoints"
      headerIcon={<ClipboardCheck className="h-5 w-5 text-muted-foreground" />}
      countIcon={<Clock className="h-5 w-5 text-amber-500" />}
      onNavigate={onNavigate}
    />
  );
}

interface NcrSummaryWidgetProps {
  openNCRs: number;
  onNavigate: (to: string) => void;
}

export function NcrSummaryWidget({ openNCRs, onNavigate }: NcrSummaryWidgetProps) {
  return (
    <DashboardIssueSummaryWidget
      title="Non-Conformance Reports"
      countLabel="Open NCRs"
      count={openNCRs}
      linkLabel="View all NCRs →"
      to="/projects?view=ncrs"
      headerIcon={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
      countIcon={<AlertTriangle className="h-5 w-5 text-red-500" />}
      onNavigate={onNavigate}
    />
  );
}
