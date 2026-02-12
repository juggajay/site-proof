import React, { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { FailedTestForNcr, NcrFormData } from '../types'
import { INITIAL_NCR_FORM_DATA } from '../constants'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'

// Feature #210: NCR Prompt Modal for Failed Test
interface NcrPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onRaiseNcr: () => void
  failedTestForNcr: FailedTestForNcr | null
}

export const NcrPromptModal = React.memo(function NcrPromptModal({
  isOpen,
  onClose,
  onRaiseNcr,
  failedTestForNcr,
}: NcrPromptModalProps) {
  if (!isOpen) return null

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>
        <span className="text-red-600">Test Failed</span>
      </ModalHeader>
      <ModalBody>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {failedTestForNcr?.testType} result: {failedTestForNcr?.resultValue}
            </p>
          </div>
        </div>
        <p className="text-sm mb-4">
          This test result has failed. Would you like to raise a Non-Conformance Report (NCR) to document and track this issue?
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          No, Skip NCR
        </Button>
        <Button variant="destructive" onClick={onRaiseNcr}>
          Yes, Raise NCR
        </Button>
      </ModalFooter>
    </Modal>
  )
})

// Feature #210: NCR Creation Modal
const ncrCreateSchema = z.object({
  description: z.string().min(1, 'NCR description is required'),
  category: z.string().min(1, 'Category is required'),
  severity: z.string().min(1, 'Severity is required'),
  specificationReference: z.string(),
})

type NcrCreateFormData = z.infer<typeof ncrCreateSchema>

interface NcrCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (ncrFormData: NcrFormData) => Promise<void>
  failedTestForNcr: FailedTestForNcr | null
  initialDescription: string
}

export const NcrCreateModal = React.memo(function NcrCreateModal({
  isOpen,
  onClose,
  onSubmit,
  failedTestForNcr,
  initialDescription,
}: NcrCreateModalProps) {
  const [creatingNcr, setCreatingNcr] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<NcrCreateFormData>({
    resolver: zodResolver(ncrCreateSchema),
    mode: 'onBlur',
    defaultValues: {
      description: initialDescription,
      category: INITIAL_NCR_FORM_DATA.category,
      severity: INITIAL_NCR_FORM_DATA.severity,
      specificationReference: INITIAL_NCR_FORM_DATA.specificationReference,
    },
  })

  const severity = watch('severity')

  // Sync the initial description when it changes (new failed test)
  useEffect(() => {
    reset({
      description: initialDescription,
      category: INITIAL_NCR_FORM_DATA.category,
      severity: INITIAL_NCR_FORM_DATA.severity,
      specificationReference: INITIAL_NCR_FORM_DATA.specificationReference,
    })
  }, [initialDescription, reset])

  const handleClose = useCallback(() => {
    reset({
      description: '',
      category: INITIAL_NCR_FORM_DATA.category,
      severity: INITIAL_NCR_FORM_DATA.severity,
      specificationReference: INITIAL_NCR_FORM_DATA.specificationReference,
    })
    onClose()
  }, [onClose, reset])

  const onFormSubmit = useCallback(async (data: NcrCreateFormData) => {
    setCreatingNcr(true)

    try {
      await onSubmit(data as NcrFormData)
      reset({
        description: '',
        category: INITIAL_NCR_FORM_DATA.category,
        severity: INITIAL_NCR_FORM_DATA.severity,
        specificationReference: INITIAL_NCR_FORM_DATA.specificationReference,
      })
    } catch {
      // Error handled by parent
    } finally {
      setCreatingNcr(false)
    }
  }, [onSubmit, reset])

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Raise NCR from Test Failure</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          Create a Non-Conformance Report for the failed test result.
        </p>

        <form id="ncr-create-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4">
            <div>
              <Label>Description *</Label>
              <Textarea
                {...register('description')}
                placeholder="Describe the non-conformance..."
                rows={4}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.description.message}</p>
              )}
            </div>

            <div>
              <Label>Category *</Label>
              <NativeSelect {...register('category')}>
                <option value="materials">Materials</option>
                <option value="workmanship">Workmanship</option>
                <option value="documentation">Documentation</option>
                <option value="process">Process</option>
                <option value="design">Design</option>
                <option value="other">Other</option>
              </NativeSelect>
            </div>

            <div>
              <Label>Severity *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="minor"
                    {...register('severity')}
                  />
                  <span>Minor</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="major"
                    {...register('severity')}
                  />
                  <span className="text-red-600 font-medium">Major</span>
                </label>
              </div>
              {severity === 'major' && (
                <p className="text-amber-600 text-xs mt-1">
                  Major NCRs require Quality Manager approval before closure.
                </p>
              )}
            </div>

            <div>
              <Label>Specification Reference</Label>
              <Input
                type="text"
                {...register('specificationReference')}
                placeholder="e.g., MRTS05, AS 1289"
              />
            </div>

            {failedTestForNcr?.lotId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Linked Lot:</span> This NCR will be automatically linked to the lot associated with this test result.
                </p>
              </div>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={creatingNcr}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          type="submit"
          form="ncr-create-form"
          disabled={creatingNcr}
        >
          {creatingNcr ? 'Creating NCR...' : 'Raise NCR'}
        </Button>
      </ModalFooter>
    </Modal>
  )
})
