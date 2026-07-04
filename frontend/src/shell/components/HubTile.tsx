/**
 * HubTile — the standard full-width hub card, shared by the foreman (/m) and
 * subbie (/p) shells.
 *
 * ONE uniform card anatomy for every destination (owner-rejected mixed
 * link/card hierarchies and description lines): icon + title + optional
 * status chip + chevron. Nothing else — uneven description lengths made card
 * heights uneven. Information that used to live in a description line moves
 * into the chip (a count) or into the destination screen (prose).
 *
 * Consumers: foreman HomeScreen + LotHubScreen, subbie HomeScreen +
 * WorkScreen + SubbieLotHubScreen.
 */
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HubTile({
  icon: Icon,
  title,
  chip,
  chipOk,
  onPress,
  ariaLabel,
}: {
  icon: React.ElementType;
  title: string;
  chip?: string;
  chipOk?: boolean;
  onPress: () => void;
  ariaLabel: string;
}) {
  return (
    <button type="button" className="shell-hub" onClick={onPress} aria-label={ariaLabel}>
      <span className="shell-hub-ico" aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="shell-tile-title block">{title}</span>
      </span>
      {chip !== undefined && (
        <span
          className={cn('shell-count-chip', chipOk && 'shell-count-chip-ok')}
          aria-hidden="true"
        >
          {chip}
        </span>
      )}
      <ChevronRight
        size={18}
        className="flex-shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
    </button>
  );
}
