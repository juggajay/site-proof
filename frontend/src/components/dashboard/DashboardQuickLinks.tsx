import { Link } from 'react-router-dom';
import { Camera, FileText, FlaskConical, FolderKanban, Plus, Settings2 } from 'lucide-react';

interface DashboardQuickLinksProps {
  reportsQuickLink: string;
}

export function DashboardQuickLinks({ reportsQuickLink }: DashboardQuickLinksProps) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Quick Links</h2>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-4">
        <Link
          to="/projects"
          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
        >
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Projects</span>
        </Link>
        <Link
          to="/portfolio"
          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Portfolio</span>
        </Link>
        <Link
          to={reportsQuickLink}
          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Reports</span>
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Settings</span>
        </Link>
      </div>
      {/* Feature #500: Quick Actions */}
      <div className="px-4 pb-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quick Actions
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            to="/projects?action=photo"
            className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Quick Photo</span>
          </Link>
          <Link
            to="/projects?action=create-lot"
            className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Create Lot</span>
          </Link>
          <Link
            to="/projects?action=add-test"
            className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:border-foreground/20 hover:bg-muted"
          >
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Add Test</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
