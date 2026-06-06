import { Camera, ChevronDown, ChevronRight, Image, MessageSquare } from 'lucide-react';
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
    <div className="mx-4 mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
      <p className="text-sm text-amber-800 dark:text-amber-200">
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
  onToggle: () => void;
}

export function MobileITPCategoryHeader({
  category,
  isExpanded,
  isComplete,
  completedCount,
  totalCount,
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
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            isComplete
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-muted text-muted-foreground'
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
  onTap,
  onQuickComplete,
}: MobileITPItemProps) {
  const statusColors = {
    pending: 'bg-muted border-muted-foreground/30 text-muted-foreground',
    completed: 'bg-green-500 border-green-500 text-white',
    na: 'bg-gray-400 dark:bg-gray-600 border-gray-400 dark:border-gray-600 text-white',
    failed: 'bg-red-500 border-red-500 text-white',
    disabled:
      'bg-gray-300 dark:bg-gray-700 border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400',
  };

  const statusIcons = {
    pending: '',
    completed: '✓',
    na: '—',
    failed: '✗',
  };

  const pointTypeBadge = {
    standard: {
      label: 'S',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    witness: {
      label: 'W',
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    },
    hold_point: { label: 'H', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  };

  const badge = pointTypeBadge[item.pointType];

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
          if (canComplete && (status === 'pending' || status === 'completed')) {
            onQuickComplete();
          }
        }}
        disabled={isUpdating || status === 'na' || status === 'failed' || !canComplete}
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
          {item.evidenceRequired === 'photo' && !hasPhotos && (
            <span className="flex items-center gap-1 text-amber-600">
              <Camera className="w-3 h-3" />
              <span>Photo req</span>
            </span>
          )}
          {hasPhotos && (
            <span className="flex items-center gap-1 text-primary">
              <Image className="w-3 h-3" />
              <span>{photoCount}</span>
            </span>
          )}
          {hasNotes && (
            <span className="flex items-center gap-1 text-amber-600">
              <MessageSquare className="w-3 h-3" />
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
