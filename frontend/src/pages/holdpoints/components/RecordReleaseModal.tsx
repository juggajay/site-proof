import { useState } from 'react'
import { X, Check, AlertTriangle } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { SignaturePad } from '@/components/ui/SignaturePad'
import type { HoldPoint } from '../types'

interface RecordReleaseModalProps {
  holdPoint: HoldPoint
  recording: boolean
  approvalRequirement?: 'any' | 'superintendent'
  onClose: () => void
  onSubmit: (
    releasedByName: string,
    releasedByOrg: string,
    releaseDate: string,
    releaseTime: string,
    releaseNotes: string,
    releaseMethod: string,
    signatureDataUrl: string | null
  ) => void
}

export function RecordReleaseModal({
  holdPoint,
  recording,
  approvalRequirement,
  onClose,
  onSubmit,
}: RecordReleaseModalProps) {
  const [releasedByName, setReleasedByName] = useState('')
  const [releasedByOrg, setReleasedByOrg] = useState('')
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0])
  const [releaseTime, setReleaseTime] = useState(
    new Date().toTimeString().slice(0, 5)
  )
  const [releaseNotes, setReleaseNotes] = useState('')
  const [releaseMethod, setReleaseMethod] = useState<'digital' | 'email' | 'paper'>('digital')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  // Feature #884: Signature capture state
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEvidenceFile(e.target.files[0])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!releasedByName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter the name of the person releasing the hold point',
        variant: 'error',
      })
      return
    }
    // Feature #884: Require signature for digital release
    if (releaseMethod === 'digital' && !signatureDataUrl) {
      toast({
        title: 'Signature required',
        description: 'Please provide your signature to release the hold point',
        variant: 'error',
      })
      return
    }
    // Note: File upload would be handled separately in a production system
    // For now, we'll include the filename in the notes if a file was selected
    let notes = releaseNotes
    if ((releaseMethod === 'email' || releaseMethod === 'paper') && evidenceFile) {
      notes = `${releaseNotes}\n[Evidence attached: ${evidenceFile.name}]`.trim()
    }
    onSubmit(releasedByName, releasedByOrg, releaseDate, releaseTime, notes, releaseMethod, signatureDataUrl)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Record Hold Point Release</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
            disabled={recording}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Lot</div>
          <div className="font-medium">{holdPoint.lotNumber}</div>
          <div className="text-sm text-muted-foreground mt-2">Hold Point</div>
          <div className="font-medium">{holdPoint.description}</div>
        </div>

        {/* Feature #698 - Superintendent approval requirement notice */}
        {approvalRequirement === 'superintendent' && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Superintendent Approval Required</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              This project requires superintendent-level authorization to release hold points.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Release Method Selection (Feature #185) */}
          <div>
            <label className="block text-sm font-medium mb-2">Release Method</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="releaseMethod"
                  value="digital"
                  checked={releaseMethod === 'digital'}
                  onChange={() => setReleaseMethod('digital')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Digital (On-site)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="releaseMethod"
                  value="email"
                  checked={releaseMethod === 'email'}
                  onChange={() => setReleaseMethod('email')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Email Confirmation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="releaseMethod"
                  value="paper"
                  checked={releaseMethod === 'paper'}
                  onChange={() => setReleaseMethod('paper')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Paper Form</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Releaser Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={releasedByName}
              onChange={(e) => setReleasedByName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter name of person releasing"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Organization
            </label>
            <input
              type="text"
              value={releasedByOrg}
              onChange={(e) => setReleasedByOrg(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter organization (e.g., Superintendent's Rep)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Release Date</label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Release Time</label>
              <input
                type="time"
                value={releaseTime}
                onChange={(e) => setReleaseTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Any additional notes about the release..."
            />
          </div>

          {/* Signature or Evidence based on method */}
          {releaseMethod === 'digital' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Digital Signature <span className="text-red-500">*</span></label>
              <SignaturePad
                onChange={setSignatureDataUrl}
                width={380}
                height={150}
                className="mx-auto"
              />
              <p className="text-xs text-muted-foreground">
                Draw your signature above to authorize this release
              </p>
            </div>
          ) : releaseMethod === 'email' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Email Evidence</label>
              <div className="p-4 border border-dashed rounded-lg bg-blue-50/50">
                <input
                  type="file"
                  accept=".pdf,.eml,.msg,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="w-full text-sm"
                  id="evidence-upload"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Upload email or screenshot as evidence (PDF, EML, MSG, PNG, JPG)
                </p>
                {evidenceFile && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <span>Selected: {evidenceFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Paper Form Evidence</label>
              <div className="p-4 border border-dashed rounded-lg bg-amber-50/50">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="w-full text-sm"
                  id="paper-evidence-upload"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Upload photo or scan of signed release form (PDF, PNG, JPG)
                </p>
                {evidenceFile && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <span>Selected: {evidenceFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-muted"
              disabled={recording}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={recording || !releasedByName.trim()}
            >
              {recording ? 'Recording...' : 'Record Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
