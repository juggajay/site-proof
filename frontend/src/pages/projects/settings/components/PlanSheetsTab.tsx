import { Map } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface PlanSheetsTabProps {
  projectId: string;
  readOnly?: boolean;
}

export function PlanSheetsTab({ projectId, readOnly = false }: PlanSheetsTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">Plan Sheets</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Upload construction plan PDFs and georeference them so lots can be drawn and viewed on
          your drawings.
        </p>
        {readOnly ? (
          <>
            <div role="status" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">
              Plan sheets are read-only while this project is archived.
            </div>
            <Button type="button" disabled>
              <Map className="h-4 w-4" />
              Manage Plan Sheets
            </Button>
          </>
        ) : (
          <Link
            to={`/projects/${encodeURIComponent(projectId)}/plan-sheets`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Map className="h-4 w-4" />
            Manage Plan Sheets
          </Link>
        )}
      </div>
    </div>
  );
}
