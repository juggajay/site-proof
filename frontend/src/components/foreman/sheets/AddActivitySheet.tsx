import { useState } from 'react'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'

interface AddActivitySheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    description: string
    lotId?: string
    quantity?: number
    unit?: string
    notes?: string
  }) => Promise<void>
  defaultLotId: string | null
  lots: Array<{ id: string; lotNumber: string }>
  suggestions?: string[]
}

export function AddActivitySheet({
  isOpen, onClose, onSave, defaultLotId, lots, suggestions = []
}: AddActivitySheetProps) {
  const [description, setDescription] = useState('')
  const [lotId, setLotId] = useState(defaultLotId || '')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const { trigger } = useHaptics()

  const handleSave = async () => {
    if (!description.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        description: description.trim(),
        lotId: lotId || undefined,
        quantity: quantity ? parseFloat(quantity) : undefined,
        unit: unit || undefined,
        notes: notes || undefined,
      })
      trigger('success')
      // Reset form
      setDescription('')
      setQuantity('')
      setUnit('')
      setNotes('')
      setShowMore(false)
      onClose()
    } catch {
      trigger('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Activity">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Description *</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What work was done?"
            className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
            autoFocus
          />
        </div>

        {suggestions.length > 0 && !description && (
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((s, i) => (
              <button
                key={i}
                onClick={() => setDescription(s)}
                className="px-3 py-1.5 bg-muted rounded-full text-sm touch-manipulation"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-1 text-sm text-primary touch-manipulation"
        >
          {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showMore ? 'Less details' : 'More details'}
        </button>

        {showMore && (
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="m3, tonnes..."
                  className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation resize-none"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!description.trim() || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-white',
            'bg-green-600 active:bg-green-700',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (!description.trim() || saving) && 'opacity-50'
          )}
        >
          {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : 'Save Activity'}
        </button>
      </div>
    </BottomSheet>
  )
}
