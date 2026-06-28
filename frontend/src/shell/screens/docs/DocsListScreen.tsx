/**
 * DocsListScreen — /m/docs — the foreman's Drawings & Docs surface.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #docs. Cards show a mono
 * document number (DRG-1204 / SPEC-R44) + a plain-English title, then a pill row:
 * a green "REV X — CURRENT" pill (or a muted "REV X — SUPERSEDED" pill for older
 * revisions, sorted below the current ones) and a lot chip when the drawing is
 * lot-linked, else a "PROJECT-WIDE" pill. Tapping a card opens the file full
 * screen in the phone's native viewer (zoom/pan) via the existing signed-URL
 * idiom — see useDocFileOpen.
 *
 * Foreman-truth (research doc 13/14): pull up the current drawing/spec fast, with
 * the current revision obvious — VIEW only. There is deliberately NO upload / new
 * revision / supersede / delete / status-change affordance anywhere here; those
 * belong to the desktop Drawing Register. A search input appears once the
 * register is long enough to scroll past.
 *
 * The optional ?lotId= deep-link (the lot hub's Drawings tile) is honoured:
 * lot-linked rows narrow to that lot, while project-wide drawings stay visible
 * because the drawing register is project-scoped today.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, FileSpreadsheet, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDocsShellContext } from './docsShellContext';
import { useShellDocLotParam } from './useShellDocLotParam';
import { useDocFileOpen } from './useDocFileOpen';
import {
  currentDocCount,
  filterDocsByLot,
  revisionPillLabel,
  searchDocs,
  type DocItem,
} from './docsShellState';

/** Show the search box once the register is long enough to scroll past. */
const SEARCH_THRESHOLD = 8;

function DocCard({
  item,
  disabled,
  onPress,
}: {
  item: DocItem;
  disabled: boolean;
  onPress: () => void;
}) {
  const ariaLabel = [
    item.number,
    item.title ? `— ${item.title}` : '',
    item.revision ? `, revision ${item.revision}` : '',
    item.current ? ', current' : ', superseded',
    item.lotLabel ? `, ${item.lotLabel}` : ', project-wide',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cn('shell-card', !item.current && 'opacity-60', disabled && 'opacity-50')}
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="shell-mono text-[15px] font-semibold text-foreground">
            {item.number}
          </span>
          {item.title && (
            <span className="text-[15px] font-semibold text-muted-foreground"> — {item.title}</span>
          )}
        </span>
        <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
      </div>

      <div className="mt-[10px] flex flex-wrap items-center gap-[7px]">
        <span
          className={cn(
            'shell-pill',
            item.current ? 'shell-pill-good' : 'text-muted-foreground/70',
          )}
        >
          {revisionPillLabel(item)}
        </span>
        {item.lotLabel ? (
          <span className="shell-pill">{item.lotLabel}</span>
        ) : (
          <span className="shell-pill">PROJECT-WIDE</span>
        )}
      </div>
    </button>
  );
}

export function DocsListScreen() {
  const { items, loading, loadError, refetch } = useDocsShellContext();
  const lotId = useShellDocLotParam();
  const { opening, openDoc } = useDocFileOpen();

  const [search, setSearch] = useState('');

  const scoped = useMemo(() => filterDocsByLot(items, lotId), [items, lotId]);
  const visible = useMemo(() => searchDocs(scoped, search), [scoped, search]);
  const currentInScope = useMemo(() => currentDocCount(scoped), [scoped]);

  const handleOpen = (item: DocItem) => {
    void openDoc(item.documentId, item.fileUrl);
  };

  const sub = (
    <span className="flex items-center gap-2">
      {lotId ? (
        <span>Current revisions linked to this lot and project-wide</span>
      ) : currentInScope > 0 ? (
        <span className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-success">
          {currentInScope} current
        </span>
      ) : (
        <span>Current revisions — tap to open full screen</span>
      )}
    </span>
  );

  if (loading) {
    return (
      <ShellScreen
        variant="inner"
        title="Drawings &amp; Docs"
        parent="/m"
        sub={<span>Loading…</span>}
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="Drawings &amp; Docs" parent="/m" sub={sub}>
      {/* Search — only once the register is long enough to scroll past. */}
      {scoped.length >= SEARCH_THRESHOLD && (
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drawings…"
            aria-label="Search drawings"
            className="min-h-[48px] w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[15px] text-foreground"
          />
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
          <FileSpreadsheet size={28} className="text-muted-foreground/50" aria-hidden />
          {search.trim() ? (
            <span>No drawings match that search.</span>
          ) : lotId ? (
            <span>
              No drawings for this lot yet.
              <br />
              Drawings are managed on the register in the office.
            </span>
          ) : (
            <span>
              No drawings in the register yet.
              <br />
              They’re added on the register in the office.
            </span>
          )}
        </div>
      )}

      {visible.map((item) => (
        <DocCard key={item.id} item={item} disabled={opening} onPress={() => handleOpen(item)} />
      ))}
    </ShellScreen>
  );
}
