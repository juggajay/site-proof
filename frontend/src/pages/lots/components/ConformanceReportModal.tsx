import { FileText } from 'lucide-react'
import type { ConformanceFormat } from '@/lib/pdfGenerator'

interface FormatOption {
  value: ConformanceFormat
  label: string
  description: string
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Generic conformance report format suitable for most clients',
  },
  {
    value: 'tmr',
    label: 'TMR (Queensland)',
    description: 'Transport and Main Roads format - MRTS compliant with contractor/superintendent signature blocks',
  },
  {
    value: 'tfnsw',
    label: 'TfNSW (New South Wales)',
    description: 'Transport for NSW QA Specification compliant format with signature blocks',
  },
  {
    value: 'vicroads',
    label: 'VicRoads (Victoria)',
    description: 'Department of Transport Victoria Section Specification format',
  },
  {
    value: 'dit',
    label: 'DIT (South Australia)',
    description: 'Department for Infrastructure and Transport Master Specification format',
  },
]

interface ConformanceReportModalProps {
  isOpen: boolean
  selectedFormat: ConformanceFormat
  onFormatChange: (format: ConformanceFormat) => void
  onGenerate: () => void
  onClose: () => void
}

export function ConformanceReportModal({
  isOpen,
  selectedFormat,
  onFormatChange,
  onGenerate,
  onClose,
}: ConformanceReportModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Generate Conformance Package</h2>
            <p className="text-sm text-muted-foreground">Select output format for the conformance report</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Report Format
            </label>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedFormat === option.value
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="reportFormat"
                    value={option.value}
                    checked={selectedFormat === option.value}
                    onChange={(e) => onFormatChange(e.target.value as ConformanceFormat)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onGenerate}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  )
}
