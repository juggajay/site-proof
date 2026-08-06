import { LayoutGrid, Map as MapIcon, MapPin, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';

type ViewMode = 'list' | 'card' | 'linear' | 'map';

/**
 * Phone view switcher — cards / linear map / satellite map. It rides the title
 * row rather than a row of its own: the register header already spends most of
 * a phone screen before the first lot card. Without it the map views are
 * unreachable on mobile ('list' renders as cards, so list and card share one
 * button). 44px touch targets.
 */
function LotMobileViewToggle({
  viewMode,
  onToggleViewMode,
}: {
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
}) {
  const modes = [
    {
      mode: 'card' as const,
      icon: LayoutGrid,
      label: 'Card view',
      testId: 'view-toggle-card',
      active: viewMode === 'list' || viewMode === 'card',
    },
    {
      mode: 'linear' as const,
      icon: MapPin,
      label: 'Linear map view',
      testId: 'view-toggle-linear',
      active: viewMode === 'linear',
    },
    {
      mode: 'map' as const,
      icon: MapIcon,
      label: 'Satellite map view',
      testId: 'view-toggle-map',
      active: viewMode === 'map',
    },
  ];

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
      {modes.map(({ mode, icon: Icon, label, testId, active }) => (
        <button
          key={mode}
          onClick={() => onToggleViewMode(mode)}
          className={`flex h-11 w-11 items-center justify-center rounded transition-colors ${
            active ? 'bg-background shadow-sm' : 'hover:bg-muted'
          }`}
          title={label}
          aria-label={label}
          data-testid={testId}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

interface LotsPageHeaderProps {
  isMobile: boolean;
  isSubcontractor: boolean;
  canCreate: boolean;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenBulkWizard: () => void;
  onOpenCreate: () => void;
}

/**
 * Lot register page header. The register-level tools (export, import, bulk
 * create) live behind an overflow menu so "Create Lot" reads as the single
 * primary action instead of one of five equal-weight buttons. Bulk verbs live in
 * LotSelectionBar, above the rows they act on.
 *
 * No print action: screen-print is retired product-wide — every paper need is
 * served by a generated PDF, not by printing the web page.
 */
export function LotsPageHeader({
  isMobile,
  isSubcontractor,
  canCreate,
  viewMode,
  onToggleViewMode,
  onOpenExport,
  onOpenImport,
  onOpenBulkWizard,
  onOpenCreate,
}: LotsPageHeaderProps) {
  const showRegisterTools = !isMobile;
  const showImportTools = !isMobile && !isSubcontractor && canCreate;

  return (
    // On phones the actions stack under the title instead of competing with it
    // for the same row.
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* text-lg on phones so the title, its help affordance, and the view
              switcher share one line. At text-xl "Lot Register" wraps and gives
              back the row the switcher just saved. */}
          <h1 className="text-lg font-bold sm:text-2xl">Lot Register</h1>
          <ContextHelp title={HELP_CONTENT.lots.title} content={HELP_CONTENT.lots.content} />
        </div>
        {isMobile && (
          <LotMobileViewToggle viewMode={viewMode} onToggleViewMode={onToggleViewMode} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {showRegisterTools && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More register actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onOpenExport}>Export CSV</DropdownMenuItem>
              {showImportTools && (
                <>
                  <DropdownMenuItem onSelect={onOpenImport}>Import Register</DropdownMenuItem>
                  <DropdownMenuItem onSelect={onOpenBulkWizard}>Bulk Create Lots</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isSubcontractor && canCreate && <Button onClick={onOpenCreate}>Create Lot</Button>}
      </div>
    </div>
  );
}
