import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, AlertTriangle } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { SignaturePad } from '@/components/ui/SignaturePad'
import type { HoldPoint } from '../types'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const recordReleaseSchema = z.object({
  releasedByName: z.string().min(1, 'Name of person releasing is required'),
  releasedByOrg: z.string().optional().default(''),
  releaseDate: z.string().min(1, 'Release date is required'),
  releaseTime: z.string().min(1, 'Release time is required'),
  releaseNotes: z.string().optional().default(''),
  releaseMethod: z.enum(['digital', 'email', 'paper']),
})

type RecordReleaseFormData = z.infer<typeof recordReleaseSchema>

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
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  // Feature #884: Signature capture state
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    formState: { errors },
  } = useForm<RecordReleaseFormData>({
    resolver: zodResolver(recordReleaseSchema),
    mode: 'onBlur',
    defaultValues: {
      releasedByName: '',
      releasedByOrg: '',
      releaseDate: new Date().toISOString().split('T')[0],
      releaseTime: new Date().toTimeString().slice(0, 5),
      releaseNotes: '',
      releaseMethod: 'digital',
    },
  })

  const releaseMethod = watch('releaseMethod')
  const releasedByName = watch('releasedByName')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEvidenceFile(e.target.files[0])
    }
  }

  const onFormSubmit = (data: RecordReleaseFormData) => {
    // Feature #884: Require signature for digital release
    if (data.releaseMethod === 'digital' && !signatureDataUrl) {
      toast({
        title: 'Signature required',
        description: 'Please provide your signature to release the hold point',
        variant: 'error',
      })
      return
    }
    // Note: File upload would be handled separately in a production system
    // For now, we'll include the filename in the notes if a file was selected
    let notes = data.releaseNotes || ''
    if ((data.releaseMethod === 'email' || data.releaseMethod === 'paper') && evidenceFile) {
      notes = `${notes}\n[Evidence attached: ${evidenceFile.name}]`.trim()
    }
    onSubmit(data.releasedByName, data.releasedByOrg || '', data.releaseDate, data.releaseTime, notes, data.releaseMethod, signatureDataUrl)
  }

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <ModalHeader>Record Hold Point Release</ModalHeader>
      <ModalBody>
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

        <form id="record-release-form" onSubmit={rhfHandleSubmit(onFormSubmit)} className="space-y-4">
          {/* Release Method Selection (Feature #185) */}
          <div>
            <Label>Release Method</Label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="digital"
                  {...register('releaseMethod')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Digital (On-site)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="email"
                  {...register('releaseMethod')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Email Confirmation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="paper"
                  {...register('releaseMethod')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Paper Form</span>
              </label>
            </div>
          </div>

          <div>
            <Label>
              Releaser Name <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              {...register('releasedByName')}
              className={errors.releasedByName ? 'border-destructive' : ''}
              placeholder="Enter name of person releasing"
            />
            {errors.releasedByName && (
              <p className="mt-1 text-sm text-destructive" role="alert">{errors.releasedByName.message}</p>
            )}
          </div>

          <div>
            <Label>Organization</Label>
            <Input
              type="text"
              {...register('releasedByOrg')}
              placeholder="Enter organization (e.g., Superintendent's Rep)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Release Date</Label>
              <Input
                type="date"
                {...register('releaseDate')}
                className={errors.releaseDate ? 'border-destructive' : ''}
              />
              {errors.releaseDate && (
                <p className="mt-1 text-sm text-destructive" role="alert">{errors.releaseDate.message}</p>
              )}
            </div>
            <div>
              <Label>Release Time</Label>
              <Input
                type="time"
                {...register('releaseTime')}
                className={errors.releaseTime ? 'border-destructive' : ''}
              />
              {errors.releaseTime && (
                <p className="mt-1 text-sm text-destructive" role="alert">{errors.releaseTime.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              {...register('releaseNotes')}
              rows={3}
              placeholder="Any additional notes about the release..."
            />
          </div>

          {/* Signature or Evidence based on method */}
          {releaseMethod === 'digital' ? (
            <div className="space-y-2">
              <Label>Digital Signature <span className="text-red-500">*</span></Label>
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
              <Label>Email Evidence</Label>
              <div className="p-4 border border-dashed rounded-lg bg-primary/5">
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
              <Label>Paper Form Evidence</Label>
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
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={recording}
        >
          Cancel
        </Button>
        <Button
          variant="success"
          type="submit"
          form="record-release-form"
          disabled={recording || !releasedByName?.trim()}
        >
          {recording ? 'Recording...' : 'Record Release'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
