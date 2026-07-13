import { Spline } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ControlLinesTabProps {
  projectId: string;
  readOnly?: boolean;
}

export function ControlLinesTab({ projectId, readOnly = false }: ControlLinesTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">Control Lines</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Define survey alignments (chainage, easting, northing) so lots can be placed by chainage
          and offset and rendered on the map.
        </p>
        {readOnly ? (
          <>
            <div role="status" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              Control lines are read-only while this project is archived.
            </div>
            <Button type="button" disabled>
              <Spline className="h-4 w-4" />
              Manage Control Lines
            </Button>
          </>
        ) : (
          <Link
            to={`/projects/${encodeURIComponent(projectId)}/control-lines`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Spline className="h-4 w-4" />
            Manage Control Lines
          </Link>
        )}
      </div>
    </div>
  );
}
