import React, { useState } from 'react';
import { Loader2, Package } from 'lucide-react';
import type { ClaimPackageOptions } from '@/lib/pdfGenerator';
import { DEFAULT_PACKAGE_OPTIONS } from '../constants';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface EvidencePackageModalProps {
  claimId: string;
  isGenerating?: boolean;
  error?: string | null;
  onClose: () => void;
  onGenerate: (claimId: string, options: ClaimPackageOptions) => void;
}

const PACKAGE_SECTIONS: { key: keyof ClaimPackageOptions; label: string; description: string }[] = [
  {
    key: 'includeLotSummary',
    label: 'Lot Summary Table',
    description: 'Overview table of all lots in the claim',
  },
  {
    key: 'includeLotDetails',
    label: 'Individual Lot Details',
    description: 'Detailed breakdown for each lot',
  },
  {
    key: 'includeITPChecklists',
    label: 'ITP Checklists',
    description: 'Inspection and test plan completions',
  },
  {
    key: 'includeTestResults',
    label: 'Test Results',
    description: 'Laboratory test results and pass/fail status',
  },
  {
    key: 'includeNCRs',
    label: 'Non-Conformance Reports',
    description: 'NCR status and resolution details',
  },
  { key: 'includeHoldPoints', label: 'Hold Points', description: 'Hold point release information' },
  { key: 'includePhotos', label: 'Photo Evidence', description: 'Photo counts and references' },
  {
    key: 'includeDeclaration',
    label: 'Declaration Page',
    description: 'Signature page for verification',
  },
];

const ALL_TRUE: ClaimPackageOptions = { ...DEFAULT_PACKAGE_OPTIONS };

const ALL_FALSE: ClaimPackageOptions = {
  includeLotSummary: false,
  includeLotDetails: false,
  includeITPChecklists: false,
  includeTestResults: false,
  includeNCRs: false,
  includeHoldPoints: false,
  includePhotos: false,
  includeDeclaration: false,
};

export const EvidencePackageModal = React.memo(function EvidencePackageModal({
  claimId,
  isGenerating = false,
  error = null,
  onClose,
  onGenerate,
}: EvidencePackageModalProps) {
  const [options, setOptions] = useState<ClaimPackageOptions>({ ...DEFAULT_PACKAGE_OPTIONS });
  const hasSelectedSections = Object.values(options).some(Boolean);
  const handleGenerate = () => {
    if (!hasSelectedSections || isGenerating) {
      return;
    }

    onGenerate(claimId, options);
  };

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>Customize Evidence Package</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Select which sections to include in the evidence package PDF:
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {!hasSelectedSections && (
            <div
              role="alert"
              className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
            >
              Select at least one section to generate an evidence package.
            </div>
          )}

          <div className="space-y-3">
            {PACKAGE_SECTIONS.map(({ key, label, description }) => (
              <label
                key={key}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={options[key]}
                  disabled={isGenerating}
                  onChange={(e) => setOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-sm text-muted-foreground">{description}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              disabled={isGenerating}
              onClick={() => setOptions({ ...ALL_TRUE })}
              className="text-sm text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Select All
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              disabled={isGenerating}
              onClick={() => setOptions({ ...ALL_FALSE })}
              className="text-sm text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={isGenerating}>
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={handleGenerate}
          disabled={isGenerating || !hasSelectedSections}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Package className="h-4 w-4" />
          )}
          {isGenerating ? 'Generating...' : 'Generate Package'}
        </Button>
      </ModalFooter>
    </Modal>
  );
});
