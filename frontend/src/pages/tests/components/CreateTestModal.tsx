import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Lot, CreateTestFormData } from '../types';
import { stateTestMethods, stateSpecRefs, INITIAL_FORM_DATA } from '../constants';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useLotItpTestItems } from '../hooks/useLotItpTestItems';

const createTestSchema = z.object({
  testType: z.string().trim().min(1, 'Test type is required'),
  testMethod: z.string().trim(),
  testRequestNumber: z.string().trim(),
  laboratoryName: z.string().trim(),
  laboratoryReportNumber: z.string().trim(),
  nataSiteNumber: z.string().trim(),
  sampleLocation: z.string().trim(),
  sampleDepth: z.string().trim(),
  materialType: z.string().trim(),
  layerLift: z.string().trim(),
  sampledBy: z.string().trim(),
  sampleDate: z.string().trim(),
  testDate: z.string().trim(),
  resultDate: z.string().trim(),
  lotId: z.string().trim(),
  resultValue: z.string().trim(),
  resultUnit: z.string().trim(),
  specificationMin: z.string().trim(),
  specificationMax: z.string().trim(),
  specificationRef: z.string().trim(),
  passFail: z.string().trim(),
});

type CreateTestFormDataSchema = z.infer<typeof createTestSchema>;

const OTHER_TEST_TYPE = '__other__';

const todayKey = () => new Date().toISOString().slice(0, 10);

interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (formData: CreateTestFormData) => Promise<void>;
  lots: Lot[];
  projectState: string;
  /** Prefill some fields (e.g. from an ITP-item "add test" entry point). */
  initialValues?: Partial<CreateTestFormData>;
  /**
   * When set, this test is being created to satisfy a specific ITP checklist
   * item. The picker is hidden (a banner names the item) and the item id is
   * always sent on submit.
   */
  satisfiesItem?: { id: string; description: string } | null;
}

