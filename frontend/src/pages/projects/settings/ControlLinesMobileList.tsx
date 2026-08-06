import { Edit2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MobileDataCard } from '@/components/ui/MobileDataCard';
import { coordinateSystemLabel } from '@/lib/spatial/coordinateSystems';
import type { ControlLine } from './controlLinesData';
import { chainageRange } from './controlLinesData';

interface ControlLinesMobileListProps {
  controlLines: ControlLine[];
  showActions: boolean;
  deletingId: string | null;
  onEdit: (line: ControlLine) => void;
  onRequestDelete: (line: ControlLine) => void;
}

/** Phone rendering of the control lines table — its columns do not fit at 390px. */
export function ControlLinesMobileList({
  controlLines,
  showActions,
  deletingId,
  onEdit,
  onRequestDelete,
}: ControlLinesMobileListProps) {
  return (
    <div className="space-y-3">
      {controlLines.map((line) => (
        <MobileDataCard
          key={line.id}
          title={line.name}
          fields={[
            { label: 'Points', value: line.points.length, priority: 'primary' },
            { label: 'Chainage', value: chainageRange(line.points), priority: 'primary' },
            {
              label: 'Coordinate system',
              value: coordinateSystemLabel(line.coordinateSystem),
              priority: 'secondary',
            },
          ]}
          actions={
            showActions ? (
              <div className="flex w-full flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(line)}
                  aria-label={`Edit ${line.name}`}
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestDelete(line)}
                  disabled={deletingId === line.id}
                  className="text-destructive hover:bg-destructive/10"
                  aria-label={`Delete ${line.name}`}
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
