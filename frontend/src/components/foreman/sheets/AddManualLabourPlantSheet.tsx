import { useState } from 'react'
import { Loader2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'

interface AddManualLabourPlantSheetProps {
  isOpen: boolean
  onClose: () => void
  onSavePersonnel: (data: {
    name: string
    company?: string
    role?: string
    hours?: number
    lotId?: string
  }) => Promise<void>
  onSavePlant: (data: {
    description: string
    idRego?: string
    company?: string
    hoursOperated?: number
    lotId?: string
  }) => Promise<void>
  defaultLotId: string | null
  lots: Array<{ id: string; lotNumber: string }>
}

export function AddManualLabourPlantSheet({
  isOpen, onClose, onSavePersonnel, onSavePlant, defaultLotId, lots
}: AddManualLabourPlantSheetProps) {
  // Personnel fields
  const [personnelName, setPersonnelName] = useState('')
  const [personnelCompany, setPersonnelCompany] = useState('')
  const [personnelRole, setPersonnelRole] = useState('')
  const [personnelHours, setPersonnelHours] = useState('')
  const [personnelLotId, setPersonnelLotId] = useState(defaultLotId || '')
  const [savingPersonnel, setSavingPersonnel] = useState(false)

  // Plant fields
  const [plantDescription, setPlantDescription] = useState('')
  const [plantIdRego, setPlantIdRego] = useState('')
  const [plantCompany, setPlantCompany] = useState('')
  const [plantHours, setPlantHours] = useState('')
  const [plantLotId, setPlantLotId] = useState(defaultLotId || '')
  const [savingPlant, setSavingPlant] = useState(false)

  const { trigger } = useHaptics()

  const handleSavePersonnel = async () => {
    if (!personnelName.trim() || savingPersonnel) return
    setSavingPersonnel(true)
    try {
      await onSavePersonnel({
        name: personnelName.trim(),
        company: personnelCompany || undefined,
        role: personnelRole || undefined,
        hours: personnelHours ? parseFloat(personnelHours) : undefined,
        lotId: personnelLotId || undefined,
      })
      trigger('success')
      setPersonnelName('')
      setPersonnelCompany('')
      setPersonnelRole('')
      setPersonnelHours('')
    } catch {
      trigger('error')
    } finally {
      setSavingPersonnel(false)
    }
  }

  const handleSavePlant = async () => {
    if (!plantDescription.trim() || savingPlant) return
    setSavingPlant(true)
    try {
      await onSavePlant({
        description: plantDescription.trim(),
        idRego: plantIdRego || undefined,
        company: plantCompany || undefined,
        hoursOperated: plantHours ? parseFloat(plantHours) : undefined,
        lotId: plantLotId || undefined,
      })
      trigger('success')
      setPlantDescription('')
      setPlantIdRego('')
      setPlantCompany('')
      setPlantHours('')
    } catch {
      trigger('error')
    } finally {
      setSavingPlant(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Labour / Plant">
      <div className="space-y-6">
        {/* Tip banner */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Tip: Labour and plant auto-populate from approved dockets.
          </p>
        </div>

        {/* Personnel section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Personnel</h3>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name *</label>
            <input
              type="text"
              value={personnelName}
              onChange={(e) => setPersonnelName(e.target.value)}
              placeholder="Worker name"
              className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Company</label>
              <input
                type="text"
                value={personnelCompany}
                onChange={(e) => setPersonnelCompany(e.target.value)}
                placeholder="Company"
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <input
                type="text"
                value={personnelRole}
                onChange={(e) => setPersonnelRole(e.target.value)}
                placeholder="Role"
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Hours</label>
              <input
                type="number"
                value={personnelHours}
                onChange={(e) => setPersonnelHours(e.target.value)}
                placeholder="0"
                step="0.5"
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Lot</label>
              <select
                value={personnelLotId}
                onChange={(e) => setPersonnelLotId(e.target.value)}
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation bg-background"
              >
                <option value="">No lot</option>
                {lots.map(lot => (
                  <option key={lot.id} value={lot.id}>Lot {lot.lotNumber}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSavePersonnel}
            disabled={!personnelName.trim() || savingPersonnel}
            className={cn(
              'w-full py-3 rounded-lg font-semibold text-white',
              'bg-emerald-600 active:bg-emerald-700',
              'touch-manipulation min-h-[48px]',
              'flex items-center justify-center gap-2',
              (!personnelName.trim() || savingPersonnel) && 'opacity-50'
            )}
          >
            {savingPersonnel ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : 'Save Personnel'}
          </button>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Plant section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Plant / Equipment</h3>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Description *</label>
            <input
              type="text"
              value={plantDescription}
              onChange={(e) => setPlantDescription(e.target.value)}
              placeholder="Plant / equipment description"
              className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">ID / Rego</label>
              <input
                type="text"
                value={plantIdRego}
                onChange={(e) => setPlantIdRego(e.target.value)}
                placeholder="ID or rego"
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Company</label>
              <input
                type="text"
                value={plantCompany}
                onChange={(e) => setPlantCompany(e.target.value)}
                placeholder="Company"
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Hours Operated</label>
              <input
                type="number"
                value={plantHours}
                onChange={(e) => setPlantHours(e.target.value)}
                placeholder="0"
                step="0.5"
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Lot</label>
              <select
                value={plantLotId}
                onChange={(e) => setPlantLotId(e.target.value)}
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation bg-background"
              >
                <option value="">No lot</option>
                {lots.map(lot => (
                  <option key={lot.id} value={lot.id}>Lot {lot.lotNumber}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSavePlant}
            disabled={!plantDescription.trim() || savingPlant}
            className={cn(
              'w-full py-3 rounded-lg font-semibold text-white',
              'bg-gray-600 active:bg-gray-700',
              'touch-manipulation min-h-[48px]',
              'flex items-center justify-center gap-2',
              (!plantDescription.trim() || savingPlant) && 'opacity-50'
            )}
          >
            {savingPlant ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : 'Save Plant'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
