/**
 * IssueDetailScreen — /m/issues/:ncrId — review one NCR / defect.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #issues (detail follows the
 * dockets/lots detail idiom). Read-focused: the description, severity / status /
 * category, an evidence photo strip (existing evidence data), the responsible
 * party, and the key dates. Two field affordances:
 *   - "Add photo" — reuses the existing evidence pipeline (upload → link). The
 *     foreman adds evidence (research doc 14).
 *   - "Respond" — CONDITIONAL: shown ONLY when the foreman is this NCR's
 *     responsibleUserId (canForemanRespond). Opens a full-screen response form
 *     that reuses the desktop respond mutation (POST /api/ncrs/:id/respond).
 *
 * The foreman NEVER closes and never runs QM actions — there is deliberately no
 * Close / QM-review affordance anywhere on this screen.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ImagePlus, Loader2 } from 'lucide-react';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { useAuth } from '@/lib/auth';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { handleApiError } from '@/lib/errorHandling';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { cn } from '@/lib/utils';
import { ROOT_CAUSE_CATEGORIES } from '@/pages/ncr/constants';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useIssuesShellContext } from './issuesShellContext';
import { useShellNcrParam } from './useShellNcrParam';
import { type NcrEvidenceItem, useNcrEvidence } from './useNcrEvidence';
import { useNcrRespond } from './useNcrRespond';
import {
  type IssuePillTone,
  canAddNcrEvidence,
  canForemanRespond,
  issueSeverityLabel,
  issueSeverityTone,
  issueStatusLabel,
  issueStatusTone,
} from './issuesShellState';

const PILL_TONE_CLASS: Record<IssuePillTone, string> = {
  attention: 'shell-pill shell-pill-attention',
  bad: 'shell-pill shell-pill-bad',
  good: 'shell-pill shell-pill-good',
  neutral: 'shell-pill',
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function isPhotoEvidence(item: NcrEvidenceItem): boolean {
  return (
    item.evidenceType === 'photo' ||
    Boolean(item.document?.mimeType?.toLowerCase().startsWith('image/'))
  );
}

function evidenceFilename(item: NcrEvidenceItem): string {
  return item.document?.caption || item.document?.filename || 'NCR evidence';
}

export function IssueDetailScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const ncrId = useShellNcrParam();
  const { projectId, ncrs, loading, refetch } = useIssuesShellContext();

  const ncr = useMemo(() => ncrs.find((n) => n.id === ncrId) ?? null, [ncrs, ncrId]);

  const { evidence, photos, evidenceLoading, uploading, addPhoto } = useNcrEvidence(
    ncr ? ncr.id : null,
    projectId,
  );
  const { submitting, respond } = useNcrRespond(projectId);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [respondOpen, setRespondOpen] = useState(false);
  const [rootCauseCategory, setRootCauseCategory] = useState('');
  const [rootCauseDescription, setRootCauseDescription] = useState('');
  const [proposedCorrectiveAction, setProposedCorrectiveAction] = useState('');

  const backPath = withProjectQuery('/m/issues', projectId);

  // ── Loading / not-found guards ─────────────────────────────────────────────
  if (loading && !ncr) {
    return (
      <ShellScreen variant="inner" title="Issue" parent={backPath} sub={<span>Loading…</span>}>
        <div className="h-[88px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[120px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  if (!ncr) {
    return (
      <ShellScreen variant="inner" title="Issue" parent={backPath} sub={<span>Not found</span>}>
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          This issue isn’t here anymore.
          <br />
          It may have moved off your project.
        </div>
      </ShellScreen>
    );
  }

  const responsibleName =
    ncr.responsibleUser?.fullName ||
    ncr.responsibleUser?.email ||
    ncr.responsibleSubcontractor?.companyName ||
    'Unassigned';

  const canRespond = canForemanRespond(ncr, user?.id);
  const visiblePhotos = photos.filter((item) => item.document?.id);
  const documentEvidence = evidence.filter((item) => item.document?.id && !isPhotoEvidence(item));
  const hasEvidence = visiblePhotos.length > 0 || documentEvidence.length > 0;
  const canAddPhotoEvidence = canAddNcrEvidence(ncr, user);
  const addPhotoDisabled = !isOnline || uploading || !canAddPhotoEvidence;

  const handleAddPhotoClick = () => {
    if (addPhotoDisabled) return;
    photoInputRef.current?.click();
  };
  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canAddPhotoEvidence) return;
    await addPhoto(file);
  };
  const handleOpenEvidence = (item: NcrEvidenceItem) => {
    const document = item.document;
    if (!document?.id) return;

    void openDocumentAccessUrl(document.id, document.fileUrl).catch((error) => {
      handleApiError(error, 'Could not open evidence');
    });
  };

  const respondValid =
    rootCauseCategory.trim().length > 0 &&
    rootCauseDescription.trim().length > 0 &&
    proposedCorrectiveAction.trim().length > 0;

  const handleSubmitResponse = async () => {
    if (!respondValid) return;
    const ok = await respond(ncr.id, {
      rootCauseCategory,
      rootCauseDescription,
      proposedCorrectiveAction,
    });
    if (ok) {
      setRespondOpen(false);
      setRootCauseCategory('');
      setRootCauseDescription('');
      setProposedCorrectiveAction('');
      void refetch();
      navigate(backPath);
    }
  };

  // ── Full-screen Respond form (only reachable when canRespond) ───────────────
  if (respondOpen && canRespond) {
    return (
      <ShellScreen
        variant="inner"
        title={`Respond — ${ncr.ncrNumber}`}
        parent={backPath}
        sub={<span className="truncate">{ncr.description}</span>}
        bottom={
          <div className="shell-cambar flex flex-col gap-2">
            {!isOnline && (
              <p
                className="px-1 text-center text-[12.5px] font-semibold text-warning"
                role="status"
              >
                Responses need signal — reconnect to submit.
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleSubmitResponse()}
              disabled={!respondValid || submitting || !isOnline}
              className={cn(
                'shell-cambar-btn',
                (!respondValid || submitting || !isOnline) && 'opacity-50',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                'Submit response'
              )}
            </button>
          </div>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Capture the root cause and what you’ll do to fix it. This moves the issue to
          Investigating.
        </p>

        <label className="mt-2 block text-[13px] font-semibold text-foreground" htmlFor="rc-cat">
          Root cause
        </label>
        <select
          id="rc-cat"
          value={rootCauseCategory}
          onChange={(e) => setRootCauseCategory(e.target.value)}
          className="min-h-[48px] w-full rounded-xl border border-border bg-background px-3 text-[15px] text-foreground"
        >
          <option value="">Select a category…</option>
          {ROOT_CAUSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label className="mt-2 block text-[13px] font-semibold text-foreground" htmlFor="rc-desc">
          What happened
        </label>
        <textarea
          id="rc-desc"
          value={rootCauseDescription}
          onChange={(e) => setRootCauseDescription(e.target.value)}
          rows={3}
          placeholder="Describe the root cause…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] text-foreground"
        />

        <label className="mt-2 block text-[13px] font-semibold text-foreground" htmlFor="rc-fix">
          How you’ll fix it
        </label>
        <textarea
          id="rc-fix"
          value={proposedCorrectiveAction}
          onChange={(e) => setProposedCorrectiveAction(e.target.value)}
          rows={3}
          placeholder="Describe the corrective action…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] text-foreground"
        />
      </ShellScreen>
    );
  }

  // ── Read-focused detail ─────────────────────────────────────────────────────
  const sub = (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span className="shell-mono">{ncr.category}</span>
      <span aria-hidden>·</span>
      <span className="shell-mono">{formatDate(ncr.createdAt)}</span>
    </span>
  );

  return (
    <ShellScreen
      variant="inner"
      title={ncr.ncrNumber}
      parent={backPath}
      sub={sub}
      bottom={
        canRespond ? (
          <div className="shell-cambar">
            <button
              type="button"
              onClick={() => setRespondOpen(true)}
              className="shell-cambar-btn"
              aria-label={`Respond to ${ncr.ncrNumber}`}
            >
              Respond
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Severity + status pills */}
      <div className="flex flex-wrap gap-[7px]">
        <span className={PILL_TONE_CLASS[issueSeverityTone(ncr.severity)]}>
          {issueSeverityLabel(ncr.severity).toUpperCase()}
        </span>
        <span className={PILL_TONE_CLASS[issueStatusTone(ncr.status)]}>
          {issueStatusLabel(ncr.status).toUpperCase()}
        </span>
      </div>

      {/* Description card */}
      <div className="shell-card">
        <div className="text-[15px] font-semibold text-foreground">What’s wrong</div>
        <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">
          {ncr.description}
        </p>
      </div>

      {/* Evidence */}
      <div className="shell-card">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[15px] font-semibold text-foreground">Evidence</div>
          <button
            type="button"
            onClick={handleAddPhotoClick}
            disabled={addPhotoDisabled}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground underline underline-offset-2 touch-manipulation disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus size={15} aria-hidden="true" />
            )}
            Add photo
          </button>
        </div>
        {!isOnline && (
          <p className="mt-2 text-[13px] font-semibold text-warning" role="status">
            Photo evidence needs signal: reconnect to upload.
          </p>
        )}
        {isOnline && !canAddPhotoEvidence && (
          <p className="mt-2 text-[13px] font-semibold text-muted-foreground" role="status">
            Photo evidence can only be added to open issues by eligible project users.
          </p>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelected}
          className="hidden"
        />

        {evidenceLoading ? (
          <div className="mt-2 text-[13px] text-muted-foreground">Loading evidence…</div>
        ) : !hasEvidence ? (
          <div className="mt-2 text-[13px] text-muted-foreground">
            No evidence yet. Add a photo from site.
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePhotos.length > 0 && (
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                {visiblePhotos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenEvidence(item)}
                    className="h-[88px] w-[88px] flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted touch-manipulation"
                    aria-label={`Open ${evidenceFilename(item)}`}
                  >
                    <SecureDocumentImage
                      documentId={item.document!.id}
                      fileUrl={item.document!.fileUrl ?? null}
                      alt={evidenceFilename(item)}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {documentEvidence.length > 0 && (
              <ul className="space-y-2">
                {documentEvidence.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenEvidence(item)}
                      className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-[13px] font-semibold text-foreground touch-manipulation"
                    >
                      <FileText size={16} className="flex-shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{evidenceFilename(item)}</span>
                      <span className="text-[11px] uppercase tracking-normal text-muted-foreground">
                        {item.evidenceType || 'file'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Responsible + dates card */}
      <div className="shell-card">
        <div className="text-[15px] font-semibold text-foreground">Details</div>
        <dl className="mt-2 space-y-1.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Responsible</dt>
            <dd className="min-w-0 truncate font-semibold text-foreground">{responsibleName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Raised</dt>
            <dd className="shell-mono text-foreground">{formatDate(ncr.createdAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Due</dt>
            <dd className="shell-mono text-foreground">{formatDate(ncr.dueDate)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Raised by</dt>
            <dd className="min-w-0 truncate font-semibold text-foreground">
              {ncr.raisedBy?.fullName || ncr.raisedBy?.email || '—'}
            </dd>
          </div>
        </dl>
      </div>
    </ShellScreen>
  );
}
