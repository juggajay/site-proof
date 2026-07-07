/**
 * PhotosListScreen — /m/photos — the foreman's photo surface.
 *
 * The one genuinely new shell capability: a recent-first photo grid that surfaces
 * UNFILED photos (captured without a lot link, otherwise buried on the desktop
 * Documents page) plus offline-pending captures that haven't uploaded yet — so a
 * just-taken photo is never invisible. Filter chips: All / Unfiled (lot-scoped
 * photos already live on the lot hub, so there's deliberately no per-lot filter).
 *
 * Each tile is an aspect-ratio box (no layout shift) with a lazy-loaded
 * thumbnail, a mono date, and a lot chip when filed or an amber UNFILED chip when
 * not. Pending captures float to the top with a "Uploading…" / "Waiting" badge.
 *
 * No delete affordance anywhere (research doc 14: foreman delete is broad — kept
 * OUT of this PR to stay safe). Re-file lives on the detail screen.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageOff, Loader2, AlertTriangle } from 'lucide-react';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { cn } from '@/lib/utils';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { usePhotosShellContext } from './photosShellContext';
import { useShellPhotoLotParam } from './useShellPhotoLotParam';
import {
  PHOTO_FILTERS,
  filterPhotos,
  unfiledPhotoCount,
  formatPhotoDate,
  type PhotoFilterKey,
  type PhotoItem,
} from './photosShellState';

function PhotoTile({
  item,
  onPress,
  onRetry,
  retrying,
}: {
  item: PhotoItem;
  onPress: () => void;
  // Provided only for failed uploads — turns the "Retry" badge into a real button.
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const isPending = item.source === 'pending';
  const pendingError = item.syncState === 'error';

  const ariaLabel = [
    'Photo',
    item.caption ? `— ${item.caption}` : '',
    item.unfiled ? ', unfiled' : item.lotLabel ? `, filed to ${item.lotLabel}` : '',
    isPending ? (pendingError ? ', upload failed' : ', uploading') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // Relative wrapper so the Retry affordance is a real sibling button rather
    // than a (non-interactive) child of the tile button — no nested buttons.
    <div className="relative">
      <button
        type="button"
        onClick={onPress}
        aria-label={ariaLabel}
        className="group block w-full overflow-hidden rounded-2xl border border-border bg-secondary text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Aspect-ratio box — fixes layout before the image loads (no shift). */}
        <span className="block aspect-square w-full">
          {isPending || !item.documentId ? (
            <img
              src={item.src}
              alt={item.caption || 'Site photo'}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <SecureDocumentImage
              documentId={item.documentId}
              fileUrl={item.src}
              alt={item.caption || 'Site photo'}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
        </span>

        {/* Top-left: status chip — UNFILED (amber) or filed lot chip. */}
        <span className="pointer-events-none absolute left-1.5 top-1.5 flex flex-wrap gap-1">
          {item.unfiled ? (
            <span className="shell-pill shell-pill-attention text-[10px] shadow-sm">UNFILED</span>
          ) : item.lotLabel ? (
            <span className="shell-pill bg-card/90 text-[10px] shadow-sm">{item.lotLabel}</span>
          ) : null}
        </span>

        {/* Bottom gradient + mono date. */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-6">
          <span className="shell-mono text-[11px] font-semibold text-white/90">
            {formatPhotoDate(item.takenAt)}
          </span>
        </span>
      </button>

      {/* Pending sync badge — top-right. A failed upload is a real Retry button;
          an in-flight upload stays a non-interactive status pill. */}
      {isPending &&
        (pendingError && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            aria-label="Retry upload"
            className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-1 text-[10px] font-semibold text-white shadow-sm touch-manipulation disabled:opacity-70"
          >
            {retrying ? (
              <>
                <Loader2 size={11} className="animate-spin" aria-hidden /> Retrying
              </>
            ) : (
              <>
                <AlertTriangle size={11} aria-hidden /> Retry
              </>
            )}
          </button>
        ) : (
          <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-warning px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
            <Loader2 size={11} className="animate-spin" aria-hidden /> Uploading
          </span>
        ))}
    </div>
  );
}

export function PhotosListScreen() {
  const navigate = useNavigate();
  const { projectId, items, loading, loadError, unfiledCount, refetch } = usePhotosShellContext();
  const { retryFailedSyncs, isSyncing } = useOfflineStatus();
  const lotId = useShellPhotoLotParam();

  // Reviving failed items resets their attempt count; the app-root offline worker
  // then flushes them, and the pending grid poll reflects the change. Also refetch
  // so the tile updates promptly.
  const handleRetryUpload = async () => {
    await retryFailedSyncs();
    await refetch();
  };

  const [filter, setFilter] = useState<PhotoFilterKey>('all');

  const scopedItems = useMemo(
    () => (lotId ? items.filter((item) => item.lotId === lotId) : items),
    [items, lotId],
  );
  const visible = useMemo(() => filterPhotos(scopedItems, filter), [scopedItems, filter]);
  const scopedUnfiledCount = lotId ? unfiledPhotoCount(scopedItems) : unfiledCount;

  const photoHref = (item: PhotoItem) =>
    withProjectQuery(`/m/photos/${item.id}`, projectId, { lotId });

  const sub = (
    <span className="flex items-center gap-2">
      {lotId ? (
        <span>Photos filed to this lot</span>
      ) : scopedUnfiledCount > 0 ? (
        <span className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-warning">
          {scopedUnfiledCount} unfiled
        </span>
      ) : (
        <span>Recent &amp; unfiled photos</span>
      )}
    </span>
  );

  if (loading) {
    return (
      <ShellScreen variant="inner" title="Photos" parent="/m" sub={<span>Loading…</span>}>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="Photos" parent="/m" sub={sub}>
      {!lotId && (
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filter photos"
        >
          {PHOTO_FILTERS.map((f) => {
            const active = filter === f.key;
            const showCount = f.key === 'unfiled' && scopedUnfiledCount > 0;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={cn(
                  'min-h-[40px] whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold touch-manipulation',
                  active
                    ? 'bg-foreground text-[hsl(40_33%_98%)]'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {f.label}
                {showCount ? ` (${scopedUnfiledCount})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="shrink-0 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {!loadError && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          <ImageOff size={28} className="text-muted-foreground/50" aria-hidden />
          {lotId ? (
            <span>
              No photos filed to this lot yet.
              <br />
              Lot photos appear here once captured or filed.
            </span>
          ) : filter === 'unfiled' ? (
            <span>
              Nothing unfiled. Nice and tidy.
              <br />
              Every photo’s on a lot.
            </span>
          ) : (
            <span>
              No photos yet.
              <br />
              Snap one from the camera on home — it’ll land here.
            </span>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {visible.map((item) => (
            <PhotoTile
              key={item.id}
              item={item}
              onPress={() => navigate(photoHref(item))}
              onRetry={item.syncState === 'error' ? () => void handleRetryUpload() : undefined}
              retrying={isSyncing}
            />
          ))}
        </div>
      )}
    </ShellScreen>
  );
}
