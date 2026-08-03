/**
 * Wave C5-c — the survey record editor. §7.2: **one modal, one status control,
 * captured on ONE surface** (`[C3R-B3]` — a control on a second, wrong surface
 * stamps the wrong provenance).
 *
 * Three modes, one form, because they are the same act filed at different points
 * in a record's life:
 *
 * - `create` — the record does not exist yet.
 * - `edit` — correct what a live record says. `kind` and the report link are not
 *   in `patchSurveySchema`, so `kind` is shown as a fact and the report moves by
 *   its own route; the status control appears only where the transition map has
 *   an edge out.
 * - `supersede` — the corrected report. `returned_for_correction` has NO status
 *   edge out: the corrected report is a NEW record that supersedes the returned
 *   one (MRTS50 cl. 7.2 — a redo is a new, cross-referenced artifact), so this
 *   mode creates and then links, in that order, and locks `kind` because
 *   `(lot_id, kind)` is the identity the backend's supersession check uses.
 *
 * Nothing here computes a verdict `[C5S-B1]`. `surveyorVerdict` is a
 * transcription field carrying the report's own vocabulary, and the form is
 * deliberately free of any coordinate, level, deviation or tolerance input — the
 * backend refuses to store one.
 */

import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/Modal';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import {
  useProjectDocuments,
  useSurveyCreate,
  useSurveyEdit,
  useSurveyReportAttach,
  useSurveyStatus,
  useSurveySupersede,
} from '../hooks/useLotSurveyMaterials';
import {
  SURVEY_KINDS,
  SURVEY_VERDICTS,
  surveyKindLabel,
  surveyStatusLabel,
  surveyVerdictLabel,
  type SurveyDraft,
  type SurveyRecord,
} from '../lib/surveyRecords';

export type SurveyEditorMode = 'create' | 'edit' | 'supersede';

/**
 * The two states the editor may file at. `returned_for_correction` is absent on
 * purpose: returning is a judgement about a deliverable that has arrived, made
 * by the narrower decider set, and the record's own row already offers it.
 * Filing straight at `received` is the dominant real case — the report arrives
 * and only then does anyone create the record `[C5R-A2]`.
 */
const EDITOR_STATUSES = ['requested', 'received'] as const;

/**
 * The client half of the backend's two arrival gates (`assertAttributable`,
 * `assertReportPresentFor`), so filing an arrived report incompletely produces a
 * field error rather than a 400. The route still enforces both — this is an
 * affordance, not the rule.
 */
const editorSchema = z
  .object({
    kind: z.string().min(1),
    status: z.enum(EDITOR_STATUSES),
    surveyorName: z.string().trim().max(200),
    surveyorCompany: z.string().trim().max(200),
    surveyorRegistration: z.string().trim().max(120),
    surveyedAt: z.string(),
    surveyorVerdict: z.string(),
    verdictSourceNote: z.string().trim().max(500),
    reportDocumentId: z.string(),
    notes: z.string().trim().max(2000),
    supersessionReason: z.string().trim().max(1000),
  })
  .superRefine((values, ctx) => {
    if (values.status !== 'received') return;
    if (!values.surveyorName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['surveyorName'],
        message: 'Record the surveyor who performed the survey before filing their report.',
      });
    }
    if (!values.reportDocumentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reportDocumentId'],
        message: 'Attach the report before recording it as received.',
      });
    }
  });

type SurveyEditorFormData = z.infer<typeof editorSchema>;

