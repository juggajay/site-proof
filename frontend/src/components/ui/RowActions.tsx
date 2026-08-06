import { type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface RowAction {
  /** Stable React key. */
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Tooltip — also the place to explain why a disabled action is disabled. */
  title?: string;
  icon?: ReactNode;
  /** Styles the menu entry as destructive (reject/close-out actions). */
  destructive?: boolean;
}

interface RowActionsProps {
  /**
   * The row's next step, rendered as a real button. Omit for rows that have
   * none (the register still shows the overflow menu).
   */
  primary?: RowAction;
  /** Everything else, behind the overflow menu. */
  actions: RowAction[];
  /** Accessible name for the overflow trigger, e.g. `More actions for NCR-0003`. */
  menuLabel: string;
  /** `mobile` stacks a full-width primary next to a 44px overflow trigger. */
  variant?: 'table' | 'mobile';
  className?: string;
}

/**
 * One visible primary action + a "…" overflow menu, for register rows whose
 * action set is status-dependent.
 *
 * Register rows used to render every available action as its own button, which
 * made the actions column both unscannable (each row a different set) and wide
 * enough to clip or wrap. The menu content is portalled, so it escapes the
 * register's `overflow-auto` scroll container.
 */
export function RowActions({
  primary,
  actions,
  menuLabel,
  variant = 'table',
  className,
}: RowActionsProps) {
  const mobile = variant === 'mobile';

  if (!primary && actions.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2', mobile && 'w-full', className)}>
      {primary && (
        <button
          type="button"
          onClick={primary.onSelect}
          disabled={primary.disabled}
          title={primary.title}
          className={cn(
            'rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50',
            mobile
              ? 'min-h-[44px] flex-1 px-4 py-2.5 text-sm font-medium'
              : 'whitespace-nowrap px-3 py-1 text-xs',
          )}
        >
          {primary.label}
        </button>
      )}
      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={menuLabel}
              className={cn(
                'flex flex-shrink-0 items-center justify-center rounded border border-border transition-colors hover:bg-muted/50',
                mobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-1.5',
              )}
            >
              <MoreVertical className={mobile ? 'h-5 w-5' : 'h-4 w-4'} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.key}
                disabled={action.disabled}
                title={action.title}
                onSelect={action.onSelect}
                className={cn(
                  'cursor-pointer',
                  action.destructive && 'text-destructive focus:text-destructive',
                )}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
