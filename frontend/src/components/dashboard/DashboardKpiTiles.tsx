import { CheckCircle2, FolderKanban, ListChecks, Users } from 'lucide-react';

interface DashboardKpiTilesProps {
  totalProjects: number;
  activeProjects: number;
  totalLots: number;
  onNavigate: (to: string) => void;
}

export function DashboardKpiTiles({
  totalProjects,
  activeProjects,
  totalLots,
  onNavigate,
}: DashboardKpiTilesProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <button
        onClick={() => onNavigate('/projects')}
        className="bg-card rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FolderKanban className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Projects</p>
            <p className="text-2xl font-bold">{totalProjects}</p>
          </div>
        </div>
      </button>

      <button
        onClick={() => onNavigate('/projects?status=active')}
        className="bg-card rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Projects</p>
            <p className="text-2xl font-bold">{activeProjects}</p>
          </div>
        </div>
      </button>

      <button
        onClick={() => onNavigate('/projects')}
        className="bg-card rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
        title="View all lots in projects"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ListChecks className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Lots</p>
            <p className="text-2xl font-bold">{totalLots}</p>
          </div>
        </div>
      </button>

      <button
        onClick={() => onNavigate('/company-settings')}
        className="bg-card rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left"
        title="Manage company settings"
        type="button"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Users className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Team Members</p>
            <p className="text-2xl font-bold">—</p>
          </div>
        </div>
      </button>
    </div>
  );
}