/** `<input type="date">` speaks `yyyy-mm-dd`; the route speaks ISO-8601. */
function toDateInput(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function toIsoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function orNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

/** An unrecorded optional field is an empty one — never the string "null". */
function text(value: string | null | undefined): string {
  return value ?? '';
}

function defaultsFor(mode: SurveyEditorMode, record: SurveyRecord | null): SurveyEditorFormData {
  // TWO sources, and the split is the whole rule. `carried` is what a corrected
  // report inherits from the record it replaces: the ATTRIBUTION, because it is
  // the same survey by the same surveyor. `editing` is everything else, which a
  // new record must NOT inherit — the old verdict and the old report file are
  // precisely what it exists to replace.
  const empty: Partial<SurveyRecord> = {};
  const carried = mode === 'create' ? empty : (record ?? empty);
  const editing = mode === 'edit' ? (record ?? empty) : empty;
  const filedStatus = mode === 'supersede' ? 'received' : editing.status;

  return {
    kind: text(carried.kind) || SURVEY_KINDS[0],
    status: filedStatus === 'received' ? 'received' : 'requested',
    surveyorName: text(carried.surveyorName),
    surveyorCompany: text(carried.surveyorCompany),
    surveyorRegistration: text(carried.surveyorRegistration),
    surveyedAt: toDateInput(editing.surveyedAt),
    surveyorVerdict: text(editing.surveyorVerdict),
    verdictSourceNote: text(editing.verdictSourceNote),
    reportDocumentId: text(editing.reportDocument?.id),
    notes: text(editing.notes),
    supersessionReason: '',
  };
}

const TITLES: Record<SurveyEditorMode, string> = {
  create: 'Record a survey',
  edit: 'Edit survey record',
  supersede: 'File the corrected survey report',
};

const SAVED_TOAST: Record<SurveyEditorMode, { title: string; description?: string }> = {
  create: { title: 'Survey record filed' },
  edit: { title: 'Survey record updated' },
  supersede: {
    title: 'Corrected report filed',
    description: 'The returned record is kept as history and now points at this revision.',
  },
};

/** A field the backend will not let this mode change, shown rather than hidden. */
function LockedField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <p className="mt-2 text-sm text-muted-foreground">{value}</p>
    </>
  );
}

interface SurveyRecordEditorModalProps {
  mode: SurveyEditorMode;
  lotId: string;
  projectId: string | undefined;
  /** The record being edited, or the returned record being superseded. */
  record: SurveyRecord | null;
  onClose: () => void;
}

