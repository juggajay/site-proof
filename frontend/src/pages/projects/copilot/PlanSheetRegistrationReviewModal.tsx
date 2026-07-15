import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { toast } from '@/components/ui/toaster';
import { queryKeys } from '@/lib/queryKeys';
import { DEFAULT_COORDINATE_SYSTEM } from '@/lib/spatial/coordinateSystems';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { PlanSheetRegistrationModal } from '../settings/PlanSheetRegistrationModal';
import { PlanSheetUploadModal } from '../settings/PlanSheetUploadModal';
import type { EditablePoint } from '../settings/RegistrationSidePanel';
import type { PlanSheetListItem, PlanSheetRegistration } from '../settings/planSheetsData';
import {
  useDecideProposal,
  useExtractPlanSheet,
  type CopilotProposal,
  type PlanSheetCandidate,
} from './copilotData';

interface PlanSheetRegistrationReviewModalProps {
  projectId: string;
  sheets: PlanSheetListItem[];
  /** Datum for the in-flow upload's coordinate-system default (usually the control line's). */
  defaultCoordinateSystem?: string;
  /** A live 'proposed' plan-sheet proposal to review directly (skips the picker). */
  existingProposal?: CopilotProposal | null;
  /** Fired once a sheet is registered (drives the next-step hand-off). */
  onApplied?: () => void;
  onClose: () => void;
}

interface ReviewState {
  proposalId: string;
  candidate: PlanSheetCandidate;
}

function candidateFromProposal(proposal: CopilotProposal): PlanSheetCandidate {
  const payload = (proposal.payload ?? {}) as Partial<PlanSheetCandidate>;
  return {
    planSheetId: typeof payload.planSheetId === 'string' ? payload.planSheetId : '',
    coordinateSystem: payload.coordinateSystem ?? null,
    points: Array.isArray(payload.points) ? payload.points : [],
  };
}

// Seed a draggable control point per AI mark: place it at the model's approximate
// normalized position (sheet centre when it could not read one) with the printed
// grid coordinates pre-filled. The user drags each onto its exact mark.
function toEditablePoints(
  candidate: PlanSheetCandidate,
  sheet: PlanSheetListItem,
): EditablePoint[] {
  return candidate.points.map((p) => ({
    px: (p.approxX ?? 0.5) * sheet.imageWidth,
    py: (p.approxY ?? 0.5) * sheet.imageHeight,
    eastingText: String(p.easting),
    northingText: String(p.northing),
  }));
}

export function PlanSheetRegistrationReviewModal({
  projectId,
  sheets,
  defaultCoordinateSystem,
  existingProposal,
  onApplied,
  onClose,
}: PlanSheetRegistrationReviewModalProps) {
  const [review, setReview] = useState<ReviewState | null>(() =>
    existingProposal
      ? { proposalId: existingProposal.id, candidate: candidateFromProposal(existingProposal) }
      : null,
  );

  const queryClient = useQueryClient();
  const extractMutation = useExtractPlanSheet(projectId);
  const decideMutation = useDecideProposal(projectId);

  const reviewSheet = review
    ? (sheets.find((s) => s.id === review.candidate.planSheetId) ?? null)
    : null;

  const handleRead = async (planSheetId: string) => {
    try {
      const result = await extractMutation.mutateAsync(planSheetId);
      setReview({ proposalId: result.proposalId, candidate: result.candidate });
    } catch (error) {
      logError('Failed to read plan sheet coordinates:', error);
      toast({
        title: 'Could not read that sheet',
        description: extractErrorMessage(
          error,
          'Register it manually by clicking known points instead.',
        ),
        variant: 'error',
      });
    }
  };

  const handleSubmit = async (registration: PlanSheetRegistration) => {
    if (!review) return;
    await decideMutation.mutateAsync({
      proposalId: review.proposalId,
      action: 'accept',
      editedPayload: { planSheetId: review.candidate.planSheetId, registration },
    });
    toast({
      title: 'Sheet registered',
      description: `${reviewSheet?.name ?? 'The sheet'} is now on the project map.`,
    });
    onApplied?.();
  };

  const handleDismiss = async () => {
    if (!review) {
      onClose();
      return;
    }
    try {
      await decideMutation.mutateAsync({ proposalId: review.proposalId, action: 'reject' });
      toast({ title: 'Suggestion dismissed' });
    } catch (error) {
      logError('Failed to dismiss plan-sheet suggestion:', error);
    } finally {
      onClose();
    }
  };

  // Review step: seed the existing full-screen registration editor with the AI's
  // approximate markers. Falls back to an error card if the sheet was deleted.
  if (review) {
    if (!reviewSheet) {
      return (
        <Modal onClose={onClose}>
          <ModalHeader>Sheet unavailable</ModalHeader>
          <ModalBody>
            <p className="text-sm text-muted-foreground">
              The plan sheet for this suggestion no longer exists. Dismiss the suggestion and read
              from a current sheet.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDismiss()}
              disabled={decideMutation.isLoading}
            >
              Dismiss suggestion
            </Button>
          </ModalFooter>
        </Modal>
      );
    }
    return (
      <PlanSheetRegistrationModal
        projectId={projectId}
        sheet={reviewSheet}
        initialPoints={toEditablePoints(review.candidate, reviewSheet)}
        onSubmitRegistration={handleSubmit}
        onDismiss={() => void handleDismiss()}
        submitting={decideMutation.isLoading}
        onSaved={() => {}}
        onClose={onClose}
      />
    );
  }

  // In-flow upload: with no sheets yet, offer the same upload machinery the Plan
  // Sheets settings tab uses so the user never has to leave the copilot. Once a
  // sheet lands the query invalidates, `sheets` fills, and this falls through to
  // the picker — continuing straight into extraction.
  if (sheets.length === 0) {
    return (
      <PlanSheetUploadModal
        projectId={projectId}
        defaultCoordinateSystem={defaultCoordinateSystem ?? DEFAULT_COORDINATE_SYSTEM}
        onUploaded={() =>
          void queryClient.invalidateQueries({ queryKey: queryKeys.planSheets(projectId) })
        }
        onClose={onClose}
      />
    );
  }

  // Picker step: choose which sheet to read. Extract targets an already-stored
  // sheet, so this is a plain list — not an upload.
  return (
    <Modal
      onClose={() => {
        if (!extractMutation.isLoading) onClose();
      }}
    >
      <ModalHeader>Register a plan sheet</ModalHeader>
      <ModalDescription>
        Pick a sheet and the copilot reads its printed grid coordinates, then seeds draggable
        markers you snap onto each mark before applying.
      </ModalDescription>
      <ModalBody>
        <ul className="space-y-2">
          {sheets.map((sheet) => (
            <li
              key={sheet.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{sheet.name}</span>
                </span>
                {sheet.hasRegistration && (
                  <span className="mt-0.5 block text-xs text-success">Already registered</span>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={extractMutation.isLoading}
                onClick={() => void handleRead(sheet.id)}
              >
                {extractMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reading…
                  </>
                ) : sheet.hasRegistration ? (
                  'Re-read'
                ) : (
                  'Read from sheet'
                )}
              </Button>
            </li>
          ))}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={extractMutation.isLoading}
        >
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
