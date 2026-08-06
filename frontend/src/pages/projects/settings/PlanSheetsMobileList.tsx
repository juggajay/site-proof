import { Crosshair, Edit2, Scissors, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MobileDataCard } from '@/components/ui/MobileDataCard';
import { coordinateSystemLabel } from '@/lib/spatial/coordinateSystems';
import type { PlanSheetListItem } from './planSheetsData';

interface PlanSheetsMobileListProps {
  sheets: PlanSheetListItem[];
  showActions: boolean;
  deletingId: string | null;
  onRegister: (sheet: PlanSheetListItem) => void;
  onPerimeter: (sheet: PlanSheetListItem) => void;
  onRename: (sheet: PlanSheetListItem) => void;
  onRequestDelete: (sheet: PlanSheetListItem) => void;
}

/** Phone rendering of the plan sheets table — its seven columns do not fit at 390px. */
export function PlanSheetsMobileList({
  sheets,
  showActions,
  deletingId,
  onRegister,
  onPerimeter,
  onRename,
  onRequestDelete,
}: PlanSheetsMobileListProps) {
  return (
    <div className="space-y-3">
      {sheets.map((sheet) => (
        <MobileDataCard
          key={sheet.id}
          title={sheet.name}
          status={{
            label: sheet.hasRegistration ? 'Registered' : 'Not registered',
            variant: sheet.hasRegistration ? 'success' : 'warning',
          }}
          fields={[
            { label: 'Page', value: sheet.pageNumber, priority: 'primary' },
            {
              label: 'Dimensions',
              value: `${sheet.imageWidth} × ${sheet.imageHeight}`,
              priority: 'primary',
            },
            {
              label: 'Coordinate system',
              value: coordinateSystemLabel(sheet.coordinateSystem),
              priority: 'secondary',
            },
            {
              label: 'Created',
              value: new Date(sheet.createdAt).toLocaleDateString(),
              priority: 'secondary',
            },
          ]}
          actions={
            showActions ? (
              <div className="flex w-full flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onRegister(sheet)}>
                  <Crosshair className="h-4 w-4" />
                  {sheet.hasRegistration ? 'Re-register' : 'Register'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onPerimeter(sheet)}>
                  <Scissors className="h-4 w-4" />
                  {sheet.perimeter ? 'Edit perimeter' : 'Perimeter'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRename(sheet)}
                  aria-label={`Rename ${sheet.name}`}
                >
                  <Edit2 className="h-4 w-4" />
                  Rename
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestDelete(sheet)}
                  disabled={deletingId === sheet.id}
                  className="text-destructive hover:bg-destructive/10"
                  aria-label={`Delete ${sheet.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
