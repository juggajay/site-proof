import { Link } from 'react-router-dom';
import { Camera, FileText, FlaskConical, FolderKanban, Plus, Settings2 } from 'lucide-react';

interface DashboardQuickLinksProps {
  reportsQuickLink: string;
}

export function DashboardQuickLinks({ reportsQuickLink }: DashboardQuickLinksProps) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Quick Links</h2>
      </div>
      <div className="p-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Link
          to="/projects"
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <FolderKanban className="h-5 w-5 text-blue-600" />
          <span className="font-medium">Projects</span>
        </Link>
        <Link
          to="/portfolio"
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <FileText className="h-5 w-5 text-purple-600" />
          <span className="font-medium">Portfolio</span>
        </Link>
        <Link
          to={reportsQuickLink}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <FileText className="h-5 w-5 text-green-600" />
          <span className="font-medium">Reports</span>
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
        >
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Settings</span>
        </Link>
      </div>
      {/* Feature #500: Quick Actions */}
      <div className="px-4 pb-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            to="/projects?action=photo"
            className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
          >
            <Camera className="h-5 w-5 text-orange-600" />
            <span className="font-medium text-orange-700">Quick Photo</span>
          </Link>
          <Link
            to="/projects?action=create-lot"
            className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-700">Create Lot</span>
          </Link>
          <Link
            to="/projects?action=add-test"
            className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
          >
            <FlaskConical className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-700">Add Test</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
