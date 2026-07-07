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
      <div className="flex items-center gap-2 border-b p-4">
        {headerIcon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">
        <button
          onClick={() => onNavigate(to)}
          className="-m-2 mb-2 flex w-full items-center justify-between rounded-md p-2 transition-colors hover:bg-muted"
          type="button"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {countIcon}
            <span>{countLabel}</span>
          </div>
          <span className="font-mono text-2xl font-medium tabular-nums text-foreground">
            {count}
          </span>
        </button>
        <Link to={to} className="text-sm text-muted-foreground hover:text-foreground">
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
      to="/projects"
      headerIcon={<ClipboardCheck className="h-4 w-4 text-muted-foreground" />}
      countIcon={<Clock className="h-4 w-4 text-warning" />}
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
      to="/projects"
      headerIcon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
      countIcon={<AlertTriangle className="h-4 w-4 text-destructive" />}
      onNavigate={onNavigate}
    />
  );
}
