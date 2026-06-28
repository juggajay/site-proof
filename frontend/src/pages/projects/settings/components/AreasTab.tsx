import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface AreasTabProps {
  projectId: string;
  readOnly?: boolean;
}

export function AreasTab({ projectId, readOnly = false }: AreasTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Project Areas</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Define areas or zones within your project for organization and reporting.
        </p>
        {readOnly ? (
          <>
            <div role="status" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              Areas are read-only while this project is archived.
            </div>
            <Button type="button" disabled>
              <MapPin className="h-4 w-4" />
              Manage Areas
            </Button>
          </>
        ) : (
          <Link
            to={`/projects/${encodeURIComponent(projectId)}/areas`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <MapPin className="h-4 w-4" />
            Manage Areas
          </Link>
        )}
      </div>
    </div>
  );
}
