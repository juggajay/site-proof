import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const witnessPointSchema = z.object({
  witnessPresent: z.boolean().nullable(),
  witnessName: z.string(),
  witnessCompany: z.string(),
}).superRefine((data, ctx) => {
  if (data.witnessPresent === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please indicate if witness was present',
      path: ['witnessPresent'],
    })
  }
  if (data.witnessPresent === true && !data.witnessName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Witness name is required when present',
      path: ['witnessName'],
    })
  }
})

type WitnessPointFormData = z.infer<typeof witnessPointSchema>

interface WitnessPointModalProps {
  isOpen: boolean
  itemDescription: string
  onClose: () => void
  onSubmit: (witnessPresent: boolean, witnessName?: string, witnessCompany?: string) => Promise<void>
  isSubmitting: boolean
}

export function WitnessPointModal({
  isOpen,
  itemDescription,
  onClose,
  onSubmit,
  isSubmitting
}: WitnessPointModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WitnessPointFormData>({
    resolver: zodResolver(witnessPointSchema),
    mode: 'onBlur',
    defaultValues: {
      witnessPresent: null,
      witnessName: '',
      witnessCompany: '',
    },
  })

  useEffect(() => { if (isOpen) reset() }, [isOpen, reset])

  const witnessPresent = watch('witnessPresent')

  const onFormSubmit = (data: WitnessPointFormData) => {
    onSubmit(
      data.witnessPresent!,
      data.witnessPresent ? data.witnessName.trim() : undefined,
      data.witnessPresent ? data.witnessCompany.trim() : undefined
    )
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose}>
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400">
            <span className="text-xl font-bold">W</span>
          </div>
          <div>
            <div className="text-lg font-semibold">Complete Witness Point</div>
            <p className="text-sm text-muted-foreground font-normal">Record witness attendance</p>
          </div>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium">{itemDescription}</p>
        </div>

        <form id="witness-point-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4">
            <div>
              <Label>
                Was the client witness present? <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setValue('witnessPresent', true, { shouldValidate: true })}
                  className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                    witnessPresent === true
                      ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400'
                      : 'hover:bg-muted'
                  }`}
                >
                  Yes, witness was present
                </button>
                <button
                  type="button"
                  onClick={() => setValue('witnessPresent', false, { shouldValidate: true })}
                  className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                    witnessPresent === false
                      ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:border-orange-600 dark:text-orange-400'
                      : 'hover:bg-muted'
                  }`}
                >
                  No, notification given
                </button>
              </div>
              {errors.witnessPresent && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.witnessPresent.message}</p>
              )}
            </div>

            {witnessPresent === true && (
              <>
                <div>
                  <Label>
                    Witness Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    {...register('witnessName')}
                    placeholder="Enter witness name..."
                    className={errors.witnessName ? 'border-destructive mt-1' : 'mt-1'}
                    autoFocus
                  />
                  {errors.witnessName && (
                    <p className="text-sm text-destructive mt-1" role="alert">{errors.witnessName.message}</p>
                  )}
                </div>

                <div>
                  <Label>Witness Company/Organisation</Label>
                  <Input
                    type="text"
                    {...register('witnessCompany')}
                    placeholder="e.g., Client Name, Superintendent Firm..."
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {witnessPresent === false && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  <strong>Note:</strong> The item will be marked as complete with a record that notification was given but the witness was not present.
                </p>
              </div>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="witness-point-form"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Complete Witness Point'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
