/**
 * DocsListScreen — /m/docs — the foreman's Drawings & Docs surface.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #docs, revised by the G1
 * mobile revision-history mock (Jay-approved 2026-07-31). Cards follow the hub
 * card rules — leading icon + one label (mono document number + plain-English
 * title) + ONE chip (a green "REV X — CURRENT", or a muted "REV X — SUPERSEDED"
 * for older revisions, sorted below the current ones) + chevron.
 *
 * Tapping a card opens the DocSheet, which holds the prominent "Open drawing"
 * button and the revision history. The file itself still opens full screen in
 * the phone's native viewer via the existing signed-URL idiom (useDocFileOpen);
 * it is now invoked from the sheet, so minting a signed URL spins ONE button
 * instead of disabling every card on the list.
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
import { ChevronRight, FileSpreadsheet, Ruler, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDocsShellContext } from './docsShellContext';
import { useShellDocLotParam } from './useShellDocLotParam';
import { DocSheet } from './DocSheet';
import {
  currentDocCount,
  filterDocsByLot,
  revisionPillLabel,
  searchDocs,
  type DocItem,
} from './docsShellState';

/** Show the search box once the register is long enough to scroll past. */
const SEARCH_THRESHOLD = 8;

/**
 * One card anatomy, the same as every hub tile: leading icon + one label + ONE
 * chip + chevron, and the WHOLE card is the tap target. No nested action.
 *
 * The lot / PROJECT-WIDE pill that used to sit beside the revision pill is gone.
 * `DocItem.lotLabel` is derived from a lot relation the Drawing model does not
 * have (see this module's header), so that pill read PROJECT-WIDE on every card
 * in production — deleting it removed a constant, not information.
 *
 * ONE icon for every row, deliberately: the register holds drawings AND specs
 * with no type column to split on, so a drawing-vs-spec icon would be inventing
 * data. It is the same `Ruler` the lot hub's Drawings tile uses.
 */
function DocCard({ item, onPress }: { item: DocItem; onPress: () => void }) {
  const ariaLabel = [
    item.number,
    item.title ? `— ${item.title}` : '',
    item.revision ? `, revision ${item.revision}` : '',
    item.current ? ', current' : ', superseded',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cn(
        'shell-card flex min-h-[76px] items-center gap-[14px]',
        !item.current && 'opacity-60',
      )}
      onClick={onPress}
      aria-label={ariaLabel}
    >
      <span className="shell-hub-ico" aria-hidden="true">
        <Ruler size={22} strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-[1.35]">
          <span className="shell-mono text-[15px] font-semibold text-foreground">
            {item.number}
          </span>
          {item.title && (
            <span className="text-[15px] font-semibold text-muted-foreground"> — {item.title}</span>
          )}
        </span>
        <span className="mt-2 block">
          <span className={cn('shell-pill', item.current && 'shell-pill-good')}>
            {revisionPillLabel(item)}
          </span>
        </span>
      </span>

      <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
    </button>
  );
}

export function DocsListScreen() {
  const { projectId, items, loading, loadError, refetch } = useDocsShellContext();
  const lotId = useShellDocLotParam();

  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<DocItem | null>(null);

  const scoped = useMemo(() => filterDocsByLot(items, lotId), [items, lotId]);
  const visible = useMemo(() => searchDocs(scoped, search), [scoped, search]);
  const currentInScope = useMemo(() => currentDocCount(scoped), [scoped]);

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
            className="shell-tap48 shrink-0 underline underline-offset-2"
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
        <DocCard key={item.id} item={item} onPress={() => setOpenItem(item)} />
      ))}

      {openItem && (
        <DocSheet item={openItem} projectId={projectId} onClose={() => setOpenItem(null)} />
      )}
    </ShellScreen>
  );
}