export function SurveyRecordEditorModal({
  mode,
  lotId,
  projectId,
  record,
  onClose,
}: SurveyRecordEditorModalProps) {
  const create = useSurveyCreate(lotId);
  const edit = useSurveyEdit(lotId);
  const attachReport = useSurveyReportAttach(lotId);
  const status = useSurveyStatus(lotId);
  const supersede = useSurveySupersede(lotId);
  const documents = useProjectDocuments(projectId, true);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SurveyEditorFormData>({
    resolver: zodResolver(editorSchema),
    defaultValues: defaultsFor(mode, record),
  });

  const documentOptions = documents.data?.documents ?? [];
  // `requested` is the only state with an edge out, so it is the only one the
  // editor can move a live record from. Every other state is shown as a fact.
  const canMoveStatus = mode !== 'edit' || record?.status === 'requested';

  const onSubmit = async (values: SurveyEditorFormData) => {
    const draft: SurveyDraft = {
      kind: values.kind,
      status: values.status,
      reportDocumentId: orNull(values.reportDocumentId),
      surveyorName: orNull(values.surveyorName),
      surveyorCompany: orNull(values.surveyorCompany),
      surveyorRegistration: orNull(values.surveyorRegistration),
      surveyedAt: toIsoOrNull(values.surveyedAt),
      surveyorVerdict: orNull(values.surveyorVerdict),
      verdictSourceNote: orNull(values.verdictSourceNote),
      notes: orNull(values.notes),
    };

    try {
      if (mode === 'edit' && record) {
        const { kind: _kind, status: _status, reportDocumentId, ...patch } = draft;
        await edit.mutateAsync({ surveyId: record.id, patch });
        // Ordered, and the order is load-bearing: the status gate reads the
        // surveyor name and the report link OFF THE ROW, so both have to be
        // there before the record can be moved to received.
        if (reportDocumentId && reportDocumentId !== record.reportDocument?.id) {
          await attachReport.mutateAsync({ surveyId: record.id, documentId: reportDocumentId });
        }
        if (canMoveStatus && values.status !== record.status) {
          await status.mutateAsync({ surveyId: record.id, status: values.status });
        }
      } else {
        const created = await create.mutateAsync(draft);
        if (mode === 'supersede' && record) {
          // The OLD record points at the new one — the direction the route
          // takes. If this second call fails the corrected report still exists
          // and is visible on the lot: an unlinked revision, never a lost one.
          await supersede.mutateAsync({
            surveyId: record.id,
            supersededById: created.id,
            reason: orNull(values.supersessionReason),
          });
        }
      }

      toast(SAVED_TOAST[mode]);
      onClose();
    } catch (err) {
      logError('Error saving survey record:', err);
      setError('root', { message: handleApiError(err, 'Could not save this survey record') });
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-lg">
      <ModalHeader>{TITLES[mode]}</ModalHeader>
      <ModalDescription>
        {mode === 'supersede'
          ? 'The returned record stays on this lot as the record of what came back. This files the corrected report as its replacement.'
          : 'What the surveyor stated, transcribed as they wrote it. CIVOS records that the report arrived — it does not judge the works.'}
      </ModalDescription>
      <ModalBody>
        <form id="survey-editor-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root?.message && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {errors.root.message}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {mode === 'create' ? (
                <>
                  <Label htmlFor="survey-kind">Survey type</Label>
                  <NativeSelect id="survey-kind" className="mt-1" {...register('kind')}>
                    {SURVEY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {surveyKindLabel(kind)}
                      </option>
                    ))}
                  </NativeSelect>
                </>
              ) : (
                <>
                  {/* Locked for two different reasons that happen to agree:
                      PATCH does not accept `kind`, and a superseding record must
                      be of the same kind as the record it replaces. */}
                  <LockedField label="Survey type" value={surveyKindLabel(record?.kind ?? '')} />
                  <input type="hidden" {...register('kind')} />
                </>
              )}
            </div>

            <div>
              {canMoveStatus ? (
                <>
                  <Label htmlFor="survey-status">Status</Label>
                  <NativeSelect id="survey-status" className="mt-1" {...register('status')}>
                    {EDITOR_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {surveyStatusLabel(value)}
                      </option>
                    ))}
                  </NativeSelect>
                </>
              ) : (
                <>
                  <LockedField label="Status" value={surveyStatusLabel(record?.status ?? '')} />
                  <input type="hidden" {...register('status')} />
                </>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="survey-surveyor-name">Surveyor</Label>
            <Input
              id="survey-surveyor-name"
              className="mt-1"
              placeholder="e.g. R. Tanaka"
              {...register('surveyorName')}
            />
            {errors.surveyorName && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.surveyorName.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="survey-surveyor-company">Surveying company</Label>
              <Input
                id="survey-surveyor-company"
                className="mt-1"
                placeholder="Optional"
                {...register('surveyorCompany')}
              />
            </div>
            <div>
              <Label htmlFor="survey-surveyor-registration">Registration</Label>
              <Input
                id="survey-surveyor-registration"
                className="mt-1"
                placeholder="e.g. QLD Cadastral Reg. 4417"
                {...register('surveyorRegistration')}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="survey-surveyed-at">Date surveyed</Label>
            <Input
              id="survey-surveyed-at"
              type="date"
              className="mt-1"
              {...register('surveyedAt')}
            />
          </div>

          <div>
            <Label htmlFor="survey-report">Report file</Label>
            <NativeSelect id="survey-report" className="mt-1" {...register('reportDocumentId')}>
              <option value="">No report attached</option>
              {documentOptions.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename}
                </option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload the report in Documents first — it is linked here, never uploaded here.
            </p>
            {errors.reportDocumentId && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.reportDocumentId.message}
              </p>
            )}
          </div>

          {/* The transcription half, fenced and captioned in the surveyor's
              name so no control in it reads as a CIVOS finding. */}
          <fieldset className="rounded-lg border border-border p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Surveyor-stated verdict
            </legend>
            <Label htmlFor="survey-verdict">What the report states</Label>
            <NativeSelect id="survey-verdict" className="mt-1" {...register('surveyorVerdict')}>
              <option value="">Not yet transcribed</option>
              {SURVEY_VERDICTS.map((verdict) => (
                <option key={verdict} value={verdict}>
                  {surveyVerdictLabel(verdict)}
                </option>
              ))}
            </NativeSelect>
            <Label htmlFor="survey-verdict-note" className="mt-3 block">
              Where it says so
            </Label>
            <Input
              id="survey-verdict-note"
              className="mt-1"
              placeholder="e.g. levels within ±25 mm of design, MRTS04 Cl. 8.3.2"
              {...register('verdictSourceNote')}
            />
          </fieldset>

          {mode === 'supersede' && (
            <div>
              <Label htmlFor="survey-supersession-reason">Why this survey was redone</Label>
              <Input
                id="survey-supersession-reason"
                className="mt-1"
                placeholder="e.g. re-survey after trim and re-roll of CH1310–CH1330"
                {...register('supersessionReason')}
              />
            </div>
          )}

          <div>
            <Label htmlFor="survey-notes">Notes</Label>
            <textarea
              id="survey-notes"
              rows={2}
              maxLength={2000}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
              {...register('notes')}
            />
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" form="survey-editor-form" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'File record'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
