// Wave G G1 — the revision timeline for one governed record
// (docs/plans/wave-g-execution-spec-2026-07-31.md §1.6).
//
// The DESKTOP shell around the timeline. Everything inside it — the loading /
// disabled / error / empty states, the issue list, the recipients and the
// acknowledge button — lives in RevisionTimelineBody, which the foreman shell's
// doc sheet renders inline. One implementation, two shells.
import { RevisionTimelineBody } from './RevisionTimelineBody';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';

export type { RevisionAcknowledgement, RevisionIssue } from './revisionTimelineState';

interface RevisionTimelineModalProps {
  projectId: string;
  entityType: string;
  entityId: string;
  /** What the record is called, for the heading. */
  recordLabel: string;
  /** The signed-in user, so their own outstanding acknowledgement can be offered. */
  currentUserId: string | null;
  onClose: () => void;
}

export function RevisionTimelineModal({
  projectId,
  entityType,
  entityId,
  recordLabel,
  currentUserId,
  onClose,
}: RevisionTimelineModalProps) {
  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <ModalHeader>Revision history — {recordLabel}</ModalHeader>
      <ModalBody>
        <RevisionTimelineBody
          projectId={projectId}
          entityType={entityType}
          entityId={entityId}
          currentUserId={currentUserId}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
