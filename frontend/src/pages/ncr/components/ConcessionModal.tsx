import { memo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { NCR } from '../types'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const concessionSchema = z.object({
  justification: z.string().min(1, 'Concession justification is required'),
  riskAssessment: z.string().min(1, 'Risk assessment is required'),
  verificationNotes: z.string().optional().default(''),
  clientApprovalConfirmed: z.boolean().default(false),
  clientApprovalReference: z.string().optional().default(''),
})

type ConcessionFormData = z.infer<typeof concessionSchema>

interface ConcessionModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSubmit: (ncrId: string, data: {
    concessionJustification: string
    concessionRiskAssessment: string
    clientApprovalDocId?: string
    verificationNotes?: string
  }) => void
  loading: boolean
}

function ConcessionModalInner({
  isOpen,
  ncr,
  onClose,
  onSubmit,
  loading,
}: ConcessionModalProps) {
  const isMajor = ncr?.severity === 'major'
  const requiresClientApproval = isMajor

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ConcessionFormData>({
    resolver: zodResolver(concessionSchema),
    mode: 'onBlur',
    defaultValues: {
      justification: '',
      riskAssessment: '',
      verificationNotes: '',
      clientApprovalConfirmed: false,
      clientApprovalReference: '',
    },
  })

  const clientApprovalConfirmed = watch('clientApprovalConfirmed')
  const justification = watch('justification')
  const riskAssessment = watch('riskAssessment')

  const onFormSubmit = (data: ConcessionFormData) => {
    if (!ncr) return
    if (requiresClientApproval && !data.clientApprovalConfirmed) {
      return
    }
    onSubmit(ncr.id, {
      concessionJustification: data.justification,
      concessionRiskAssessment: data.riskAssessment,
      verificationNotes: data.verificationNotes || undefined,
      clientApprovalDocId: data.clientApprovalReference || undefined,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const isFormValid = justification && riskAssessment && (!requiresClientApproval || clientApprovalConfirmed)

  if (!isOpen || !ncr) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Close NCR with Concession</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          Use this when full rectification is not possible and a concession is required.
        </p>

        {/* NCR Info */}
        <div className="mb-4 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
          <div className="font-medium">{ncr.ncrNumber}</div>
          <div className="text-muted-foreground">{ncr.description}</div>
          <div className="mt-1">
            <span className={`px-2 py-0.5 rounded text-xs ${
              ncr.severity === 'major' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {ncr.severity.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Warning for Major NCRs */}
        {isMajor && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <strong>Major NCR - Client Approval Required</strong>
              <p className="mt-1">Closing a major NCR with concession requires documented client approval.</p>
            </div>
          </div>
        )}

        <form id="concession-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {/* Justification */}
          <div>
            <Label>Concession Justification *</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Explain why full rectification is not possible
            </p>
            <Textarea
              {...register('justification')}
              className={errors.justification ? 'border-destructive' : ''}
              rows={3}
              placeholder="Describe why the non-conformance cannot be fully rectified..."
            />
            {errors.justification && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.justification.message}</p>
            )}
          </div>

          {/* Risk Assessment */}
          <div>
            <Label>Risk Assessment *</Label>
            <p className="text-xs text-muted-foreground mb-1">
              Assess the risk of accepting this concession
            </p>
            <Textarea
              {...register('riskAssessment')}
              className={errors.riskAssessment ? 'border-destructive' : ''}
              rows={3}
              placeholder="Describe the risk implications, mitigation measures, and impact on quality/safety..."
            />
            {errors.riskAssessment && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.riskAssessment.message}</p>
            )}
          </div>

          {/* Client Approval Section for Major NCRs */}
          {requiresClientApproval && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <Label className="text-amber-900">Client Approval *</Label>

              <div className="space-y-3 mt-2">
                {/* Approval Reference/Document ID */}
                <div>
                  <label className="block text-xs text-amber-800 mb-1">
                    Approval Document Reference
                  </label>
                  <Input
                    type="text"
                    {...register('clientApprovalReference')}
                    className="border-amber-300 bg-white"
                    placeholder="e.g., Email ref, Letter ID, Document number..."
                  />
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('clientApprovalConfirmed')}
                    className="mt-1 rounded border-amber-400"
                  />
                  <span className="text-sm text-amber-900">
                    I confirm that the client has been notified of this concession and has provided documented approval to proceed.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Verification Notes (Optional) */}
          <div>
            <Label>Verification Notes</Label>
            <Textarea
              {...register('verificationNotes')}
              className={errors.verificationNotes ? 'border-destructive mt-1' : 'mt-1'}
              rows={2}
              placeholder="Any additional verification notes..."
            />
          </div>

          {/* Status Info */}
          <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm">
            <span className="text-muted-foreground">NCR will be closed with status: </span>
            <span className="font-medium text-green-700">CLOSED_CONCESSION</span>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="concession-form"
          disabled={loading || !isFormValid}
        >
          {loading ? 'Closing...' : 'Close with Concession'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export const ConcessionModal = memo(ConcessionModalInner)
