import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'

const CONDITIONS = ['Fine', 'Partly Cloudy', 'Cloudy', 'Overcast', 'Rain', 'Heavy Rain', 'Storm', 'Windy', 'Fog']

interface WeatherData {
  conditions: string
  temperatureMin: string
  temperatureMax: string
  rainfallMm: string
}

interface AddWeatherSheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: WeatherData) => Promise<void>
  initialData: WeatherData | null
}

export function AddWeatherSheet({ isOpen, onClose, onSave, initialData }: AddWeatherSheetProps) {
  const [conditions, setConditions] = useState(initialData?.conditions || '')
  const [temperatureMin, setTemperatureMin] = useState(initialData?.temperatureMin || '')
  const [temperatureMax, setTemperatureMax] = useState(initialData?.temperatureMax || '')
  const [rainfallMm, setRainfallMm] = useState(initialData?.rainfallMm || '')
  const [saving, setSaving] = useState(false)
  const { trigger } = useHaptics()

  useEffect(() => {
    if (initialData) {
      setConditions(initialData.conditions || '')
      setTemperatureMin(initialData.temperatureMin || '')
      setTemperatureMax(initialData.temperatureMax || '')
      setRainfallMm(initialData.rainfallMm || '')
    }
  }, [initialData])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave({ conditions, temperatureMin, temperatureMax, rainfallMm })
      trigger('success')
      onClose()
    } catch {
      trigger('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Weather">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Conditions</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CONDITIONS.map(c => (
              <button
                key={c}
                onClick={() => setConditions(c)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[40px]',
                  conditions === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Min Temp (°C)</label>
            <input
              type="number"
              value={temperatureMin}
              onChange={(e) => setTemperatureMin(e.target.value)}
              placeholder="e.g. 12"
              className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Max Temp (°C)</label>
            <input
              type="number"
              value={temperatureMax}
              onChange={(e) => setTemperatureMax(e.target.value)}
              placeholder="e.g. 28"
              className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Rainfall (mm)</label>
          <input
            type="number"
            value={rainfallMm}
            onChange={(e) => setRainfallMm(e.target.value)}
            placeholder="0"
            step="0.1"
            className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-white',
            'bg-green-600 active:bg-green-700',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            saving && 'opacity-50'
          )}
        >
          {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : 'Save Weather'}
        </button>
      </div>
    </BottomSheet>
  )
}
