/**
 * PhotoDetailScreen — /m/photos/:documentId — one photo, full width.
 *
 * Shows the photo, its caption, the captured date (mono), a GPS chip when
 * present, and the lot chip. The primary action depends on filing state:
 *
 *   UNFILED (server photo, no lot) → "File to a lot" opens a full-screen lot
 *   picker (≥48px rows, searchable when long); choosing a lot PATCHes
 *   { lotId } via the existing documents endpoint and returns to a filed state
 *   with the documents + lots caches invalidated.
 *
 *   ALREADY FILED → show the lot; NO re-file action in this PR (scope kept
 *   tight; re-filing a filed photo to a different lot is a follow-up).
 *
 *   PENDING (offline, not yet uploaded) → no re-file (no server id yet); show
 *   the honest "Uploading…" state so the foreman knows it's in flight.
 *
 * No delete affordance anywhere (research doc 14: kept OUT of this PR).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Loader2, FolderInput, Check } from 'lucide-react';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { cn } from '@/lib/utils';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { useLotsShellData } from '../lots/useLotsShellData';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { usePhotosShellContext } from './photosShellContext';
import { useShellPhotoParam } from './useShellPhotoParam';
import { usePhotoRefile } from './usePhotoRefile';
import { formatGps, formatPhotoDateLong } from './photosShellState';

/** Show a search box once the lot list is long enough to scroll past. */
const LOT_SEARCH_THRESHOLD = 8;

