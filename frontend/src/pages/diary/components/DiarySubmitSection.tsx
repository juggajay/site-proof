import React, { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { extractSubmitWarnings } from '@/lib/diarySubmitWarnings';
import { logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { fetchPdfBranding } from '@/lib/pdf/fetchBranding';
import type { PDFCompanyBranding } from '@/lib/pdf/types';
import type { DailyDiaryPDFData } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import type { DailyDiary, Addendum } from '../types';

interface DiarySubmitSectionProps {
  diary: DailyDiary;
  projectId: string;
  addendums: Addendum[];
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onDiaryUpdate: (diary: DailyDiary) => void;
  onRefreshDiaries: () => void;
  onAddendumsChange: (addendums: Addendum[]) => void;
}

interface ProjectResponse {
  project?: {
    name?: string | null;
    projectNumber?: string | null;
  };
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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [addendumContent, setAddendumContent] = useState('');
  const [addingAddendum, setAddingAddendum] = useState(false);
  const [printing, setPrinting] = useState(false);
  const submittingRef = useRef(false);
  const printingRef = useRef(false);
  const addingAddendumRef = useRef(false);

  // M30: the warning list is the SERVER's (its 422 acknowledgement gate), not a
  // client-side re-derivation — so the warnings the foreman sees and the gate the
  // server enforces can never drift apart.
  const handleSubmitClick = () => {
    setSubmitWarnings([]);
    setShowSubmitConfirm(true);
  };

  const confirmSubmitDiary = async () => {
    if (saving || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);

    // First confirm submits WITHOUT acknowledgement so the server can answer with
    // its 422 warning gate. Once those warnings are shown, the next confirm
    // acknowledges them.
    const acknowledging = submitWarnings.length > 0;
    try {
      const data = await apiFetch<{ diary: DailyDiary }>(
        `/api/diary/${encodeURIComponent(diary.id)}/submit`,
        {
          method: 'POST',
          body: acknowledging ? JSON.stringify({ acknowledgeWarnings: true }) : undefined,
        },
      );

      setShowSubmitConfirm(false);
      setSubmitWarnings([]);
      onDiaryUpdate(data.diary);
      onRefreshDiaries();
      toast({ title: 'Daily diary submitted', variant: 'success' });
    } catch (err) {
      // A 422 acknowledgement gate on the first attempt keeps the modal open with
      // the server's warnings; the foreman re-confirms to acknowledge.
      const backendWarnings = !acknowledging ? extractSubmitWarnings(err) : null;
      if (backendWarnings) {
        setSubmitWarnings(backendWarnings);
      } else {
        logError('Error submitting diary:', err);
        toast({
          title: 'Failed to submit diary',
          description: extractErrorMessage(err, 'Please try again.'),
          variant: 'error',
        });
        setShowSubmitConfirm(false);
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    try {
      let project: ProjectResponse['project'];
      let company: PDFCompanyBranding | null = null;
      try {
        // Branding is best-effort (resolves null on failure) — only the
        // project fetch can reject into the catch below.
        const [projectResponse, branding] = await Promise.all([
          apiFetch<ProjectResponse>(`/api/projects/${encodeURIComponent(projectId)}`),
          fetchPdfBranding(projectId),
        ]);
        project = projectResponse.project;
        company = branding;
        if (!project?.name) {
          throw new Error('Missing project metadata');
        }
      } catch {
        throw new Error('Project details could not be loaded. Please try again.');
      }

      const pdfData: DailyDiaryPDFData = {
        company,
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
          updatedAt: diary.updatedAt,
        },
        project: {
          name: project?.name || 'Unknown Project',
          projectNumber: project?.projectNumber || null,
        },
        personnel: diary.personnel.map((p) => ({
          id: p.id,
          name: p.name,
          company: p.company,
          role: p.role,
          startTime: p.startTime,
          finishTime: p.finishTime,
          hours: p.hours,
        })),
        plant: diary.plant.map((p) => ({
          id: p.id,
          description: p.description,
          idRego: p.idRego,
          company: p.company,
          hoursOperated: p.hoursOperated,
          notes: p.notes,
        })),
        activities: diary.activities.map((a) => ({
          id: a.id,
          description: a.description,
          lot: a.lot ? { lotNumber: a.lot.lotNumber } : null,
          quantity: a.quantity,
          unit: a.unit,
          notes: a.notes,
        })),
        delays: diary.delays.map((d) => ({
          id: d.id,
          delayType: d.delayType,
          description: d.description,
          startTime: d.startTime,
          endTime: d.endTime,
          durationHours: d.durationHours,
          impact: d.impact,
        })),
        addendums: addendums.map((a) => ({
          id: a.id,
          content: a.content,
          addedBy: a.addedBy,
          addedAt: a.addedAt,
        })),
      };

      const { generateDailyDiaryPDF } = await import('@/lib/pdfGenerator');
      await generateDailyDiaryPDF(pdfData);
      toast({ title: 'Daily diary PDF downloaded', variant: 'success' });
    } catch (err) {
      logError('Error generating diary PDF:', err);
      toast({
        title: 'Failed to generate PDF',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      printingRef.current = false;
      setPrinting(false);
    }
  };

  const addAddendum = async () => {
    const content = addendumContent.trim();
    if (!content || addingAddendumRef.current) return;
    addingAddendumRef.current = true;
    setAddingAddendum(true);
    try {
      const newAddendum = await apiFetch<Addendum>(
        `/api/diary/${encodeURIComponent(diary.id)}/addendum`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      );

      onAddendumsChange([...addendums, newAddendum]);
      setAddendumContent('');
    } catch (err) {
      logError('Error adding addendum:', err);
      toast({
        title: 'Failed to add addendum',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      addingAddendumRef.current = false;
      setAddingAddendum(false);
    }
  };

  return (
    <>
      {/* Submit & Print Buttons */}
      <div className="flex justify-end gap-4">
        {/* Print Button */}
        <Button
          variant="outline"
          onClick={handlePrint}
          disabled={printing}
          title="Print daily diary"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          {printing ? 'Printing...' : 'Print'}
        </Button>

        {/* Submit Button - Only for draft */}
        {diary.status === 'draft' && (
          <Button variant="success" onClick={handleSubmitClick} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit Diary'}
          </Button>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <Modal onClose={() => setShowSubmitConfirm(false)}>
          <ModalHeader>Submit Daily Diary?</ModalHeader>
          <ModalBody>
            {submitWarnings.length > 0 && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="font-medium text-warning mb-2">Warnings:</p>
                <ul className="list-disc pl-5 text-sm text-warning space-y-1">
                  {submitWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-muted-foreground">
              {submitWarnings.length > 0
                ? 'Do you want to submit the diary with the above warnings?'
                : 'Once submitted, this diary entry cannot be edited.'}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={confirmSubmitDiary} disabled={saving}>
              {saving ? 'Submitting...' : 'Confirm Submit'}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Submitted Info */}
      {diary.status === 'submitted' && diary.submittedBy && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-success">
          <p>
            <strong>Submitted</strong> by {diary.submittedBy.fullName} on{' '}
            {diary.submittedAt && new Date(diary.submittedAt).toLocaleString('en-AU')}
            {diary.isLate && <span className="ml-2 text-warning">(Late Entry)</span>}
          </p>
        </div>
      )}

      {/* Addendums Section - Only for submitted diaries */}
      {diary.status === 'submitted' && (
        <div className="rounded-lg border bg-card p-6 mt-4">
          <h3 className="text-lg font-semibold mb-4">Addendums</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Addendums allow you to add notes to a submitted diary without modifying the original
            record.
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
            <Label>Add Addendum</Label>
            <Textarea
              value={addendumContent}
              onChange={(e) => setAddendumContent(e.target.value)}
              placeholder="Enter addendum notes..."
              className="min-h-[100px]"
            />
            <Button onClick={addAddendum} disabled={!addendumContent.trim() || addingAddendum}>
              {addingAddendum ? 'Adding...' : 'Add Addendum'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
});
