import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { isReleaseGatedChecklistItem } from '@/lib/itpReleaseGating';
import type { ITPInstance, ITPAttachment, ITPCompletion } from '../types';
import {
  canReviewItpItem,
  getItpVerificationDisplay,
  type ItpVerificationTone,
} from './itpChecklistTabHelpers';
import { ITPChecklistStatusActions } from './ITPChecklistStatusActions';

// I1-core: human-readable hold-point release method for the attribution line.
const RELEASE_METHOD_LABELS: Record<string, string> = {
  secure_link: 'secure link',
  email: 'email',
  in_person: 'in person',
  phone: 'phone',
};
function formatReleaseMethod(method: string): string {
  return RELEASE_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

// M15: badge styling per head-contractor verification state.
const VERIFICATION_TONE_CLASSES: Record<ItpVerificationTone, string> = {
  verified: 'bg-primary/10 text-primary',
  pending: 'bg-warning/10 text-warning',
  rejected: 'bg-destructive/10 text-destructive',
};

// Props for the ITP checklist item row
export interface ITPChecklistItemRowProps {
  item: ITPInstance['template']['checklistItems'][0];
  completion: ITPCompletion | undefined;
  projectId: string;
  updatingCompletion: string | null;
  onToggleCompletion: (checklistItemId: string, isCompleted: boolean, notes: string) => void;
  onUpdateNotes: (checklistItemId: string, notes: string) => void;
  onAddPhoto: (
    completionId: string,
    checklistItemId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  onMarkAsNA: (checklistItemId: string, itemDescription: string) => void;
  onMarkAsFailed: (checklistItemId: string, itemDescription: string) => void;
  onPhotoClick: (photo: ITPAttachment) => void;
  setItpInstance: React.Dispatch<React.SetStateAction<ITPInstance | null>>;
  // H4: head-contractor verify/reject affordances. `canReviewITP` is the
  // role-based gate; the row additionally hides the actions on the user's own
  // completion (assertDifferentVerifier) via canReviewItpItem.
  canReviewITP?: boolean;
  currentUserId?: string;
  reviewingCompletionId?: string | null;
  onVerifyCompletion?: (completionId: string) => void;
  onRequestReject?: (completionId: string, itemDescription: string) => void;
}

export function ITPChecklistItemRow({
  item,
  completion,
  projectId,
  updatingCompletion,
  onToggleCompletion,
  onUpdateNotes,
  onAddPhoto,
  onMarkAsNA,
  onMarkAsFailed,
  onPhotoClick,
  setItpInstance,
  canReviewITP = false,
  currentUserId,
  reviewingCompletionId = null,
  onVerifyCompletion,
  onRequestReject,
}: ITPChecklistItemRowProps) {
  const isCompleted = completion?.isCompleted || false;
  const isNotApplicable = completion?.isNotApplicable || false;
  const isFailed = completion?.isFailed || false;
  const notes = completion?.notes || '';
  // I1-core: a hold-point item cannot be ticked complete via the bare checkbox —
  // it must go through the hold-point release flow (which records attribution).
  // Once released, the completion mirrors that and the row reads as released.
  const isHoldPoint = isReleaseGatedChecklistItem(item);
  const isReleased = !!completion?.holdPointRelease?.releasedByName;
  const isHoldPointLocked = isHoldPoint && !isReleased && !isNotApplicable && !isFailed;
  // M15: head-contractor verification field-state (verified / pending / rejected).
  const verification = getItpVerificationDisplay(completion);
  // H4: whether to offer Verify/Reject on this row (role + pending + not-own-completion).
  const canReview = canReviewItpItem({ canReviewByRole: canReviewITP, currentUserId, completion });
  const isReviewing = !!completion?.id && reviewingCompletionId === completion.id;

  return (
    <div
      className={`p-4 ${isNotApplicable ? 'bg-muted/50' : ''} ${isFailed ? 'bg-destructive/10' : ''}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() =>
            !isNotApplicable &&
            !isFailed &&
            !isHoldPointLocked &&
            onToggleCompletion(item.id, isCompleted, notes)
          }
          disabled={
            updatingCompletion === item.id || isNotApplicable || isFailed || isHoldPointLocked
          }
          title={isHoldPointLocked ? 'Release this hold point to complete it' : undefined}
          aria-label={
            isFailed
              ? 'Failed'
              : isNotApplicable
                ? 'Not Applicable'
                : isHoldPointLocked
                  ? `Release the hold point "${item.description}" to complete it`
                  : isCompleted
                    ? `Mark "${item.description}" as incomplete`
                    : `Mark "${item.description}" as complete`
          }
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isFailed
              ? 'bg-destructive border-destructive text-destructive-foreground cursor-not-allowed'
              : isNotApplicable
                ? 'bg-muted-foreground border-muted-foreground text-background cursor-not-allowed'
                : isHoldPointLocked
                  ? 'border-border bg-muted/50 cursor-not-allowed'
                  : isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border hover:border-primary'
          } ${updatingCompletion === item.id ? 'opacity-50' : ''}`}
        >
          {isFailed ? (
            <span className="text-[10px] font-bold" aria-hidden="true">
              X
            </span>
          ) : isNotApplicable ? (
            <span className="text-[10px] font-bold" aria-hidden="true">
              -
            </span>
          ) : (
            isCompleted && (
              <span className="text-xs" aria-hidden="true">
                &#10003;
              </span>
            )
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Point type indicator: S=Standard, W=Witness, H=Hold */}
            <span
              className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ${
                isHoldPoint
                  ? 'bg-destructive/10 text-destructive'
                  : item.pointType === 'witness'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-muted text-muted-foreground'
              }`}
              title={
                isHoldPoint
                  ? 'Hold Point'
                  : item.pointType === 'witness'
                    ? 'Witness Point'
                    : 'Standard Point'
              }
            >
              {isHoldPoint ? 'H' : item.pointType === 'witness' ? 'W' : 'S'}
            </span>
            <span
              className={`font-medium ${isCompleted || isNotApplicable ? 'line-through text-muted-foreground' : ''}`}
            >
              {item.order}. {item.description}
            </span>
            {/* N/A Badge */}
            {isNotApplicable && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-medium">
                N/A
              </span>
            )}
            {isHoldPoint && (
              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                Hold Point
              </span>
            )}
            {/* M15: head-contractor verification badge */}
            {verification && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${VERIFICATION_TONE_CLASSES[verification.tone]}`}
                title="Head-contractor verification status"
              >
                {verification.label}
              </span>
            )}
            {/* Responsible party badge */}
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                item.responsibleParty === 'superintendent'
                  ? 'bg-muted text-muted-foreground'
                  : item.responsibleParty === 'subcontractor'
                    ? 'bg-muted text-muted-foreground'
                    : item.responsibleParty === 'contractor'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-muted text-muted-foreground'
              }`}
            >
              {item.responsibleParty === 'superintendent'
                ? 'Superintendent'
                : item.responsibleParty === 'subcontractor'
                  ? 'Subcontractor'
                  : item.responsibleParty === 'contractor'
                    ? 'Contractor'
                    : item.category || 'General'}
            </span>
            {/* Evidence required icons */}
            {item.evidenceRequired === 'photo' && (
              <span
                className="inline-flex items-center text-muted-foreground"
                title="Photo required"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
            {(item.evidenceRequired === 'test' || item.testType) && (
              <span
                className="inline-flex items-center gap-1 text-muted-foreground"
                title={item.testType ? `Test required: ${item.testType}` : 'Test required'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z"
                    clipRule="evenodd"
                  />
                </svg>
                {item.testType && <span className="text-xs">{item.testType}</span>}
              </span>
            )}
            {item.evidenceRequired === 'document' && (
              <span
                className="inline-flex items-center text-muted-foreground"
                title="Document required"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </div>
          {/* Acceptance Criteria (Feature #632) */}
          {item.acceptanceCriteria && (
            <div className="mt-2 text-sm bg-primary/5 border border-primary/20 rounded-md p-2">
              <span className="font-medium text-primary">Acceptance Criteria:</span>
              <span className="ml-1 text-primary/80">{item.acceptanceCriteria}</span>
            </div>
          )}
          <div className="mt-2">
            <input
              type="text"
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => {
                // Optimistic update
                setItpInstance((prev) => {
                  if (!prev) return prev;
                  const existingIndex = prev.completions.findIndex(
                    (c) => c.checklistItemId === item.id,
                  );
                  const newCompletions = [...prev.completions];
                  if (existingIndex >= 0) {
                    newCompletions[existingIndex] = {
                      ...newCompletions[existingIndex],
                      notes: e.target.value,
                    };
                  } else {
                    newCompletions.push({
                      id: '',
                      checklistItemId: item.id,
                      isCompleted: false,
                      notes: e.target.value,
                      completedAt: null,
                      completedBy: null,
                      isVerified: false,
                      verifiedAt: null,
                      verifiedBy: null,
                      attachments: [],
                    });
                  }
                  return { ...prev, completions: newCompletions };
                });
              }}
              onBlur={(e) => onUpdateNotes(item.id, e.target.value)}
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
            />
          </div>
          <ITPChecklistStatusActions
            isCompleted={isCompleted}
            isNotApplicable={isNotApplicable}
            isFailed={isFailed}
            isUpdating={updatingCompletion === item.id}
            canPass={!isHoldPointLocked}
            holdPointBlocked={isHoldPointLocked}
            onPass={() => onToggleCompletion(item.id, isCompleted, notes)}
            onFail={() => onMarkAsFailed(item.id, item.description)}
            onMarkNotApplicable={() => onMarkAsNA(item.id, item.description)}
          />
          {isHoldPoint && completion?.holdPointRelease?.releasedByName ? (
            <p className="text-xs text-muted-foreground mt-1">
              Released by {completion.holdPointRelease.releasedByName}
              {completion.holdPointRelease.releasedByOrg &&
                `, ${completion.holdPointRelease.releasedByOrg}`}
              {completion.holdPointRelease.releasedAt &&
                ` on ${new Date(completion.holdPointRelease.releasedAt).toLocaleDateString('en-AU')}`}
              {completion.holdPointRelease.releaseMethod &&
                ` via ${formatReleaseMethod(completion.holdPointRelease.releaseMethod)}`}
            </p>
          ) : completion?.completedBy ? (
            <p className="text-xs text-muted-foreground mt-1">
              Completed by {completion.completedBy.fullName || completion.completedBy.email}
              {completion.completedAt &&
                ` on ${new Date(completion.completedAt).toLocaleDateString('en-AU')}`}
            </p>
          ) : null}

          {/* Witness Point Details (if this is a witness point and has witness data) */}
          {item.pointType === 'witness' &&
            completion?.witnessPresent !== undefined &&
            completion?.witnessPresent !== null && (
              <div className="mt-2 p-2 bg-muted rounded border border-border">
                <p className="text-xs font-medium text-foreground">Witness Details:</p>
                {completion.witnessPresent ? (
                  <p className="text-xs text-muted-foreground">
                    Witness present: {completion.witnessName || 'Name not recorded'}
                    {completion.witnessCompany && ` (${completion.witnessCompany})`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Witness not present (notification given)
                  </p>
                )}
              </div>
            )}

          {/* Photo Attachments Section */}
          <div className="mt-3 pt-2 border-t border-border">
            {/* Display existing attachments */}
            {completion?.attachments && completion.attachments.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <span>Photos ({completion.attachments.length})</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {completion.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group cursor-pointer"
                      onClick={() => onPhotoClick(attachment)}
                    >
                      <SecureDocumentImage
                        documentId={attachment.document.id}
                        fileUrl={attachment.document.fileUrl}
                        alt={attachment.document.caption || attachment.document.filename}
                        className="w-16 h-16 object-cover rounded border hover:border-primary transition-colors"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <span className="text-white text-xs">View</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Photo Button */}
            {completion?.id && !isNotApplicable && (
              <label className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 cursor-pointer">
                <span>Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAddPhoto(completion.id, item.id, e)}
                />
              </label>
            )}
            {!completion?.id && !isNotApplicable && (
              <span className="text-xs text-muted-foreground italic">
                Complete the item first to attach photos
              </span>
            )}

            {/* Show N/A reason */}
            {isNotApplicable && notes && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Reason:</span> {notes}
              </p>
            )}

            {/* Show Failed status with NCR link */}
            {isFailed && (
              <p className="text-xs text-destructive mt-1">
                <span className="font-medium">Failed</span>
                {notes && `: ${notes}`}
                {completion?.linkedNcr && (
                  <a
                    href={`/projects/${encodeURIComponent(projectId)}/ncr`}
                    className="ml-2 underline hover:text-destructive/80"
                  >
                    View NCR {completion.linkedNcr.ncrNumber}
                  </a>
                )}
              </p>
            )}

            {/* H4: head-contractor verify/reject actions for an item awaiting
                verification. Hidden on the user's own completion. */}
            {canReview && completion?.id && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onVerifyCompletion?.(completion.id)}
                  disabled={isReviewing}
                  className="inline-flex items-center gap-1 rounded border border-primary/40 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  type="button"
                  onClick={() => onRequestReject?.(completion.id, item.description)}
                  disabled={isReviewing}
                  className="inline-flex items-center gap-1 rounded border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}

            {/* M15: head-contractor rejection — show the reason so the field
                worker knows what to fix, plus how to clear it (H6 resubmit). */}
            {verification?.tone === 'rejected' && (
              <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded">
                <p className="text-xs font-medium text-destructive">
                  Rejected by head contractor{verification.rejectionReason ? ':' : ''}
                </p>
                {verification.rejectionReason && (
                  <p className="text-xs text-destructive/90 mt-0.5">
                    {verification.rejectionReason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Redo the work and re-complete this item to resubmit it for verification.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
