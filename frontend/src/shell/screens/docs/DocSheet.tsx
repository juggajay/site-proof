/**
 * DocSheet — what a /m/docs card opens (Wave G G1).
 *
 * The card obeys the hub card rules — icon + one label + ONE chip + chevron, one
 * tap target — so the drawing's file and its revision history cannot both hang
 * off the card itself. They live here instead: current revision, who issued it,
 * a prominent "Open drawing", then the history.
 *
 * The cost, stated plainly: opening a drawing is two taps rather than one. It is
 * paid back — minting the signed URL used to disable EVERY card on the list
 * while it ran, and here it is one spinner on one button.
 *
 * The history is the shipped desktop RevisionTimelineBody rendered inline in the
 * sheet, not a second implementation and not a modal on a modal. VIEW +
 * acknowledge only: no upload, new revision, supersede, delete or status change.
 */
import { ExternalLink } from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { RevisionTimelineBody } from '@/components/revisions/RevisionTimelineBody';
import {
  currentRevisionIssue,
  revisionIssuedLine,
  useRevisionIssues,
} from '@/components/revisions/revisionTimelineState';
import { useDocFileOpen } from './useDocFileOpen';
import { revisionPillLabel, type DocItem } from './docsShellState';

/**
 * A drawing register row IS the governed `drawing` record — `DocItem.id` is the
 * `Drawing.id` the revision issues are recorded against.
 */
const ENTITY_TYPE = 'drawing';

export function DocSheet({
  item,
  projectId,
  onClose,
}: {
  item: DocItem;
  projectId: string | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { opening, openDoc } = useDocFileOpen();

  // Same cache entry the timeline below reads — one fetch, and the header can
  // attribute the current revision without a second endpoint.
  const { issues, governanceDisabled } = useRevisionIssues(projectId ?? '', ENTITY_TYPE, item.id);
  const issuedLine = revisionIssuedLine(currentRevisionIssue(issues));

  // Flag off ⇒ the whole section goes, heading and all. `hideWhenDisabled` is
  // the body's half of that promise; the heading is the sheet's, and both read
  // the one hook result rather than deciding separately.
  const showHistory = Boolean(projectId) && !governanceDisabled;

  return (
    <ResponsiveSheet open onClose={onClose} title={item.number}>
      <div className="flex flex-col gap-4">
        <div>
          <span className={cn('shell-pill', item.current && 'shell-pill-good')}>
            {revisionPillLabel(item)}
          </span>
          {item.title && (
            <p className="mt-[9px] text-[15px] font-semibold text-foreground">{item.title}</p>
          )}
          {issuedLine && <p className="mt-[3px] text-[13px] text-muted-foreground">{issuedLine}</p>}
        </div>

        <button
          type="button"
          className="shell-cambar-btn"
          onClick={() => void openDoc(item.documentId, item.fileUrl)}
          disabled={opening}
          aria-label={`Open drawing ${item.number}`}
        >
          <ExternalLink size={20} strokeWidth={1.9} aria-hidden />
          {opening ? 'Opening…' : 'Open drawing'}
        </button>

        {showHistory && projectId && (
          <div className="border-t border-border pt-[14px]">
            <div className="mb-[11px] shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Revision history
            </div>
            <RevisionTimelineBody
              projectId={projectId}
              entityType={ENTITY_TYPE}
              entityId={item.id}
              currentUserId={user?.id ?? null}
              hideWhenDisabled
            />
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
