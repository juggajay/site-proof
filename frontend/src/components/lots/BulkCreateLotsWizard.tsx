import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'

interface BulkCreateLotsWizardProps {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}

interface LotPreview {
  lotNumber: string
  description: string
  chainageStart: number
  chainageEnd: number
  activityType: string
  layer: string
}

type WizardStep = 'chainage' | 'parameters' | 'preview' | 'confirm'

const ACTIVITY_TYPES = ['Earthworks', 'Pavement', 'Drainage', 'Concrete', 'Structures']
const LAYERS = ['Subgrade', 'Subbase', 'Base', 'Surface', 'Wearing Course']

export function BulkCreateLotsWizard({ projectId, onClose, onSuccess }: BulkCreateLotsWizardProps) {
  const [step, setStep] = useState<WizardStep>('chainage')
  const [creating, setCreating] = useState(false)

  // Step 1: Chainage range
  const [chainageStart, setChainageStart] = useState('')
  const [chainageEnd, setChainageEnd] = useState('')
  const [lotInterval, setLotInterval] = useState('100')

  // Step 2: Lot parameters
  const [lotPrefix, setLotPrefix] = useState('LOT')
  const [activityType, setActivityType] = useState('Earthworks')
  const [layer, setLayer] = useState('')
  const [descriptionTemplate, setDescriptionTemplate] = useState('{prefix}-{start}-{end}')

  // Generated lots preview
  const [lotsPreview, setLotsPreview] = useState<LotPreview[]>([])

  // Generate lot previews based on chainage range and parameters
  const generatePreview = () => {
    const start = parseInt(chainageStart)
    const end = parseInt(chainageEnd)
    const interval = parseInt(lotInterval)

    if (isNaN(start) || isNaN(end) || isNaN(interval) || interval <= 0) {
      toast({ variant: 'error', description: 'Invalid chainage values' })
      return
    }

    if (end <= start) {
      toast({ variant: 'error', description: 'End chainage must be greater than start chainage' })
      return
    }

    const lots: LotPreview[] = []
    let lotNum = 1
    for (let ch = start; ch < end; ch += interval) {
      const lotEnd = Math.min(ch + interval, end)
      const lotNumber = `${lotPrefix}-${String(lotNum).padStart(3, '0')}`
      const description = descriptionTemplate
        .replace('{prefix}', lotPrefix)
        .replace('{start}', String(ch))
        .replace('{end}', String(lotEnd))
        .replace('{num}', String(lotNum))

      lots.push({
        lotNumber,
        description,
        chainageStart: ch,
        chainageEnd: lotEnd,
        activityType,
        layer,
      })
      lotNum++
    }

    setLotsPreview(lots)
    setStep('preview')
  }

  // Create lots via API
  const createLots = async () => {
    setCreating(true)
    try {
      const data = await apiFetch<{ count: number }>('/api/lots/bulk', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          lots: lotsPreview.map(lot => ({
            lotNumber: lot.lotNumber,
            description: lot.description,
            chainageStart: lot.chainageStart,
            chainageEnd: lot.chainageEnd,
            activityType: lot.activityType,
            layer: lot.layer || null,
            lotType: 'chainage',
          })),
        }),
      })

      toast({ variant: 'success', description: `Successfully created ${data.count} lots` })
      onSuccess()
    } catch (error) {
      handleApiError(error, 'Failed to create lots')
    } finally {
      setCreating(false)
    }
  }

  const canProceedFromChainage = chainageStart && chainageEnd && lotInterval && parseInt(chainageEnd) > parseInt(chainageStart)
  const canProceedFromParameters = lotPrefix.trim() !== ''

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Bulk Create Lots</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Progress Steps */}
          <div className="flex items-center mt-4 space-x-2">
            {(['chainage', 'parameters', 'preview', 'confirm'] as WizardStep[]).map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? 'bg-blue-600 text-white'
                      : ['chainage', 'parameters', 'preview', 'confirm'].indexOf(step) > i
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {['chainage', 'parameters', 'preview', 'confirm'].indexOf(step) > i ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && <div className="w-12 h-0.5 bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Chainage Range */}
          {step === 'chainage' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Step 1: Define Chainage Range</h3>
              <p className="text-sm text-gray-600">
                Enter the chainage range and interval to generate lots automatically.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Chainage (m)
                  </label>
                  <input
                    type="number"
                    value={chainageStart}
                    onChange={(e) => setChainageStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Chainage (m)
                  </label>
                  <input
                    type="number"
                    value={chainageEnd}
                    onChange={(e) => setChainageEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Interval (m)
                  </label>
                  <input
                    type="number"
                    value={lotInterval}
                    onChange={(e) => setLotInterval(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="100"
                  />
                </div>
              </div>
              {chainageStart && chainageEnd && lotInterval && (
                <p className="text-sm text-gray-500">
                  This will create approximately{' '}
                  <span className="font-medium">
                    {Math.ceil((parseInt(chainageEnd) - parseInt(chainageStart)) / parseInt(lotInterval))}
                  </span>{' '}
                  lots
                </p>
              )}
            </div>
          )}

          {/* Step 2: Lot Parameters */}
          {step === 'parameters' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Step 2: Configure Lot Parameters</h3>
              <p className="text-sm text-gray-600">
                Set the common parameters for all lots to be created.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Number Prefix
                  </label>
                  <input
                    type="text"
                    value={lotPrefix}
                    onChange={(e) => setLotPrefix(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="LOT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Activity Type
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    {ACTIVITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Layer (optional)
                  </label>
                  <select
                    value={layer}
                    onChange={(e) => setLayer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select layer...</option>
                    {LAYERS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description Template
                  </label>
                  <input
                    type="text"
                    value={descriptionTemplate}
                    onChange={(e) => setDescriptionTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="{prefix} Ch {start}-{end}"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Variables: {'{prefix}'}, {'{start}'}, {'{end}'}, {'{num}'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Step 3: Preview Lots</h3>
              <p className="text-sm text-gray-600">
                Review the lots that will be created. Go back to make changes if needed.
              </p>
              <div className="border rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Lot Number
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Chainage
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Activity
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Layer
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lotsPreview.slice(0, 10).map((lot, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {lot.lotNumber}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {lot.chainageStart} - {lot.chainageEnd}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{lot.activityType}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{lot.layer || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lotsPreview.length > 10 && (
                  <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500">
                    ... and {lotsPreview.length - 10} more lots
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-gray-700">
                Total: {lotsPreview.length} lots will be created
              </p>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Step 4: Confirm Creation</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                  You are about to create <span className="font-bold">{lotsPreview.length} lots</span>.
                </p>
                <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
                  <li>Chainage range: {chainageStart}m - {chainageEnd}m</li>
                  <li>Lot interval: {lotInterval}m</li>
                  <li>Activity type: {activityType}</li>
                  {layer && <li>Layer: {layer}</li>}
                </ul>
              </div>
              <p className="text-sm text-gray-600">
                Click "Create Lots" to proceed. This action cannot be undone easily.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => {
              if (step === 'chainage') {
                onClose()
              } else if (step === 'parameters') {
                setStep('chainage')
              } else if (step === 'preview') {
                setStep('parameters')
              } else if (step === 'confirm') {
                setStep('preview')
              }
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {step === 'chainage' ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={() => {
              if (step === 'chainage') {
                setStep('parameters')
              } else if (step === 'parameters') {
                generatePreview()
              } else if (step === 'preview') {
                setStep('confirm')
              } else if (step === 'confirm') {
                createLots()
              }
            }}
            disabled={
              (step === 'chainage' && !canProceedFromChainage) ||
              (step === 'parameters' && !canProceedFromParameters) ||
              creating
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'confirm'
              ? creating
                ? 'Creating...'
                : 'Create Lots'
              : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
