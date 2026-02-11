import React, { useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { generateDailyDiaryPDF, DailyDiaryPDFData } from '@/lib/pdfGenerator'
import type { DailyDiary, Addendum } from '../types'

interface DiarySubmitSectionProps {
  diary: DailyDiary
  projectId: string
  addendums: Addendum[]
  saving: boolean
  setSaving: (saving: boolean) => void
  onDiaryUpdate: (diary: DailyDiary) => void
  onRefreshDiaries: () => void
  onAddendumsChange: (addendums: Addendum[]) => void
}

export const DiarySubmitSection = React.memo(function DiarySubmitSection({
  diary,
  projectId,
  addendums,
  saving,
  setSaving,
  onDiaryUpdate,
  onRefreshDiaries,
  onAddendumsChange,
}: DiarySubmitSectionProps) {
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([])
  const [addendumContent, setAddendumContent] = useState('')
  const [addingAddendum, setAddingAddendum] = useState(false)

  // Check for empty sections and generate warnings
  const getSubmitWarnings = useCallback((): string[] => {
    const warnings: string[] = []

    if (!diary.weatherConditions) {
      warnings.push('Weather conditions not recorded')
    }
    if (diary.personnel.length === 0) {
      warnings.push('No personnel recorded')
    }
    if (diary.activities.length === 0) {
      warnings.push('No activities recorded')
    }
    if (!diary.generalNotes && diary.delays.length === 0 && diary.plant.length === 0) {
      warnings.push('No general notes, plant, or delays recorded')
    }

    return warnings
  }, [diary])

  const handleSubmitClick = () => {
    const warnings = getSubmitWarnings()
    setSubmitWarnings(warnings)
    setShowSubmitConfirm(true)
  }

  const confirmSubmitDiary = async () => {
    if (saving) return
    setSaving(true)
    setShowSubmitConfirm(false)
    try {
      const data = await apiFetch<DailyDiary>(`/api/diary/${diary.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ acknowledgeWarnings: true }),
      })

      onDiaryUpdate(data)
      onRefreshDiaries()
    } catch (err) {
      console.error('Error submitting diary:', err)
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = async () => {
    try {
      let project: any
      try {
        project = await apiFetch(`/api/projects/${projectId}`)
      } catch {
        project = { name: 'Unknown Project', projectNumber: '' }
      }

      const pdfData: DailyDiaryPDFData = {
        diary: {
          id: diary.id,
          date: diary.date,
          status: diary.status,
          weatherConditions: diary.weatherConditions,
          temperatureMin: diary.temperatureMin,
          temperatureMax: diary.temperatureMax,
          rainfallMm: diary.rainfallMm,
          weatherNotes: diary.weatherNotes,
          generalNotes: diary.generalNotes,
          isLate: diary.isLate,
          submittedBy: diary.submittedBy,
          submittedAt: diary.submittedAt,
          createdAt: diary.createdAt,
          updatedAt: diary.updatedAt
        },
        project: {
          name: project.name || 'Unknown Project',
          projectNumber: project.projectNumber || null
        },
        personnel: diary.personnel.map(p => ({
          id: p.id,
          name: p.name,
          company: p.company,
          role: p.role,
          startTime: p.startTime,
          finishTime: p.finishTime,
          hours: p.hours
        })),
        plant: diary.plant.map(p => ({
          id: p.id,
          description: p.description,
          idRego: p.idRego,
          company: p.company,
          hoursOperated: p.hoursOperated,
          notes: p.notes
        })),
        activities: diary.activities.map(a => ({
          id: a.id,
          description: a.description,
          lot: a.lot ? { lotNumber: a.lot.lotNumber } : null,
          quantity: a.quantity,
          unit: a.unit,
          notes: a.notes
        })),
        delays: diary.delays.map(d => ({
          id: d.id,
          delayType: d.delayType,
          description: d.description,
          startTime: d.startTime,
          endTime: d.endTime,
          durationHours: d.durationHours,
          impact: d.impact
        })),
        addendums: addendums.map(a => ({
          id: a.id,
          content: a.content,
          addedBy: a.addedBy,
          addedAt: a.addedAt
        }))
      }

      generateDailyDiaryPDF(pdfData)
      toast({ title: 'Daily diary PDF downloaded', variant: 'success' })
    } catch (err) {
      console.error('Error generating diary PDF:', err)
      toast({ title: 'Failed to generate PDF', variant: 'error' })
    }
  }

  const addAddendum = async () => {
    if (!addendumContent.trim()) return
    setAddingAddendum(true)
    try {
      const newAddendum = await apiFetch<Addendum>(`/api/diary/${diary.id}/addendum`, {
        method: 'POST',
        body: JSON.stringify({ content: addendumContent.trim() }),
      })

      onAddendumsChange([...addendums, newAddendum])
      setAddendumContent('')
    } catch (err) {
      console.error('Error adding addendum:', err)
    } finally {
      setAddingAddendum(false)
    }
  }

  return (
    <>
      {/* Submit & Print Buttons */}
      <div className="flex justify-end gap-4">
        {/* Print Button */}
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
          title="Print daily diary"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>

        {/* Submit Button - Only for draft */}
        {diary.status === 'draft' && (
          <button
            onClick={handleSubmitClick}
            disabled={saving}
            className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Diary'}
          </button>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Submit Daily Diary?</h3>

            {submitWarnings.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-medium text-yellow-800 mb-2">Warnings:</p>
                <ul className="list-disc pl-5 text-sm text-yellow-700 space-y-1">
                  {submitWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-muted-foreground mb-4">
              {submitWarnings.length > 0
                ? 'Do you want to submit the diary with the above warnings?'
                : 'Once submitted, this diary entry cannot be edited.'}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 rounded-lg border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmitDiary}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submitted Info */}
      {diary.status === 'submitted' && diary.submittedBy && (
        <div className="rounded-lg border bg-green-50 p-4 text-green-800">
          <p>
            <strong>Submitted</strong> by {diary.submittedBy.fullName} on{' '}
            {diary.submittedAt && new Date(diary.submittedAt).toLocaleString('en-AU')}
            {diary.isLate && <span className="ml-2 text-orange-600">(Late Entry)</span>}
          </p>
        </div>
      )}

      {/* Addendums Section - Only for submitted diaries */}
      {diary.status === 'submitted' && (
        <div className="rounded-lg border bg-card p-6 mt-4">
          <h3 className="text-lg font-semibold mb-4">Addendums</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Addendums allow you to add notes to a submitted diary without modifying the original record.
          </p>

          {/* Existing Addendums */}
          {addendums.length > 0 && (
            <div className="space-y-3 mb-6">
              {addendums.map((addendum) => (
                <div key={addendum.id} className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm whitespace-pre-wrap">{addendum.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Added by {addendum.addedBy.fullName} on{' '}
                    {new Date(addendum.addedAt).toLocaleString('en-AU')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {addendums.length === 0 && (
            <p className="text-sm text-muted-foreground mb-4">No addendums added yet.</p>
          )}

          {/* Add Addendum Form */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Add Addendum</label>
            <textarea
              value={addendumContent}
              onChange={(e) => setAddendumContent(e.target.value)}
              placeholder="Enter addendum notes..."
              className="w-full rounded-lg border bg-background px-4 py-2 text-sm min-h-[100px]"
            />
            <button
              onClick={addAddendum}
              disabled={!addendumContent.trim() || addingAddendum}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {addingAddendum ? 'Adding...' : 'Add Addendum'}
            </button>
          </div>
        </div>
      )}
    </>
  )
})
