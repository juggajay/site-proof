import { Camera, ChevronDown, ChevronRight, Image, MessageSquare } from 'lucide-react';
import { isReleaseGatedChecklistItem } from '@/lib/itpReleaseGating';
import type { ITPChecklistItem } from './MobileITPChecklist';
import type { ItpItemStatus } from './mobileItpChecklistHelpers';

interface MobileITPProgressHeaderProps {
  lotNumber: string;
  templateName: string;
  progress: number;
  completedCount: number;
  totalCount: number;
}

export function MobileITPProgressHeader({
  lotNumber,
  templateName,
  progress,
  completedCount,
  totalCount,
}: MobileITPProgressHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold">{lotNumber}</h1>
          <p className="text-sm text-muted-foreground">{templateName}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{progress}%</p>
          <p className="text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </p>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function MobileITPReadOnlyNotice() {
  return (
    <div className="mx-4 mt-4 bg-warning/10 border border-warning/20 rounded-md p-3">
      <p className="text-sm text-warning-foreground">
        You can view this ITP but do not have permission to complete items. Contact the head
        contractor to request completion access.
      </p>
    </div>
  );
}

interface MobileITPCategoryHeaderProps {
  category: string;
  isExpanded: boolean;
  isComplete: boolean;
  completedCount: number;
  totalCount: number;
  /** Items in this category still missing required photos; badged while collapsed. */
  photoRequiredCount?: number;
  onToggle: () => void;
}

export function MobileITPCategoryHeader({
  category,
  isExpanded,
  isComplete,
  completedCount,
  totalCount,
  photoRequiredCount = 0,
  onToggle,
}: MobileITPCategoryHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
    >
      <div className="flex items-center gap-3">
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        )}
        <span className="font-semibold text-sm">{category}</span>
      </div>
      <div className="flex items-center gap-2">
        {!isExpanded && photoRequiredCount > 0 && (
          <span
            className="flex items-center gap-1 text-xs font-medium text-warning"
            aria-label={`${photoRequiredCount} ${photoRequiredCount === 1 ? 'item needs' : 'items need'} photos`}
          >
            <Camera className="w-3.5 h-3.5" />
            {photoRequiredCount}
          </span>
        )}
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            isComplete ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {completedCount}/{totalCount}
        </span>
      </div>
    </button>
  );
}

interface MobileITPItemProps {
  item: ITPChecklistItem;
  status: ItpItemStatus;
  hasNotes: boolean;
  hasPhotos: boolean;
  photoCount: number;
  isUpdating: boolean;
  canComplete: boolean;
  releaseRequired?: boolean;
  verificationReason?: string | null;
  onTap: () => void;
  onQuickComplete: () => void;
}

export function MobileITPItem({
  item,
  status,
  hasNotes,
  hasPhotos,
  photoCount,
  isUpdating,
  canComplete,
  releaseRequired = false,
  verificationReason = null,
  onTap,
  onQuickComplete,
}: MobileITPItemProps) {
  const statusColors = {
    pending: 'bg-muted border-muted-foreground/30 text-muted-foreground',
    completed: 'bg-primary border-primary text-primary-foreground',
    na: 'bg-muted-foreground border-muted-foreground text-background',
    failed: 'bg-destructive border-destructive text-destructive-foreground',
    review: 'bg-warning/10 border-warning text-warning',
    rejected: 'bg-destructive/10 border-destructive text-destructive',
    disabled: 'bg-muted border-border text-muted-foreground',
  };

  const statusIcons = {
    pending: '',
    completed: '✓',
    na: '—',
    failed: '✗',
    review: '',
    rejected: '!',
  };

  const quickCompleteAllowed =
    status === 'pending' || status === 'completed' || status === 'rejected';
  const statusLabel =
    status === 'review' ? 'Awaiting verification' : status === 'rejected' ? 'Rejected' : null;

  const pointTypeBadge = {
    standard: {
      label: 'S',
      color: 'bg-muted text-muted-foreground',
    },
    verification: {
      label: 'V',
      color: 'bg-primary/10 text-primary',
    },
    witness: {
      label: 'W',
      color: 'bg-warning/10 text-warning',
    },
    hold_point: { label: 'H', color: 'bg-destructive/10 text-destructive' },
    unknown: { label: '?', color: 'bg-muted text-muted-foreground' },
  };

  const badge = isReleaseGatedChecklistItem(item)
    ? pointTypeBadge.hold_point
    : (pointTypeBadge[item.pointType] ?? pointTypeBadge.unknown);

  return (
    <div
      className={`flex items-center gap-3 p-4 border-b active:bg-muted/50 transition-colors touch-manipulation ${
        isUpdating ? 'opacity-50' : ''
      }`}
      onClick={onTap}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canComplete && quickCompleteAllowed) {
            onQuickComplete();
          }
        }}
        disabled={
          isUpdating ||
          status === 'na' ||
          status === 'failed' ||
          status === 'review' ||
          !canComplete
        }
        title={
          releaseRequired
            ? 'Release this hold point before passing it'
            : status === 'review'
              ? 'Awaiting head-contractor verification'
              : undefined
        }
        className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-bold transition-all touch-manipulation ${
          !canComplete ? statusColors.disabled : statusColors[status]
        } ${isUpdating ? 'animate-pulse' : ''} ${!canComplete ? 'cursor-not-allowed' : ''}`}
      >
        {statusIcons[status]}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <span
            className={`flex-shrink-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded ${badge.color}`}
          >
            {badge.label}
          </span>
          <span
            className={`text-sm leading-tight ${status === 'completed' || status === 'na' ? 'line-through text-muted-foreground' : ''}`}
          >
            <span className="font-medium">{item.order}.</span> {item.description}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-7">
          {releaseRequired && (
            <span className="flex items-center gap-1 text-destructive">Release req</span>
          )}
          {item.evidenceRequired === 'photo' && !hasPhotos && (
            <span className="flex items-center gap-1 text-warning">
              <Camera className="w-3 h-3" />
              <span>Photo req</span>
            </span>
          )}
          {hasPhotos && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Image className="w-3 h-3" />
              <span>{photoCount}</span>
            </span>
          )}
          {hasNotes && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageSquare className="w-3 h-3" />
            </span>
          )}
          {statusLabel && (
            <span className={status === 'rejected' ? 'text-destructive' : 'text-warning'}>
              {statusLabel}
            </span>
          )}
          {status === 'rejected' && verificationReason && (
            <span className="truncate text-destructive" title={verificationReason}>
              {verificationReason}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-muted-foreground">
        <ChevronRight className="w-5 h-5" />
      </div>
    </div>
  );
}