export const CreateTestModal = React.memo(function CreateTestModal({
  isOpen,
  onClose,
  onSuccess,
  lots,
  projectState,
  initialValues,
  satisfiesItem,
}: CreateTestModalProps) {
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const creatingRef = useRef(false);

  // ITP-item picker state (essentials → Test Type). `selectedItpItemId` is the
  // chosen requirement; `manualTestType` means the user picked "Something else"
  // and wants the free-text input instead.
  const [selectedItpItemId, setSelectedItpItemId] = useState<string | null>(null);
  const [manualTestType, setManualTestType] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTestFormDataSchema>({
    resolver: zodResolver(createTestSchema),
    mode: 'onBlur',
    defaultValues: { ...INITIAL_FORM_DATA },
  });

  const lotId = watch('lotId');
  const { items: itpTestItems } = useLotItpTestItems(lotId);

  useEffect(() => {
    if (isOpen) {
      reset({ ...INITIAL_FORM_DATA, sampleDate: todayKey(), ...initialValues });
      setSelectedItpItemId(null);
      setManualTestType(false);
      setFormError(null);
    }
    // Only re-seed when the modal opens; `initialValues`/`satisfiesItem` are
    // treated as the values captured at open time (parent supplies stable refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset]);

  const onFormSubmit = useCallback(
    async (data: CreateTestFormDataSchema) => {
      if (creatingRef.current) return;

      creatingRef.current = true;
      setCreating(true);
      setFormError(null);
      try {
        const itpItemId = satisfiesItem?.id ?? selectedItpItemId ?? undefined;
        await onSuccess({
          ...(data as CreateTestFormData),
          ...(itpItemId ? { itpChecklistItemId: itpItemId } : {}),
        });
        reset({ ...INITIAL_FORM_DATA, sampleDate: todayKey() });
        setSelectedItpItemId(null);
        setManualTestType(false);
      } catch (err) {
        setFormError(extractErrorMessage(err, 'Failed to create test result.'));
      } finally {
        creatingRef.current = false;
        setCreating(false);
      }
    },
    [onSuccess, reset, satisfiesItem, selectedItpItemId],
  );

  const handleClose = useCallback(() => {
    reset({ ...INITIAL_FORM_DATA, sampleDate: todayKey() });
    setSelectedItpItemId(null);
    setManualTestType(false);
    setFormError(null);
    onClose();
  }, [onClose, reset]);

  // Picker is only useful when a lot is chosen, that lot has test-required ITP
  // items, and we're not already locked to a satisfiesItem.
  const showItpPicker = !satisfiesItem && Boolean(lotId) && itpTestItems.length > 0;
  // Free-text Test Type shows for the satisfiesItem flow, the no-picker case, or
  // when the user explicitly picked "Something else".
  const showFreeTextTestType = Boolean(satisfiesItem) || !showItpPicker || manualTestType;

  const handleItpPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === '') {
        setSelectedItpItemId(null);
        setManualTestType(false);
        setValue('testType', '');
        return;
      }
      if (val === OTHER_TEST_TYPE) {
        setSelectedItpItemId(null);
        setManualTestType(true);
        setValue('testType', '');
        return;
      }
      const item = itpTestItems.find((i) => i.id === val);
      setSelectedItpItemId(val);
      setManualTestType(false);
      setValue('testType', item?.testType || item?.description || '');
    },
    [itpTestItems, setValue],
  );

  const footer = (
    <>
      <Button variant="outline" type="button" onClick={handleClose}>
        Cancel
      </Button>
      <Button type="submit" form="create-test-form" disabled={creating}>
        {creating ? 'Creating...' : 'Create Test Result'}
      </Button>
    </>
  );

  return (
    <ResponsiveSheet
      open={isOpen}
      onClose={handleClose}
      title="Add Test Result"
      footer={footer}
      className="max-w-lg"
    >
      {formError && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {formError}
        </div>
      )}
      {satisfiesItem && (
        <div
          className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground"
          role="status"
        >
          This test will satisfy: <span className="font-medium">{satisfiesItem.description}</span>
        </div>
      )}
      <form id="create-test-form" onSubmit={handleSubmit(onFormSubmit)}>
        <div className="space-y-4">
          {/* Essentials — always visible */}
          <div>
            <Label htmlFor="test-lot-id">Link to Lot</Label>
            <NativeSelect id="test-lot-id" {...register('lotId')}>
              <option value="">No lot linked</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="test-type">Test Type *</Label>
            {showItpPicker && (
              <NativeSelect
                id="itp-item-picker"
                aria-label="Test Type"
                value={manualTestType ? OTHER_TEST_TYPE : (selectedItpItemId ?? '')}
                onChange={handleItpPickerChange}
              >
                <option value="">Select the requirement this test satisfies…</option>
                {itpTestItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description}
                    {item.testType ? ` — ${item.testType}` : ''}
                  </option>
                ))}
                <option value={OTHER_TEST_TYPE}>Something else (enter manually)</option>
              </NativeSelect>
            )}
            {showFreeTextTestType && (
              <>
                <Input
                  id="test-type"
                  type="text"
                  {...register('testType')}
                  placeholder="e.g., Compaction, CBR, Grading"
                  className={`${errors.testType ? 'border-destructive' : ''} ${
                    showItpPicker ? 'mt-2' : ''
                  }`}
                  list="test-types"
                />
                <datalist id="test-types">
                  <optgroup label="Compaction/Density">
                    <option value="Density Ratio" />
                    <option value="Dry Density Ratio" />
                    <option value="Field Density Nuclear" />
                    <option value="Field Density Sand" />
                    <option value="MDD Standard" />
                    <option value="MDD Modified" />
                    <option value="Hilf Rapid" />
                  </optgroup>
                  <optgroup label="Strength">
                    <option value="CBR Laboratory" />
                    <option value="CBR 4Day Soaked" />
                    <option value="CBR Field DCP" />
                    <option value="UCS" />
                  </optgroup>
                  <optgroup label="Classification">
                    <option value="Particle Size Distribution" />
                    <option value="Liquid Limit" />
                    <option value="Plastic Limit" />
                    <option value="Plasticity Index" />
                    <option value="Linear Shrinkage" />
                    <option value="Moisture Content" />
                  </optgroup>
                  <optgroup label="Aggregate">
                    <option value="Flakiness Index" />
                    <option value="Los Angeles Abrasion" />
                    <option value="Aggregate Crushing Value" />
                    <option value="Wet Dry Strength" />
                  </optgroup>
                  <optgroup label="Concrete">
                    <option value="Concrete Slump" />
                    <option value="Concrete Strength" />
                  </optgroup>
                  <optgroup label="Asphalt">
                    <option value="Asphalt Density" />
                  </optgroup>
                </datalist>
              </>
            )}
            {errors.testType && (
              <p className="text-sm text-destructive mt-1" role="alert">
                {errors.testType.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="sample-location">Sample Location</Label>
            <Input
              id="sample-location"
              type="text"
              {...register('sampleLocation')}
              placeholder="e.g., CH 1000+50, 2m LHS"
            />
          </div>

          <div>
            <Label htmlFor="sample-date">Sample Date</Label>
            <Input id="sample-date" type="date" {...register('sampleDate')} />
          </div>

          {/* Lab & sample details — collapsed by default */}
          <Accordion type="single" collapsible>
            <AccordionItem value="details">
              <AccordionTrigger>Add lab &amp; sample details</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="test-method">Test Method/Standard</Label>
                    <Input
                      id="test-method"
                      type="text"
                      {...register('testMethod')}
                      placeholder="e.g., AS 1289.5.4.1, TfNSW T111, TMR Q114A"
                      list="test-methods"
                    />
                    <datalist id="test-methods">
                      <optgroup label="Australian Standards">
                        <option value="AS 1289.2.1.1" />
                        <option value="AS 1289.3.1.1" />
                        <option value="AS 1289.3.2.1" />
                        <option value="AS 1289.3.3.1" />
                        <option value="AS 1289.3.4.1" />
                        <option value="AS 1289.5.1.1" />
                        <option value="AS 1289.5.2.1" />
                        <option value="AS 1289.5.3.1" />
                        <option value="AS 1289.5.4.1" />
                        <option value="AS 1289.5.7.1" />
                        <option value="AS 1289.5.8.1" />
                        <option value="AS 1289.6.1.1" />
                        <option value="AS 1289.6.7.1" />
                        <option value="AS 1141.11" />
                        <option value="AS 1141.15" />
                        <option value="AS 1141.23" />
                      </optgroup>
                      {stateTestMethods[projectState] && (
                        <optgroup label={stateTestMethods[projectState].label}>
                          {stateTestMethods[projectState].methods.map((method) => (
                            <option key={method} value={method} />
                          ))}
                        </optgroup>
                      )}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="test-request-number">Test Request Number</Label>
                      <Input
                        id="test-request-number"
                        type="text"
                        {...register('testRequestNumber')}
                        placeholder="e.g., TR-001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="laboratory-report-number">Lab Report Number</Label>
                      <Input
                        id="laboratory-report-number"
                        type="text"
                        {...register('laboratoryReportNumber')}
                        placeholder="e.g., LAB-2024-0001"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="laboratory-name">Laboratory Name</Label>
                      <Input
                        id="laboratory-name"
                        type="text"
                        {...register('laboratoryName')}
                        placeholder="e.g., ABC Testing Labs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nata-site-number">NATA Site Number</Label>
                      <Input
                        id="nata-site-number"
                        type="text"
                        {...register('nataSiteNumber')}
                        placeholder="e.g., 12345"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="material-type">Material Type</Label>
                    <NativeSelect id="material-type" {...register('materialType')}>
                      <option value="">Select material type</option>
                      <optgroup label="Fill Materials">
                        <option value="general_fill">General Fill</option>
                        <option value="select_fill">Select Fill</option>
                        <option value="structural_fill">Structural Fill</option>
                        <option value="rock_fill">Rock Fill</option>
                      </optgroup>
                      <optgroup label="Pavement Materials">
                        <option value="subgrade">Subgrade</option>
                        <option value="subbase">Subbase</option>
                        <option value="base">Base Course</option>
                        <option value="dgb20">DGB20</option>
                        <option value="dgs20">DGS20</option>
                        <option value="fcr">FCR (Fine Crushed Rock)</option>
                      </optgroup>
                      <optgroup label="Drainage">
                        <option value="drainage_10mm">Drainage Aggregate 10mm</option>
                        <option value="drainage_14mm">Drainage Aggregate 14mm</option>
                        <option value="drainage_20mm">Drainage Aggregate 20mm</option>
                        <option value="filter_sand">Filter Sand</option>
                      </optgroup>
                      <optgroup label="Stabilised">
                        <option value="lime_treated">Lime Treated</option>
                        <option value="cement_treated">Cement Treated</option>
                      </optgroup>
                      <optgroup label="Concrete">
                        <option value="concrete">Concrete</option>
                        <option value="lean_mix">Lean Mix Concrete</option>
                      </optgroup>
                      <optgroup label="Asphalt">
                        <option value="asphalt">Asphalt</option>
                      </optgroup>
                    </NativeSelect>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sample-depth">Sample Depth</Label>
                      <NativeSelect id="sample-depth" {...register('sampleDepth')}>
                        <option value="">Select depth</option>
                        <option value="surface">Surface</option>
                        <option value="0-150">0-150mm</option>
                        <option value="150-300">150-300mm</option>
                        <option value="300-450">300-450mm</option>
                        <option value="450-600">450-600mm</option>
                        <option value="other">Other (specify in notes)</option>
                      </NativeSelect>
                    </div>
                    <div>
                      <Label htmlFor="layer-lift">Layer/Lift</Label>
                      <NativeSelect id="layer-lift" {...register('layerLift')}>
                        <option value="">N/A</option>
                        <option value="1">Layer 1</option>
                        <option value="2">Layer 2</option>
                        <option value="3">Layer 3</option>
                        <option value="4">Layer 4</option>
                        <option value="5">Layer 5</option>
                      </NativeSelect>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sampled-by">Sampled By</Label>
                    <Input
                      id="sampled-by"
                      type="text"
                      {...register('sampledBy')}
                      placeholder="Technician name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="test-date">Test Date</Label>
                      <Input id="test-date" type="date" {...register('testDate')} />
                    </div>
                    <div>
                      <Label htmlFor="result-date">Result Date</Label>
                      <Input id="result-date" type="date" {...register('resultDate')} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="specification-ref">Specification Reference</Label>
                    <Input
                      id="specification-ref"
                      type="text"
                      {...register('specificationRef')}
                      placeholder="e.g., TfNSW R44 Table 10, MRTS04 Cl.5.3, AS 3798"
                      list="spec-refs"
                    />
                    <datalist id="spec-refs">
                      <optgroup label="National">
                        <option value="AS 3798" />
                        <option value="Austroads" />
                      </optgroup>
                      {stateSpecRefs[projectState] && (
                        <optgroup label={stateSpecRefs[projectState].label}>
                          {stateSpecRefs[projectState].specs.map((spec) => (
                            <option key={spec} value={spec} />
                          ))}
                        </optgroup>
                      )}
                    </datalist>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </form>
    </ResponsiveSheet>
  );
});
