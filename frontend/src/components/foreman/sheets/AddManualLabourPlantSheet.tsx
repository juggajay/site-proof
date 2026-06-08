import { useEffect, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './BottomSheet';
import { useHaptics } from '@/hooks/useHaptics';
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
}: AddManualLabourPlantSheetProps) {
  // Personnel fields
  const [personnelName, setPersonnelName] = useState('');
  const [personnelCompany, setPersonnelCompany] = useState('');
  const [personnelRole, setPersonnelRole] = useState('');
  const [personnelHours, setPersonnelHours] = useState('');
  const [personnelLotId, setPersonnelLotId] = useState(defaultLotId || '');
  const [savingPersonnel, setSavingPersonnel] = useState(false);

  // Plant fields
  const [plantDescription, setPlantDescription] = useState('');
  const [plantIdRego, setPlantIdRego] = useState('');
  const [plantCompany, setPlantCompany] = useState('');
  const [plantHours, setPlantHours] = useState('');
  const [plantLotId, setPlantLotId] = useState(defaultLotId || '');
  const [savingPlant, setSavingPlant] = useState(false);

  const { trigger } = useHaptics();
  const personnelHoursError = getOptionalDiaryHoursError(personnelHours);
  const plantHoursError = getOptionalDiaryHoursError(plantHours, 'Hours operated');
  const editingMode = initialPersonnelData ? 'personnel' : initialPlantData ? 'plant' : null;
  const title =
    editingMode === 'personnel'
      ? 'Edit Personnel'
      : editingMode === 'plant'
        ? 'Edit Plant'
        : 'Add Labour / Plant';

  useEffect(() => {
    if (!isOpen) return;

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
  }, [defaultLotId, initialPersonnelData, initialPlantData, isOpen]);

  const handleSavePersonnel = async () => {
    if (!personnelName.trim() || personnelHoursError || savingPersonnel) return;
    const parsedPersonnelHours = parseOptionalDiaryHoursInput(personnelHours);
    setSavingPersonnel(true);
    try {
      await onSavePersonnel({
        name: personnelName.trim(),
        company: personnelCompany || undefined,
        role: personnelRole || undefined,
        hours: parsedPersonnelHours ?? undefined,
        lotId: personnelLotId || undefined,
      });
      trigger('success');
      setPersonnelName('');
      setPersonnelCompany('');
      setPersonnelRole('');
      setPersonnelHours('');
      if (editingMode) onClose();
    } catch {
      trigger('error');
    } finally {
      setSavingPersonnel(false);
    }
  };

  const handleSavePlant = async () => {
    if (!plantDescription.trim() || plantHoursError || savingPlant) return;
    const parsedPlantHours = parseOptionalDiaryHoursInput(plantHours);
    setSavingPlant(true);
    try {
      await onSavePlant({
        description: plantDescription.trim(),
        idRego: plantIdRego || undefined,
        company: plantCompany || undefined,
        hoursOperated: parsedPlantHours ?? undefined,
        lotId: plantLotId || undefined,
      });
      trigger('success');
      setPlantDescription('');
      setPlantIdRego('');
      setPlantCompany('');
      setPlantHours('');
      if (editingMode) onClose();
    } catch {
      trigger('error');
    } finally {
      setSavingPlant(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
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