export function PhotoDetailScreen() {
  const navigate = useNavigate();
  const { isOnline } = useOfflineStatus();
  const documentId = useShellPhotoParam();
  const { projectId, items, loading, refetch } = usePhotosShellContext();

  const item = useMemo(() => items.find((p) => p.id === documentId) ?? null, [items, documentId]);

  const { lots, loading: lotsLoading } = useLotsShellData(projectId);
  const { filing, fileToLot } = usePhotoRefile(projectId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [lotSearch, setLotSearch] = useState('');

  const backPath = withProjectQuery('/m/photos', projectId);

  const filteredLots = useMemo(() => {
    const q = lotSearch.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter(
      (l) =>
        l.lotNumber.toLowerCase().includes(q) || (l.description ?? '').toLowerCase().includes(q),
    );
  }, [lots, lotSearch]);

  // ── Loading / not-found guards ─────────────────────────────────────────────
  if (loading && !item) {
    return (
      <ShellScreen variant="inner" title="Photo" parent={backPath} sub={<span>Loading…</span>}>
        <div className="aspect-square w-full animate-pulse rounded-2xl bg-muted" />
        <div className="h-[88px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  if (!item) {
    return (
      <ShellScreen variant="inner" title="Photo" parent={backPath} sub={<span>Not found</span>}>
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          This photo isn’t here anymore.
          <br />
          It may have moved off your project.
        </div>
      </ShellScreen>
    );
  }

  const isPending = item.source === 'pending';
  const canRefile = item.unfiled && !isPending && Boolean(item.documentId);

  const handlePickLot = async (lotId: string) => {
    if (!item.documentId) return;
    const ok = await fileToLot(item.documentId, lotId);
    if (ok) {
      setPickerOpen(false);
      setLotSearch('');
      void refetch();
      navigate(backPath);
    }
  };

  // ── Full-screen lot picker ──────────────────────────────────────────────────
  if (pickerOpen && canRefile) {
    return (
      <ShellScreen
        variant="inner"
        title="File to a lot"
        parent={backPath}
        sub={<span>Pick the lot this photo belongs to</span>}
      >
        {!isOnline && (
          <p
            className="rounded-xl bg-warning/10 px-3 py-2 text-center text-[12.5px] font-semibold text-warning"
            role="status"
          >
            Filing needs signal — reconnect to file this photo.
          </p>
        )}

        {lots.length >= LOT_SEARCH_THRESHOLD && (
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={lotSearch}
              onChange={(e) => setLotSearch(e.target.value)}
              placeholder="Search lots…"
              aria-label="Search lots"
              className="min-h-[48px] w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[15px] text-foreground"
            />
          </div>
        )}

        {lotsLoading && lots.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[56px] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filteredLots.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-muted-foreground">
            {lots.length === 0 ? 'No lots on this project yet.' : 'No lots match that search.'}
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Lots">
            {filteredLots.map((lot) => (
              <li key={lot.id}>
                <button
                  type="button"
                  disabled={filing || !isOnline}
                  onClick={() => void handlePickLot(lot.id)}
                  className={cn(
                    'flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left touch-manipulation',
                    'active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    (filing || !isOnline) && 'opacity-50',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="shell-mono block text-[15px] font-semibold text-foreground">
                      {lot.lotNumber}
                    </span>
                    {lot.description && (
                      <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                        {lot.description}
                      </span>
                    )}
                  </span>
                  {filing ? (
                    <Loader2 size={18} className="animate-spin text-muted-foreground" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ShellScreen>
    );
  }

  // ── Read-focused detail ─────────────────────────────────────────────────────
  const sub = (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span className="shell-mono">{formatPhotoDateLong(item.takenAt)}</span>
    </span>
  );

  return (
    <ShellScreen
      variant="inner"
      title="Photo"
      parent={backPath}
      sub={sub}
      bottom={
        canRefile ? (
          <div className="shell-cambar flex flex-col gap-2">
            {!isOnline && (
              <p
                className="px-1 text-center text-[12.5px] font-semibold text-warning"
                role="status"
              >
                Filing needs signal — reconnect to file this photo.
              </p>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={!isOnline}
              className={cn('shell-cambar-btn', !isOnline && 'opacity-50')}
              aria-label="File to a lot"
            >
              <FolderInput size={20} aria-hidden /> File to a lot
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Full-width photo */}
      <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
        {isPending || !item.documentId ? (
          <img
            src={item.src}
            alt={item.caption || 'Site photo'}
            loading="lazy"
            decoding="async"
            className="block w-full object-contain"
          />
        ) : (
          <SecureDocumentImage
            documentId={item.documentId}
            fileUrl={item.src}
            alt={item.caption || 'Site photo'}
            loading="lazy"
            decoding="async"
            className="block w-full object-contain"
          />
        )}
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-[7px]">
        {item.unfiled ? (
          <span className="shell-pill shell-pill-attention">UNFILED</span>
        ) : item.lotLabel ? (
          <span className="shell-pill shell-pill-good">{item.lotLabel}</span>
        ) : null}
        {isPending && (
          <span className="shell-pill shell-pill-attention inline-flex items-center gap-1">
            {item.syncState === 'error' ? (
              'UPLOAD FAILED'
            ) : (
              <>
                <Loader2 size={11} className="animate-spin" aria-hidden /> UPLOADING
              </>
            )}
          </span>
        )}
        {item.hasGps && item.gps && (
          <span className="shell-pill inline-flex items-center gap-1">
            <MapPin size={11} aria-hidden /> {formatGps(item.gps)}
          </span>
        )}
      </div>

      {/* Caption card */}
      {item.caption && (
        <div className="shell-card">
          <div className="text-[15px] font-semibold text-foreground">Caption</div>
          <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
            {item.caption}
          </p>
        </div>
      )}

      {/* State note for the foreman */}
      {isPending ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          This photo is still uploading from your phone. It’ll be filable once it lands — leave the
          app open with signal and it’ll sync on its own.
        </p>
      ) : item.unfiled ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Not on a lot yet. File it so it shows up with the lot’s records.
        </p>
      ) : (
        <div className="shell-card flex items-center gap-2">
          <Check size={16} className="text-success" aria-hidden />
          <span className="text-[14px] text-muted-foreground">
            Filed to{' '}
            <span className="shell-mono font-semibold text-foreground">{item.lotLabel}</span>
          </span>
        </div>
      )}
    </ShellScreen>
  );
}
