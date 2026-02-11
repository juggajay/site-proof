import React, { useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { calculateHours } from '../constants'
import type { DailyDiary, Personnel, PersonnelFormState } from '../types'

interface PersonnelTabProps {
  diary: DailyDiary
  projectId: string
  selectedDate: string
  saving: boolean
  setSaving: (saving: boolean) => void
  onDiaryUpdate: (diary: DailyDiary) => void
}

export const PersonnelTab = React.memo(function PersonnelTab({
  diary,
  projectId,
  selectedDate,
  saving,
  setSaving,
  onDiaryUpdate,
}: PersonnelTabProps) {
  const isMobile = useIsMobile()

  const [personnelForm, setPersonnelForm] = useState<PersonnelFormState>({
    name: '',
    company: '',
    role: '',
    startTime: '',
    finishTime: '',
    hours: '',
  })

  const handlePersonnelStartTimeChange = (value: string) => {
    const hours = calculateHours(value, personnelForm.finishTime)
    setPersonnelForm({
      ...personnelForm,
      startTime: value,
      hours: hours !== null ? hours.toString() : '',
    })
  }

  const handlePersonnelFinishTimeChange = (value: string) => {
    const hours = calculateHours(personnelForm.startTime, value)
    setPersonnelForm({
      ...personnelForm,
      finishTime: value,
      hours: hours !== null ? hours.toString() : '',
    })
  }

  // Calculate personnel subtotals by company
  const personnelSubtotals = useMemo(() => {
    const companyTotals: Record<string, { count: number; hours: number }> = {}

    for (const p of diary.personnel) {
      const company = p.company || 'Unspecified'
      if (!companyTotals[company]) {
        companyTotals[company] = { count: 0, hours: 0 }
      }
      companyTotals[company].count++
      const hours = typeof p.hours === 'number' ? p.hours : (parseFloat(String(p.hours)) || 0)
      companyTotals[company].hours += hours
    }

    return Object.entries(companyTotals).map(([company, data]) => ({
      company,
      count: data.count,
      hours: data.hours,
    }))
  }, [diary.personnel])

  const totalHours = useMemo(() => {
    return diary.personnel.reduce((sum, p) => {
      const hours = typeof p.hours === 'number' ? p.hours : (parseFloat(String(p.hours)) || 0)
      return sum + hours
    }, 0)
  }, [diary.personnel])

  const addPersonnel = async () => {
    if (!personnelForm.name) return
    setSaving(true)
    try {
      const personnel = await apiFetch<Personnel>(`/api/diary/${diary.id}/personnel`, {
        method: 'POST',
        body: JSON.stringify({
          name: personnelForm.name,
          company: personnelForm.company || undefined,
          role: personnelForm.role || undefined,
          startTime: personnelForm.startTime || undefined,
          finishTime: personnelForm.finishTime || undefined,
          hours: personnelForm.hours ? parseFloat(personnelForm.hours) : undefined,
        }),
      })

      onDiaryUpdate({ ...diary, personnel: [...diary.personnel, personnel] })
      setPersonnelForm({ name: '', company: '', role: '', startTime: '', finishTime: '', hours: '' })
    } catch (err) {
      console.error('Error adding personnel:', err)
    } finally {
      setSaving(false)
    }
  }

  const removePersonnel = async (personnelId: string) => {
    try {
      await apiFetch(`/api/diary/${diary.id}/personnel/${personnelId}`, {
        method: 'DELETE',
      })
      onDiaryUpdate({ ...diary, personnel: diary.personnel.filter(p => p.id !== personnelId) })
    } catch (err) {
      console.error('Error removing personnel:', err)
    }
  }

  const copyPersonnelFromPreviousDay = async () => {
    setSaving(true)
    try {
      const data = await apiFetch<{ personnel: any[] }>(`/api/diary/${projectId}/${selectedDate}/previous-personnel`)

      if (data.personnel && data.personnel.length > 0) {
        let addedCount = 0
        let updatedDiary = diary
        for (const person of data.personnel) {
          const cleanPerson: Record<string, unknown> = { name: person.name }
          if (person.company) cleanPerson.company = person.company
          if (person.role) cleanPerson.role = person.role
          if (person.startTime) cleanPerson.startTime = person.startTime
          if (person.finishTime) cleanPerson.finishTime = person.finishTime
          if (person.hours !== null && person.hours !== undefined) cleanPerson.hours = person.hours

          try {
            const newPerson = await apiFetch<Personnel>(`/api/diary/${diary.id}/personnel`, {
              method: 'POST',
              body: JSON.stringify(cleanPerson),
            })
            updatedDiary = { ...updatedDiary, personnel: [...updatedDiary.personnel, newPerson] }
            addedCount++
          } catch {
            // skip individual failures
          }
        }
        onDiaryUpdate(updatedDiary)
        alert(`Copied ${addedCount} personnel from previous day`)
      } else {
        alert('No personnel found from previous day')
      }
    } catch (err) {
      console.error('Error copying personnel:', err)
      alert('Error copying personnel from previous day')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Personnel on Site</h3>
        {diary.status !== 'submitted' && (
          <button
            onClick={copyPersonnelFromPreviousDay}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy from Previous Day
          </button>
        )}
      </div>

      {/* Personnel List */}
      {diary.personnel.length > 0 && (
        <div className="mb-6">
          {isMobile ? (
            /* Mobile Card View */
            <div className="space-y-3">
              {diary.personnel.map((p) => (
                <div key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.company || 'No company'} &bull; {p.role || 'No role'}</p>
                    </div>
                    {diary.status !== 'submitted' && (
                      <button
                        onClick={() => removePersonnel(p.id)}
                        className="p-2 text-red-600 hover:text-red-700 touch-manipulation"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-sm">
                    <span>{p.startTime || '-'} - {p.finishTime || '-'}</span>
                    <span className="font-medium">{p.hours || 0} hrs</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop Table View */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Company</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Start</th>
                    <th className="pb-2">Finish</th>
                    <th className="pb-2">Hours</th>
                    {diary.status !== 'submitted' && <th className="pb-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {diary.personnel.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2">{p.company || '-'}</td>
                      <td className="py-2">{p.role || '-'}</td>
                      <td className="py-2">{p.startTime || '-'}</td>
                      <td className="py-2">{p.finishTime || '-'}</td>
                      <td className="py-2">{p.hours || '-'}</td>
                      {diary.status !== 'submitted' && (
                        <td className="py-2">
                          <button
                            onClick={() => removePersonnel(p.id)}
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
        </div>
      )}

      {/* Subtotals by Company */}
      {diary.personnel.length > 0 && (
        <div className="mb-6 rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 font-medium">Subtotals by Company</h4>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {personnelSubtotals.map((item) => (
              <div key={item.company} className="rounded-lg border bg-background p-3">
                <div className="font-medium">{item.company}</div>
                <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{item.count} {item.count === 1 ? 'person' : 'people'}</span>
                  <span className="font-medium text-foreground">{item.hours.toFixed(1)} hrs</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end border-t pt-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold">{diary.personnel.length} people, </span>
              <span className="font-semibold">
                {totalHours.toFixed(1)} hrs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add Personnel Form */}
      {diary.status !== 'submitted' && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 font-medium">Add Personnel</h4>
          <div className="grid gap-3 md:grid-cols-6">
            <input
              type="text"
              value={personnelForm.name}
              onChange={(e) => setPersonnelForm({ ...personnelForm, name: e.target.value })}
              placeholder="Name *"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <input
              type="text"
              value={personnelForm.company}
              onChange={(e) => setPersonnelForm({ ...personnelForm, company: e.target.value })}
              placeholder="Company"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <input
              type="text"
              value={personnelForm.role}
              onChange={(e) => setPersonnelForm({ ...personnelForm, role: e.target.value })}
              placeholder="Role"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <input
              type="time"
              value={personnelForm.startTime}
              onChange={(e) => handlePersonnelStartTimeChange(e.target.value)}
              placeholder="Start"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <input
              type="time"
              value={personnelForm.finishTime}
              onChange={(e) => handlePersonnelFinishTimeChange(e.target.value)}
              placeholder="Finish"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={personnelForm.hours ? `${personnelForm.hours}h` : ''}
                readOnly
                placeholder="Hours"
                className="w-16 rounded-md border border-input bg-muted px-3 py-2 text-center text-sm"
              />
              <button
                onClick={addPersonnel}
                disabled={!personnelForm.name || saving}
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
