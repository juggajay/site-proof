import React, { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { validateHours } from '../constants'
import type { DailyDiary, Plant, PlantFormState } from '../types'

interface PlantTabProps {
  diary: DailyDiary
  saving: boolean
  setSaving: (saving: boolean) => void
  onDiaryUpdate: (diary: DailyDiary) => void
}

export const PlantTab = React.memo(function PlantTab({
  diary,
  saving,
  setSaving,
  onDiaryUpdate,
}: PlantTabProps) {
  const [plantForm, setPlantForm] = useState<PlantFormState>({
    description: '',
    idRego: '',
    company: '',
    hoursOperated: '',
    notes: '',
  })

  const plantHoursValidation = validateHours(plantForm.hoursOperated)

  const addPlant = async () => {
    if (!plantForm.description) return
    setSaving(true)
    try {
      const plant = await apiFetch<Plant>(`/api/diary/${diary.id}/plant`, {
        method: 'POST',
        body: JSON.stringify({
          description: plantForm.description,
          idRego: plantForm.idRego || undefined,
          company: plantForm.company || undefined,
          hoursOperated: plantForm.hoursOperated ? parseFloat(plantForm.hoursOperated) : undefined,
          notes: plantForm.notes || undefined,
        }),
      })

      onDiaryUpdate({ ...diary, plant: [...diary.plant, plant] })
      setPlantForm({ description: '', idRego: '', company: '', hoursOperated: '', notes: '' })
    } catch (err) {
      console.error('Error adding plant:', err)
    } finally {
      setSaving(false)
    }
  }

  const removePlant = async (plantId: string) => {
    try {
      await apiFetch(`/api/diary/${diary.id}/plant/${plantId}`, {
        method: 'DELETE',
      })
      onDiaryUpdate({ ...diary, plant: diary.plant.filter(p => p.id !== plantId) })
    } catch (err) {
      console.error('Error removing plant:', err)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Plant & Equipment</h3>

      {/* Plant List */}
      {diary.plant.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-2">Description</th>
                <th className="pb-2">ID/Rego</th>
                <th className="pb-2">Company</th>
                <th className="pb-2">Hours</th>
                <th className="pb-2">Notes</th>
                {diary.status !== 'submitted' && <th className="pb-2"></th>}
              </tr>
            </thead>
            <tbody>
              {diary.plant.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="py-2 font-medium">{p.description}</td>
                  <td className="py-2">{p.idRego || '-'}</td>
                  <td className="py-2">{p.company || '-'}</td>
                  <td className="py-2">{p.hoursOperated || '-'}</td>
                  <td className="py-2">{p.notes || '-'}</td>
                  {diary.status !== 'submitted' && (
                    <td className="py-2">
                      <button
                        onClick={() => removePlant(p.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Plant Form */}
      {diary.status !== 'submitted' && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 font-medium">Add Plant</h4>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              type="text"
              value={plantForm.description}
              onChange={(e) => setPlantForm({ ...plantForm, description: e.target.value })}
              placeholder="Description *"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <input
              type="text"
              value={plantForm.idRego}
              onChange={(e) => setPlantForm({ ...plantForm, idRego: e.target.value })}
              placeholder="ID/Rego"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <input
              type="text"
              value={plantForm.company}
              onChange={(e) => setPlantForm({ ...plantForm, company: e.target.value })}
              placeholder="Company"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <div className="flex flex-col">
              <input
                type="number"
                value={plantForm.hoursOperated}
                onChange={(e) => setPlantForm({ ...plantForm, hoursOperated: e.target.value })}
                placeholder="Hours"
                className={`rounded-md border bg-background px-3 py-2 ${
                  plantHoursValidation.warning ? 'border-amber-500' : 'border-input'
                }`}
              />
              {plantHoursValidation.warning && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {plantHoursValidation.warning}
                </p>
              )}
            </div>
            <button
              onClick={addPlant}
              disabled={!plantForm.description || saving}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
