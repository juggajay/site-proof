import React, { useState } from 'react'
import { X, Package } from 'lucide-react'
import type { ClaimPackageOptions } from '@/lib/pdfGenerator'
import { DEFAULT_PACKAGE_OPTIONS } from '../constants'

interface EvidencePackageModalProps {
  claimId: string
  onClose: () => void
  onGenerate: (claimId: string, options: ClaimPackageOptions) => void
}

const PACKAGE_SECTIONS: { key: keyof ClaimPackageOptions; label: string; description: string }[] = [
  { key: 'includeLotSummary', label: 'Lot Summary Table', description: 'Overview table of all lots in the claim' },
  { key: 'includeLotDetails', label: 'Individual Lot Details', description: 'Detailed breakdown for each lot' },
  { key: 'includeITPChecklists', label: 'ITP Checklists', description: 'Inspection and test plan completions' },
  { key: 'includeTestResults', label: 'Test Results', description: 'Laboratory test results and pass/fail status' },
  { key: 'includeNCRs', label: 'Non-Conformance Reports', description: 'NCR status and resolution details' },
  { key: 'includeHoldPoints', label: 'Hold Points', description: 'Hold point release information' },
  { key: 'includePhotos', label: 'Photo Evidence', description: 'Photo counts and references' },
  { key: 'includeDeclaration', label: 'Declaration Page', description: 'Signature page for verification' },
]

const ALL_TRUE: ClaimPackageOptions = { ...DEFAULT_PACKAGE_OPTIONS }

const ALL_FALSE: ClaimPackageOptions = {
  includeLotSummary: false,
  includeLotDetails: false,
  includeITPChecklists: false,
  includeTestResults: false,
  includeNCRs: false,
  includeHoldPoints: false,
  includePhotos: false,
  includeDeclaration: false,
}

export const EvidencePackageModal = React.memo(function EvidencePackageModal({
  claimId,
  onClose,
  onGenerate,
}: EvidencePackageModalProps) {
  const [options, setOptions] = useState<ClaimPackageOptions>({ ...DEFAULT_PACKAGE_OPTIONS })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Customize Evidence Package</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-muted-foreground text-sm">
            Select which sections to include in the evidence package PDF:
          </p>

          <div className="space-y-3">
            {PACKAGE_SECTIONS.map(({ key, label, description }) => (
              <label key={key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => setOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
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
              onClick={() => setOptions({ ...ALL_TRUE })}
              className="text-sm text-primary hover:underline"
            >
              Select All
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={() => setOptions({ ...ALL_FALSE })}
              className="text-sm text-primary hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(claimId, options)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Package className="h-4 w-4" />
            Generate Package
          </button>
        </div>
      </div>
    </div>
  )
})
