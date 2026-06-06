import { useState, type MutableRefObject } from 'react';
import { handleApiError } from '@/lib/errorHandling';

interface ActionModalState {
  checklistItemId: string;
  itemDescription: string;
}

interface WitnessModalState extends ActionModalState {
  existingNotes: string | null;
}

interface EvidenceWarningState extends ActionModalState {
  evidenceType: string;
  currentNotes: string | null;
}

export interface ItpActionModalHandlers {
  markAsNA: (checklistItemId: string, reason: string) => Promise<boolean>;
  markAsFailed: (input: {
    checklistItemId: string;
    description: string;
    category: string;
    severity: string;
  }) => Promise<boolean>;
  completeWitnessPoint: (input: {
    checklistItemId: string;
    existingNotes: string | null;
    witnessPresent: boolean;
    witnessName?: string;
    witnessCompany?: string;
  }) => Promise<void>;
}

export function useItpActionModals(
  actionHandlersRef: MutableRefObject<Partial<ItpActionModalHandlers>>,
) {
  const [evidenceWarning, setEvidenceWarning] = useState<EvidenceWarningState | null>(null);
  const [naModal, setNaModal] = useState<ActionModalState | null>(null);
  const [submittingNa, setSubmittingNa] = useState(false);
  const [failedModal, setFailedModal] = useState<ActionModalState | null>(null);
  const [submittingFailed, setSubmittingFailed] = useState(false);
  const [witnessModal, setWitnessModal] = useState<WitnessModalState | null>(null);
  const [submittingWitness, setSubmittingWitness] = useState(false);

  const handleSubmitNA = async (reason: string) => {
    if (!naModal) return;
    setSubmittingNa(true);
    try {
      if (!actionHandlersRef.current.markAsNA) return;
      const ok = await actionHandlersRef.current.markAsNA(naModal.checklistItemId, reason);
      if (ok) setNaModal(null);
    } finally {
      setSubmittingNa(false);
    }
  };

  const handleSubmitFailed = async (description: string, category: string, severity: string) => {
    if (!failedModal) return;
    setSubmittingFailed(true);
    try {
      if (!actionHandlersRef.current.markAsFailed) return;
      const ok = await actionHandlersRef.current.markAsFailed({
        checklistItemId: failedModal.checklistItemId,
        description,
        category,
        severity,
      });
      if (ok) setFailedModal(null);
    } finally {
      setSubmittingFailed(false);
    }
  };

  const handleSubmitWitness = async (
    witnessPresent: boolean,
    witnessName?: string,
    witnessCompany?: string,
  ) => {
    if (!witnessModal) return;
    setSubmittingWitness(true);
    try {
      if (!actionHandlersRef.current.completeWitnessPoint) return;
      await actionHandlersRef.current.completeWitnessPoint({
        checklistItemId: witnessModal.checklistItemId,
        existingNotes: witnessModal.existingNotes,
        witnessPresent,
        witnessName,
        witnessCompany,
      });
      setWitnessModal(null);
    } catch (err) {
      handleApiError(err, 'Failed to complete witness point');
    } finally {
      setSubmittingWitness(false);
    }
  };

  return {
    evidenceWarning,
    setEvidenceWarning,
    naModal,
    setNaModal,
    submittingNa,
    failedModal,
    setFailedModal,
    submittingFailed,
    witnessModal,
    setWitnessModal,
    submittingWitness,
    handleSubmitNA,
    handleSubmitFailed,
    handleSubmitWitness,
  };
}
