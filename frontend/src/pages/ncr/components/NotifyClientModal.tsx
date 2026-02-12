import { useState, memo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { handleApiError } from '@/lib/errorHandling'
import type { NCR } from '../types'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const notifyClientSchema = z.object({
  recipientEmail: z.string().optional().default(''),
  additionalMessage: z.string().optional().default(''),
})

type NotifyClientFormData = z.infer<typeof notifyClientSchema>

interface NotifyClientModalProps {
  isOpen: boolean
  ncr: NCR | null
  onClose: () => void
  onSuccess: () => void
}

function NotifyClientModalInner({
  isOpen,
  ncr,
  onClose,
  onSuccess,
}: NotifyClientModalProps) {
  const [notifyingClient, setNotifyingClient] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NotifyClientFormData>({
    resolver: zodResolver(notifyClientSchema),
    mode: 'onBlur',
    defaultValues: {
      recipientEmail: '',
      additionalMessage: '',
    },
  })

  const onFormSubmit = async (data: NotifyClientFormData) => {
    if (!ncr) return

    setNotifyingClient(true)
    try {
      await apiFetch(`/api/ncrs/${ncr.id}/notify-client`, {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: data.recipientEmail || undefined,
          additionalMessage: data.additionalMessage || undefined,
        }),
      })

      toast({
        title: 'Client Notified',
        description: `Client notification sent for ${ncr.ncrNumber}`,
      })
      handleClose()
      onSuccess()
    } catch (err) {
      handleApiError(err, 'Failed to notify client')
    } finally {
      setNotifyingClient(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen || !ncr) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Notify Client - Major NCR</ModalHeader>
      <ModalBody>
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Major NCR: {ncr.ncrNumber}</p>
          <p className="text-sm text-red-700 mt-1">{ncr.description.substring(0, 100)}{ncr.description.length > 100 ? '...' : ''}</p>
          <p className="text-xs text-red-600 mt-2">
            Affected Lots: {ncr.ncrLots.map(nl => nl.lot.lotNumber).join(', ') || 'None'}
          </p>
        </div>

        <form id="notify-client-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4">
            <div>
              <Label>Client Email (optional)</Label>
              <Input
                type="email"
                {...register('recipientEmail')}
                placeholder="Enter client email address"
                className={errors.recipientEmail ? 'border-destructive mt-1' : 'mt-1'}
              />
              {errors.recipientEmail && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.recipientEmail.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Leave blank to record notification without sending email</p>
            </div>

            <div>
              <Label>Additional Message (optional)</Label>
              <Textarea
                {...register('additionalMessage')}
                placeholder="Add any additional context for the client..."
                rows={3}
                className={errors.additionalMessage ? 'border-destructive mt-1' : 'mt-1'}
              />
              {errors.additionalMessage && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.additionalMessage.message}</p>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-800 font-medium">Notification Package will include:</p>
            <ul className="text-xs text-blue-700 mt-1 list-disc list-inside">
              <li>NCR Number and Description</li>
              <li>Category and Severity</li>
              <li>Affected Lots</li>
              <li>Specification Reference</li>
              <li>Raised By and Date</li>
            </ul>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={notifyingClient}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="notify-client-form"
          disabled={notifyingClient}
        >
          {notifyingClient ? 'Sending...' : 'Send Notification'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export const NotifyClientModal = memo(NotifyClientModalInner)
