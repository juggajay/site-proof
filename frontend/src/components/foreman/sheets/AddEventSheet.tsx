import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'

const EVENT_TYPES = ['Visitor', 'Safety', 'Instruction', 'Variation', 'Other']

interface AddEventSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    eventType: string
    description: string
    notes?: string
    lotId?: string
  }) => Promise<void>
  defaultLotId: string | null
  lots: Array<{ id: string; lotNumber: string }>
  initialData?: { eventType?: string; description?: string; notes?: string; lotId?: string }
}

export function AddEventSheet({ isOpen, onClose, onSave, defaultLotId, lots, initialData }: AddEventSheetProps) {
  const [eventType, setEventType] = useState(initialData?.eventType || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [lotId, setLotId] = useState(initialData?.lotId || defaultLotId || '')
  const [saving, setSaving] = useState(false)
  const { trigger } = useHaptics()

  const handleSave = async () => {
    if (!eventType || !description.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        eventType: eventType.toLowerCase(),
        description: description.trim(),
        notes: notes || undefined,
        lotId: lotId || undefined,
      })
      trigger('success')
      setEventType('')
      setDescription('')
      setNotes('')
      onClose()
    } catch {
      trigger('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Event">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Event Type *</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {EVENT_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setEventType(type)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[40px]',
                  eventType === type
                    ? 'bg-purple-600 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Description *</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened?"
            className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Additional details..."
            className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Lot</label>
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation bg-background"
          >
            <option value="">No lot</option>
            {lots.map(lot => (
              <option key={lot.id} value={lot.id}>Lot {lot.lotNumber}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={!eventType || !description.trim() || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-white',
            'bg-green-600 active:bg-green-700',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (!eventType || !description.trim() || saving) && 'opacity-50'
          )}
        >
          {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : 'Save Event'}
        </button>
      </div>
    </BottomSheet>
  )
}
