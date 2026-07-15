import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalDescription,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { Lot } from '../lotsPageTypes';
import { logError } from '@/lib/logger';
import {
  CHAINAGE_MAX,
  CHAINAGE_MIN,
  CREATE_LOT_ACTIVITY_TYPES,
  CREATE_LOT_DEFAULT_VALUES,
  LOT_NUMBER_MAX_LENGTH,
  LOT_NUMBER_MIN_LENGTH,
  createLotSchema,
  parseBudgetAmountInput,
  parseChainageInput,
  type CreateLotFormData,
} from './createLotForm';

interface CreateLotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lot: Lot) => void;
  projectId: string;
  canViewBudgets: boolean;
  initialActivityType?: string;
}

interface ItpTemplateOption {
  id: string;
  name: string;
  activityType?: string | null;
  isActive?: boolean;
}

const getInitialFormValues = (initialActivityType?: string): CreateLotFormData => ({
  ...CREATE_LOT_DEFAULT_VALUES,
  activityType:
    initialActivityType &&
    (CREATE_LOT_ACTIVITY_TYPES as readonly string[]).includes(initialActivityType)
      ? initialActivityType
      : CREATE_LOT_DEFAULT_VALUES.activityType,
});

export function CreateLotModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  canViewBudgets,
  initialActivityType,
}: CreateLotModalProps) {
  const [creating, setCreating] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // ITP template suggestion state
  const [itpTemplates, setItpTemplates] = useState<ItpTemplateOption[]>([]);
  const [suggestedTemplate, setSuggestedTemplate] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateLotFormData>({
    resolver: zodResolver(createLotSchema),
    mode: 'onBlur',
    defaultValues: getInitialFormValues(initialActivityType),
  });

  const activityType = watch('activityType');

  const resetFormState = useCallback(() => {
    reset(getInitialFormValues(initialActivityType));
    setSuggestedTemplate(null);
    setSelectedTemplateId('');
    setLookupError(null);
  }, [initialActivityType, reset]);

  const fetchLookupData = useCallback(async () => {
    setLoadingLookups(true);
    setLookupError(null);
    try {
      const encodedProjectId = encodeURIComponent(projectId);
      const [lotData, itpData] = await Promise.all([
        apiFetch<{ suggestedNumber?: string }>(
          `/api/lots/suggest-number?projectId=${encodedProjectId}`,
        ),
        apiFetch<{ templates: ItpTemplateOption[] }>(
          `/api/itp/templates?projectId=${encodedProjectId}&includeGlobal=true&activeOnly=true`,
        ),
      ]);

      if (lotData.suggestedNumber) {
        setValue('lotNumber', lotData.suggestedNumber);
      }

      const templates = itpData.templates || [];
      setItpTemplates(templates.filter((t) => t.isActive !== false));
      const suggested = templates.find(
        (t) => t.activityType?.toLowerCase() === 'earthworks' && t.isActive !== false,
      );
      if (suggested) {
        setSuggestedTemplate({ id: suggested.id, name: suggested.name });
        setSelectedTemplateId(suggested.id);
      }
    } catch (err) {
      logError('Failed to fetch lot data:', err);
      setLookupError(extractErrorMessage(err, 'Could not load lot suggestions.'));
    } finally {
      setLoadingLookups(false);
    }
  }, [projectId, setValue]);

  // Update suggested ITP template when activity type changes
  useEffect(() => {
    const suggested = itpTemplates.find(
      (t) => t.activityType?.toLowerCase() === activityType.toLowerCase(),
    );
    if (suggested) {
      setSuggestedTemplate({ id: suggested.id, name: suggested.name });
      setSelectedTemplateId(suggested.id);
    } else {
      setSuggestedTemplate(null);
      setSelectedTemplateId('');
    }
  }, [activityType, itpTemplates]);

  // Fetch data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    resetFormState();
    void fetchLookupData();
  }, [isOpen, resetFormState, fetchLookupData]);

  const handleClose = () => {
    setSuggestedTemplate(null);
    setSelectedTemplateId('');
    setLookupError(null);
    reset();
    onClose();
  };

  const onFormSubmit = async (formData: CreateLotFormData) => {
    if (creating) return;

    setCreating(true);

    try {
      const chainageStart = parseChainageInput(formData.chainageStart);
      const chainageEnd = parseChainageInput(formData.chainageEnd);
      const budgetAmount = canViewBudgets ? parseBudgetAmountInput(formData.budgetAmount) : null;

      const data = await apiFetch<{ lot: Lot }>('/api/lots', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          lotNumber: formData.lotNumber,
          description: formData.description || null,
          activityType: formData.activityType,
          chainageStart,
          chainageEnd,
          ...(canViewBudgets && budgetAmount !== null ? { budgetAmount } : {}),
          itpTemplateId: selectedTemplateId || null,
        }),
      });

      const createdLot: Lot = {
        ...data.lot,
        activityType: formData.activityType,
        chainageStart,
        chainageEnd,
      };

      const assignedTemplate = selectedTemplateId
        ? itpTemplates.find((t) => t.id === selectedTemplateId)
        : null;

      toast({
        title: 'Lot Created',
        description: assignedTemplate
          ? `Lot ${formData.lotNumber} created with ITP template "${assignedTemplate.name}"`
          : `Lot ${formData.lotNumber} has been created successfully`,
        variant: 'success',
      });

      onSuccess(createdLot);
    } catch (err) {
      const message = handleApiError(err, 'Failed to create lot');
      setError('root', { message });
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Create New Lot</ModalHeader>
      <ModalDescription>
        Add the lot details and an optional ITP template. Assign subcontractors from the lot page
        once it exists.
      </ModalDescription>
      <ModalBody>
        <form id="create-lot-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4">
            {loadingLookups && (
              <div
                className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
                role="status"
              >
                Loading lot suggestions...
              </div>
            )}
            {lookupError && (
              <div
                className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground"
                role="alert"
              >
                <p>{lookupError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 border-warning/40 bg-card text-warning-foreground hover:bg-warning/10"
                  onClick={() => void fetchLookupData()}
                  disabled={loadingLookups}
                >
                  Try again
                </Button>
              </div>
            )}
            {errors.root?.message && (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                role="alert"
              >
                {errors.root.message}
              </p>
            )}
            <div>
              <Label htmlFor="lot-number">
                Lot Number <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({LOT_NUMBER_MIN_LENGTH}-{LOT_NUMBER_MAX_LENGTH} chars)
                </span>
              </Label>
              <Input
                id="lot-number"
                type="text"
                {...register('lotNumber')}
                maxLength={LOT_NUMBER_MAX_LENGTH}
                className={errors.lotNumber ? 'border-destructive mt-1' : 'mt-1'}
                placeholder="e.g., LOT-001"
              />
              {errors.lotNumber && (
                <p className="text-sm text-destructive mt-1" role="alert" aria-live="assertive">
                  {errors.lotNumber.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="lot-description">Description</Label>
              <Input
                id="lot-description"
                type="text"
                {...register('description')}
                className="mt-1"
                placeholder="Optional description"
              />
            </div>

            <div>
              <Label htmlFor="lot-activity">Activity Type</Label>
              <NativeSelect id="lot-activity" {...register('activityType')} className="mt-1">
                <option value="Earthworks">Earthworks</option>
                {CREATE_LOT_ACTIVITY_TYPES.filter((type) => type !== 'Earthworks').map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* ITP Template suggestion */}
            {suggestedTemplate && (
              <div className="rounded-lg border border-primary bg-primary/5 p-3">
                <p className="text-sm text-primary">
                  <span className="font-medium">Suggested ITP Template:</span>{' '}
                  {suggestedTemplate.name}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use-suggested-itp"
                    checked={selectedTemplateId === suggestedTemplate.id}
                    onChange={(e) =>
                      setSelectedTemplateId(e.target.checked ? suggestedTemplate.id : '')
                    }
                    className="h-4 w-4 rounded border-border accent-primary focus:ring-primary"
                  />
                  <label htmlFor="use-suggested-itp" className="text-sm text-primary">
                    Assign this ITP template to the lot
                  </label>
                </div>
              </div>
            )}

            {/* ITP template dropdown for manual selection */}
            <div>
              <Label htmlFor="lot-itp-template">ITP Template (Optional)</Label>
              <NativeSelect
                id="lot-itp-template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="mt-1"
              >
                <option value="">No ITP template</option>
                {itpTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.activityType})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="chainage-start">Chainage Start</Label>
                <Input
                  id="chainage-start"
                  type="number"
                  {...register('chainageStart')}
                  min={CHAINAGE_MIN}
                  max={CHAINAGE_MAX}
                  step="any"
                  className={errors.chainageStart ? 'border-destructive mt-1' : 'mt-1'}
                  placeholder="e.g., 0"
                />
                {errors.chainageStart && (
                  <p className="text-sm text-destructive mt-1" role="alert" aria-live="assertive">
                    {errors.chainageStart.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="chainage-end">Chainage End</Label>
                <Input
                  id="chainage-end"
                  type="number"
                  {...register('chainageEnd')}
                  min={CHAINAGE_MIN}
                  max={CHAINAGE_MAX}
                  step="any"
                  className={errors.chainageEnd ? 'border-destructive mt-1' : 'mt-1'}
                  placeholder="e.g., 100"
                />
                {errors.chainageEnd && (
                  <p className="text-sm text-destructive mt-1" role="alert" aria-live="assertive">
                    {errors.chainageEnd.message}
                  </p>
                )}
              </div>
            </div>

            {canViewBudgets && (
              <div>
                <Label htmlFor="lot-budget">Budget Amount ($)</Label>
                <Input
                  id="lot-budget"
                  type="number"
                  {...register('budgetAmount')}
                  min={0}
                  step="0.01"
                  className={errors.budgetAmount ? 'border-destructive mt-1' : 'mt-1'}
                  placeholder="Optional lot value"
                />
                {errors.budgetAmount && (
                  <p className="text-sm text-destructive mt-1" role="alert" aria-live="assertive">
                    {errors.budgetAmount.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
        <Button type="submit" form="create-lot-form" disabled={creating}>
          {creating ? 'Creating...' : 'Create Lot'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
