import React, { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { DELAY_TYPES, validateHours } from '../constants'
import type { DailyDiary, Delay, DelayFormState } from '../types'

interface DelaysTabProps {
  diary: DailyDiary
  saving: boolean
  setSaving: (saving: boolean) => void
  onDiaryUpdate: (diary: DailyDiary) => void
}

export const DelaysTab = React.memo(function DelaysTab({
  diary,
  saving,
  setSaving,
  onDiaryUpdate,
}: DelaysTabProps) {
  const [delayForm, setDelayForm] = useState<DelayFormState>({
    delayType: '',
    startTime: '',
    endTime: '',
    durationHours: '',
    description: '',
    impact: '',
  })

  const delayHoursValidation = validateHours(delayForm.durationHours)

  const addDelay = async () => {
    if (!delayForm.delayType || !delayForm.description) return
    setSaving(true)
    try {
      const delay = await apiFetch<Delay>(`/api/diary/${diary.id}/delays`, {
        method: 'POST',
        body: JSON.stringify({
          delayType: delayForm.delayType,
          startTime: delayForm.startTime || undefined,
          endTime: delayForm.endTime || undefined,
          durationHours: delayForm.durationHours ? parseFloat(delayForm.durationHours) : undefined,
          description: delayForm.description,
          impact: delayForm.impact || undefined,
        }),
      })

      onDiaryUpdate({ ...diary, delays: [...diary.delays, delay] })
      setDelayForm({ delayType: '', startTime: '', endTime: '', durationHours: '', description: '', impact: '' })
    } catch (err) {
      console.error('Error adding delay:', err)
    } finally {
      setSaving(false)
    }
  }

  const removeDelay = async (delayId: string) => {
    try {
      await apiFetch(`/api/diary/${diary.id}/delays/${delayId}`, {
        method: 'DELETE',
      })
      onDiaryUpdate({ ...diary, delays: diary.delays.filter(d => d.id !== delayId) })
    } catch (err) {
      console.error('Error removing delay:', err)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Delays</h3>

      {/* Delays List */}
      {diary.delays.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-2">Type</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Start</th>
                <th className="pb-2">End</th>
                <th className="pb-2">Duration</th>
                <th className="pb-2">Impact</th>
                {diary.status !== 'submitted' && <th className="pb-2"></th>}
              </tr>
            </thead>
            <tbody>
              {diary.delays.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="py-2">
                    <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                      {d.delayType}
                    </span>
                  </td>
                  <td className="py-2 font-medium">{d.description}</td>
                  <td className="py-2">{d.startTime || '-'}</td>
                  <td className="py-2">{d.endTime || '-'}</td>
                  <td className="py-2">{d.durationHours ? `${d.durationHours}h` : '-'}</td>
                  <td className="py-2">{d.impact || '-'}</td>
                  {diary.status !== 'submitted' && (
                    <td className="py-2">
                      <button
                        onClick={() => removeDelay(d.id)}
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

      {/* Add Delay Form */}
      {diary.status !== 'submitted' && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 font-medium">Add Delay</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={delayForm.delayType}
              onChange={(e) => setDelayForm({ ...delayForm, delayType: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">Delay Type *</option>
              {DELAY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              type="text"
              value={delayForm.description}
              onChange={(e) => setDelayForm({ ...delayForm, description: e.target.value })}
              placeholder="Description *"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <div className="flex flex-col">
              <input
                type="number"
                value={delayForm.durationHours}
                onChange={(e) => setDelayForm({ ...delayForm, durationHours: e.target.value })}
                placeholder="Duration (hours)"
                className={`rounded-md border bg-background px-3 py-2 ${
                  delayHoursValidation.warning ? 'border-amber-500' : 'border-input'
                }`}
              />
              {delayHoursValidation.warning && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {delayHoursValidation.warning}
                </p>
              )}
            </div>
            <input
              type="time"
              value={delayForm.startTime}
              onChange={(e) => setDelayForm({ ...delayForm, startTime: e.target.value })}
              placeholder="Start Time"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <input
              type="time"
              value={delayForm.endTime}
              onChange={(e) => setDelayForm({ ...delayForm, endTime: e.target.value })}
              placeholder="End Time"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <button
              onClick={addDelay}
              disabled={!delayForm.delayType || !delayForm.description || saving}
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
