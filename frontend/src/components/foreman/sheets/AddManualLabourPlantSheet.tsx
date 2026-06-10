import { useEffect, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './BottomSheet';
import { SheetDraftRestoredHint } from './SheetDraftRestoredHint';
import { SheetErrorBanner } from './SheetErrorBanner';
import { readSheetDraft, useSheetDraft } from './useSheetDraft';
import { useSheetSave } from './useSheetSave';
import {
  getOptionalDiaryHoursError,
  parseOptionalDiaryHoursInput,
} from '@/pages/diary/diaryNumericInput';

interface AddManualLabourPlantSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePersonnel: (data: {
    name: string;
    company?: string;
    role?: string;
    hours?: number;
    lotId?: string;
  }) => Promise<void>;
  onSavePlant: (data: {
    description: string;
    idRego?: string;
    company?: string;
    hoursOperated?: number;
    lotId?: string;
  }) => Promise<void>;
  defaultLotId: string | null;
  lots: Array<{ id: string; lotNumber: string }>;
  initialPersonnelData?: {
    name: string;
    company?: string;
    role?: string;
    hours?: number;
    lotId?: string;
  };
  initialPlantData?: {
    description: string;
    idRego?: string;
    company?: string;
    hoursOperated?: number;
    lotId?: string;
  };
  /** Enables auto-draft of typed state; omitted when editing an existing entry. */
  draftKey?: string;
}

