import { MoreHorizontal } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Lot } from '../lotsPageTypes';

interface LotRowActionsProps {
  lot: Lot;
  projectId: string;
  canCreate: boolean;
  canDelete: boolean;
  cloningLotId: string | null;
  onCloneLot: (lot: Lot) => void;
  onDeleteClick: (lot: Lot) => void;
}

// Conformed and claimed lots are read-only in the register — the same gate the
// table used before these actions moved into the overflow menu.
function isLocked(lot: Lot) {
  return lot.status === 'conformed' || lot.status === 'claimed';
}

/**
 * Row actions for the lot register: View stays visible, everything else lives in
 * an overflow menu so the actions column has a fixed width and can never clip.
 */
export function LotRowActions({
  lot,
  projectId,
  canCreate,
  canDelete,
  cloningLotId,
  onCloneLot,
  onDeleteClick,
}: LotRowActionsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const lotPath = `/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(lot.id)}`;
  const canEditThisLot = canCreate && !isLocked(lot);
  const canDeleteThisLot = canDelete && !isLocked(lot);
  const isCloning = cloningLotId === lot.id;
  const hasOverflow = canEditThisLot || canCreate || canDeleteThisLot;

  return (
    <div className="flex items-center gap-1">
      <button
        className="text-sm text-primary hover:underline px-2 py-3 min-h-[44px] touch-manipulation"
        onClick={() => navigate(lotPath, { state: { returnFilters: searchParams.toString() } })}
      >
        View
      </button>
      {hasOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-11 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"
              aria-label={`More actions for lot ${lot.lotNumber}`}
              data-testid={`lot-actions-${lot.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEditThisLot && (
              <DropdownMenuItem onSelect={() => navigate(`${lotPath}/edit`)}>Edit</DropdownMenuItem>
            )}
            {canCreate && (
              <DropdownMenuItem disabled={isCloning} onSelect={() => onCloneLot(lot)}>
                {isCloning ? 'Cloning...' : 'Clone'}
              </DropdownMenuItem>
            )}
            {canDeleteThisLot && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDeleteClick(lot)}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
