import { useState } from 'react'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'

const DELAY_TYPES = ['Weather', 'Equipment', 'Material', 'Subcontractor', 'Safety', 'Other']

interface AddDelaySheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    delayType: string
    description: string
    durationHours?: number
    impact?: string
    lotId?: string
  }) => Promise<void>
  defaultLotId: string | null
  lots: Array<{ id: string; lotNumber: string }>
}

export function AddDelaySheet({ isOpen, onClose, onSave, defaultLotId, lots }: AddDelaySheetProps) {
  const [delayType, setDelayType] = useState('')
  const [description, setDescription] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [impact, setImpact] = useState('')
  const [lotId, setLotId] = useState(defaultLotId || '')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const { trigger } = useHaptics()

  const handleSave = async () => {
    if (!delayType || !description.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        delayType,
        description: description.trim(),
        durationHours: durationHours ? parseFloat(durationHours) : undefined,
        impact: impact || undefined,
        lotId: lotId || undefined,
      })
      trigger('success')
      setDelayType('')
      setDescription('')
      setDurationHours('')
      setImpact('')
      setShowMore(false)
      onClose()
    } catch {
      trigger('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Delay">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Delay Type *</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DELAY_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setDelayType(type)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[40px]',
                  delayType === type
                    ? 'bg-red-600 text-white'
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
            placeholder="What caused the delay?"
            className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
          />
        </div>

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
              <label className="text-sm font-medium text-muted-foreground">Duration (hours)</label>
              <input
                type="number"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="0"
                step="0.5"
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Impact</label>
              <input
                type="text"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="Impact on schedule..."
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
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
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!delayType || !description.trim() || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-white',
            'bg-green-600 active:bg-green-700',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (!delayType || !description.trim() || saving) && 'opacity-50'
          )}
        >
          {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : 'Save Delay'}
        </button>
      </div>
    </BottomSheet>
  )
}
