import { Link } from 'react-router-dom';
import { BarChart3, ClipboardCheck, DollarSign, Layers } from 'lucide-react';
import { getProjectRoute, type PMDashboardData } from './ProjectManagerDashboardHelpers';

type PMProject = NonNullable<PMDashboardData['project']>;

export function ProjectManagerProjectContext({ project }: { project: PMProject }) {
  return (
    <div className="text-sm text-muted-foreground border-l-4 border-primary pl-3">
      <strong>{project.name}</strong>
      {project.projectNumber && ` (${project.projectNumber})`}
      <span
        className={`ml-2 px-2 py-0.5 rounded text-xs ${
          project.status === 'active'
            ? 'border border-success/30 bg-success/10 text-success'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {project.status}
      </span>
    </div>
  );
}

export function ProjectManagerQuickActions({ projectId }: { projectId: string | undefined }) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
      </div>
      <div className="p-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Link
          to={getProjectRoute(projectId, '/lots')}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Manage Lots</span>
        </Link>
        <Link
          to={getProjectRoute(projectId, '/claims')}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Progress Claims</span>
        </Link>
        <Link
          to={getProjectRoute(projectId, '/reports')}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Reports</span>
        </Link>
        <Link
          to={getProjectRoute(projectId, '/dockets')}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Docket Approvals</span>
        </Link>
      </div>
    </div>
  );
}