export function AddManualLabourPlantSheet({
  isOpen,
  onClose,
  onSavePersonnel,
  onSavePlant,
  defaultLotId,
  lots,
  initialPersonnelData,
  initialPlantData,
  draftKey,
}: AddManualLabourPlantSheetProps) {
  const editingMode = initialPersonnelData ? 'personnel' : initialPlantData ? 'plant' : null;
  // An interrupted entry restored from the auto-draft; edits never draft.
  const [restoredDraft] = useState(() => (editingMode ? null : readSheetDraft(draftKey)));

  // Personnel fields
  const [personnelName, setPersonnelName] = useState(restoredDraft?.personnelName || '');
  const [personnelCompany, setPersonnelCompany] = useState(restoredDraft?.personnelCompany || '');
  const [personnelRole, setPersonnelRole] = useState(restoredDraft?.personnelRole || '');
  const [personnelHours, setPersonnelHours] = useState(restoredDraft?.personnelHours || '');
  const [personnelLotId, setPersonnelLotId] = useState(
    restoredDraft ? restoredDraft.personnelLotId || '' : defaultLotId || '',
  );
  const {
    saving: savingPersonnel,
    saveError: personnelSaveError,
    runSave: runPersonnelSave,
  } = useSheetSave();

  // Plant fields
  const [plantDescription, setPlantDescription] = useState(restoredDraft?.plantDescription || '');
  const [plantIdRego, setPlantIdRego] = useState(restoredDraft?.plantIdRego || '');
  const [plantCompany, setPlantCompany] = useState(restoredDraft?.plantCompany || '');
  const [plantHours, setPlantHours] = useState(restoredDraft?.plantHours || '');
  const [plantLotId, setPlantLotId] = useState(
    restoredDraft ? restoredDraft.plantLotId || '' : defaultLotId || '',
  );
  const { saving: savingPlant, saveError: plantSaveError, runSave: runPlantSave } = useSheetSave();
  const personnelHoursError = getOptionalDiaryHoursError(personnelHours);
  const plantHoursError = getOptionalDiaryHoursError(plantHours, 'Hours operated');
  const draft = useSheetDraft({
    draftKey: editingMode ? undefined : draftKey,
    restored: restoredDraft,
    fields: {
      personnelName,
      personnelCompany,
      personnelRole,
      personnelHours,
      personnelLotId,
      plantDescription,
      plantIdRego,
      plantCompany,
      plantHours,
      plantLotId,
    },
    baseline: {
      personnelName: '',
      personnelCompany: '',
      personnelRole: '',
      personnelHours: '',
      personnelLotId: defaultLotId || '',
      plantDescription: '',
      plantIdRego: '',
      plantCompany: '',
      plantHours: '',
      plantLotId: defaultLotId || '',
    },
  });
  const title =
    editingMode === 'personnel'
      ? 'Edit Personnel'
      : editingMode === 'plant'
        ? 'Edit Plant'
        : 'Add Labour / Plant';

  // Seeds the fields on open. Unlike the other sheets this one resets its
  // state through an effect, so the restored draft must be applied here or
  // the reset would clobber it on mount.
  useEffect(() => {
    if (!isOpen) return;

    if (!editingMode && restoredDraft) {
      setPersonnelName(restoredDraft.personnelName || '');
      setPersonnelCompany(restoredDraft.personnelCompany || '');
      setPersonnelRole(restoredDraft.personnelRole || '');
      setPersonnelHours(restoredDraft.personnelHours || '');
      setPersonnelLotId(restoredDraft.personnelLotId || '');

      setPlantDescription(restoredDraft.plantDescription || '');
      setPlantIdRego(restoredDraft.plantIdRego || '');
      setPlantCompany(restoredDraft.plantCompany || '');
      setPlantHours(restoredDraft.plantHours || '');
      setPlantLotId(restoredDraft.plantLotId || '');
      return;
    }

    setPersonnelName(initialPersonnelData?.name || '');
    setPersonnelCompany(initialPersonnelData?.company || '');
    setPersonnelRole(initialPersonnelData?.role || '');
    setPersonnelHours(initialPersonnelData?.hours?.toString() || '');
    setPersonnelLotId(initialPersonnelData?.lotId || defaultLotId || '');

    setPlantDescription(initialPlantData?.description || '');
    setPlantIdRego(initialPlantData?.idRego || '');
    setPlantCompany(initialPlantData?.company || '');
    setPlantHours(initialPlantData?.hoursOperated?.toString() || '');
    setPlantLotId(initialPlantData?.lotId || defaultLotId || '');
  }, [defaultLotId, editingMode, initialPersonnelData, initialPlantData, isOpen, restoredDraft]);

  const handleDiscardDraft = () => {
    setPersonnelName('');
    setPersonnelCompany('');
    setPersonnelRole('');
    setPersonnelHours('');
    setPersonnelLotId(defaultLotId || '');
    setPlantDescription('');
    setPlantIdRego('');
    setPlantCompany('');
    setPlantHours('');
    setPlantLotId(defaultLotId || '');
    draft.discardDraft();
  };

  const handleSavePersonnel = () => {
    if (!personnelName.trim() || personnelHoursError) return;
    const parsedPersonnelHours = parseOptionalDiaryHoursInput(personnelHours);
    void runPersonnelSave(
      () =>
        onSavePersonnel({
          name: personnelName.trim(),
          company: personnelCompany || undefined,
          role: personnelRole || undefined,
          hours: parsedPersonnelHours ?? undefined,
          lotId: personnelLotId || undefined,
        }),
      () => {
        // Recorded (online or queued offline) — drop the draft. The sheet can
        // stay open with plant fields typed; the auto-draft re-persists them
        // on the next field change below.
        draft.clearDraft();
        setPersonnelName('');
        setPersonnelCompany('');
        setPersonnelRole('');
        setPersonnelHours('');
        if (editingMode) onClose();
      },
    );
  };

  const handleSavePlant = () => {
    if (!plantDescription.trim() || plantHoursError) return;
    const parsedPlantHours = parseOptionalDiaryHoursInput(plantHours);
    void runPlantSave(
      () =>
        onSavePlant({
          description: plantDescription.trim(),
          idRego: plantIdRego || undefined,
          company: plantCompany || undefined,
          hoursOperated: parsedPlantHours ?? undefined,
          lotId: plantLotId || undefined,
        }),
      () => {
        // Recorded (online or queued offline) — drop the draft (see personnel).
        draft.clearDraft();
        setPlantDescription('');
        setPlantIdRego('');
        setPlantCompany('');
        setPlantHours('');
        if (editingMode) onClose();
      },
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        {draft.draftHintVisible && (
          <SheetDraftRestoredHint
            onDiscard={handleDiscardDraft}
            onDismiss={draft.dismissDraftHint}
          />
        )}
        {/* Tip banner */}
        <div className="flex items-start gap-2 p-3 bg-muted rounded-lg border border-border">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Tip: Labour and plant auto-populate from approved dockets.
          </p>
        </div>

        {/* Personnel section */}
        {editingMode !== 'plant' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Personnel
            </h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name *</label>
              <input
                type="text"
                value={personnelName}
                onChange={(e) => setPersonnelName(e.target.value)}
                placeholder="Worker name"
                className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
                spellCheck={false}
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
                  className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                  autoCapitalize="words"
                  autoComplete="organization"
                  enterKeyHint="next"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <input
                  type="text"
                  value={personnelRole}
                  onChange={(e) => setPersonnelRole(e.target.value)}
                  placeholder="Role"
                  className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                  autoCapitalize="words"
                  autoComplete="off"
                  enterKeyHint="next"
                  spellCheck={false}
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
                  inputMode="decimal"
                  className={cn(
                    'w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation',
                    personnelHoursError && 'border-destructive',
                  )}
                />
                {personnelHoursError && (
                  <p className="mt-1 text-xs text-destructive" role="alert" aria-live="assertive">
                    {personnelHoursError}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lot</label>
                <select
                  value={personnelLotId}
                  onChange={(e) => setPersonnelLotId(e.target.value)}
                  className="w-full mt-1 px-3 py-3 border border-border rounded-lg text-base touch-manipulation bg-background text-foreground"
                >
                  <option value="">No lot</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      Lot {lot.lotNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {personnelSaveError && (
              <SheetErrorBanner onRetry={handleSavePersonnel} retrying={savingPersonnel} />
            )}
            <button
              onClick={handleSavePersonnel}
              disabled={!personnelName.trim() || Boolean(personnelHoursError) || savingPersonnel}
              className={cn(
                'w-full py-3 rounded-lg font-semibold text-primary-foreground',
                'bg-primary active:bg-primary/90',
                'touch-manipulation min-h-[48px]',
                'flex items-center justify-center gap-2',
                (!personnelName.trim() || personnelHoursError || savingPersonnel) && 'opacity-50',
              )}
            >
              {savingPersonnel ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Saving...
                </>
              ) : (
                'Save Personnel'
              )}
            </button>
          </div>
        )}

        {/* Divider */}
        {!editingMode && <div className="border-t border-border" />}

        {/* Plant section */}
        {editingMode !== 'personnel' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Plant / Equipment
            </h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description *</label>
              <input
                type="text"
                value={plantDescription}
                onChange={(e) => setPlantDescription(e.target.value)}
                placeholder="Plant / equipment description"
                className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                autoCapitalize="sentences"
                autoComplete="off"
                enterKeyHint="next"
                spellCheck={true}
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
                  className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                  autoCapitalize="characters"
                  autoComplete="off"
                  enterKeyHint="next"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Company</label>
                <input
                  type="text"
                  value={plantCompany}
                  onChange={(e) => setPlantCompany(e.target.value)}
                  placeholder="Company"
                  className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                  autoCapitalize="words"
                  autoComplete="organization"
                  enterKeyHint="next"
                  spellCheck={false}
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
                  inputMode="decimal"
                  className={cn(
                    'w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation',
                    plantHoursError && 'border-destructive',
                  )}
                />
                {plantHoursError && (
                  <p className="mt-1 text-xs text-destructive" role="alert" aria-live="assertive">
                    {plantHoursError}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lot</label>
                <select
                  value={plantLotId}
                  onChange={(e) => setPlantLotId(e.target.value)}
                  className="w-full mt-1 px-3 py-3 border border-border rounded-lg text-base touch-manipulation bg-background text-foreground"
                >
                  <option value="">No lot</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      Lot {lot.lotNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {plantSaveError && (
              <SheetErrorBanner onRetry={handleSavePlant} retrying={savingPlant} />
            )}
            <button
              onClick={handleSavePlant}
              disabled={!plantDescription.trim() || Boolean(plantHoursError) || savingPlant}
              className={cn(
                'w-full py-3 rounded-lg font-semibold text-accent-foreground',
                'bg-accent active:bg-accent/80',
                'touch-manipulation min-h-[48px]',
                'flex items-center justify-center gap-2',
                (!plantDescription.trim() || plantHoursError || savingPlant) && 'opacity-50',
              )}
            >
              {savingPlant ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Saving...
                </>
              ) : (
                'Save Plant'
              )}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
