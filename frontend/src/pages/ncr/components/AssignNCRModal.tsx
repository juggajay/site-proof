import { useEffect, useState, memo } from 'react';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useResponsiblePartyOptions } from '../hooks/useResponsiblePartyOptions';
import { ResponsiblePartyPicker, type ResponsibleParty } from './ResponsiblePartyPicker';
import type { NCR } from '../types';

interface AssignNCRModalProps {
  isOpen: boolean;
  ncr: NCR | null;
  projectId?: string;
  onClose: () => void;
  onSubmit: (
    ncrId: string,
    assignment: {
      responsibleUserId?: string | null;
      responsibleSubcontractorId?: string | null;
    },
  ) => void;
  loading: boolean;
}

function initialPartyFromNcr(ncr: NCR | null): ResponsibleParty {
  if (!ncr) return { type: 'unassigned' };
  const userId = ncr.responsibleUserId ?? ncr.responsibleUser?.id;
  if (userId) {
    return { type: 'user', userId };
  }
  const subId = ncr.responsibleSubcontractorId ?? ncr.responsibleSubcontractor?.id;
  if (subId) {
    return { type: 'subcontractor', subcontractorId: subId };
  }
  return { type: 'unassigned' };
}

function AssignNCRModalInner({
  isOpen,
  ncr,
  projectId,
  onClose,
  onSubmit,
  loading,
}: AssignNCRModalProps) {
  const [party, setParty] = useState<ResponsibleParty>({ type: 'unassigned' });

  const {
    users,
    subcontractors,
    subcontractorsUnavailable,
    loading: optionsLoading,
    error: optionsError,
    retry,
  } = useResponsiblePartyOptions(projectId, isOpen);

  // Seed the picker from the NCR's current responsible party each time it opens.
  useEffect(() => {
    if (isOpen) {
      setParty(initialPartyFromNcr(ncr));
    }
  }, [isOpen, ncr]);

  if (!isOpen || !ncr) return null;

  const handleSubmit = () => {
    if (party.type === 'user') {
      onSubmit(ncr.id, { responsibleUserId: party.userId, responsibleSubcontractorId: null });
    } else if (party.type === 'subcontractor') {
      onSubmit(ncr.id, {
        responsibleSubcontractorId: party.subcontractorId,
        responsibleUserId: null,
      });
    } else {
      onSubmit(ncr.id, { responsibleUserId: null, responsibleSubcontractorId: null });
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <ModalHeader>Assign {ncr.ncrNumber}</ModalHeader>
      <ModalDescription>
        Assign this NCR to a project user or a subcontractor company, or clear it to unassigned.
      </ModalDescription>
      <ModalBody>
        <ResponsiblePartyPicker
          id="assign-ncr-responsible-party"
          value={party}
          onChange={setParty}
          users={users}
          subcontractors={subcontractors}
          subcontractorsUnavailable={subcontractorsUnavailable}
          loading={optionsLoading}
          error={optionsError}
          onRetry={retry}
          disabled={loading}
        />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={loading || optionsLoading}>
          {loading ? 'Saving...' : 'Save Assignment'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export const AssignNCRModal = memo(AssignNCRModalInner);
