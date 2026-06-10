import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TestResult } from '../types';
import { calculatePassFail, hasRecordedResult } from '../constants';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import { extractErrorMessage } from '@/lib/errorHandling';

// Ticket T2: the values the Enter Results action records. These mirror the
// result-entry fields already collected in CreateTestModal (no new fields), so a
// test created without a result — or moved through the lab states — can have its
// actual result + pass/fail captured before it becomes 'entered'.
export interface EnterResultsValues {
  resultValue: string;
  resultUnit: string;
  specificationMin: string;
  specificationMax: string;
  passFail: string;
}

const enterResultsSchema = z.object({
  resultValue: z.string().trim(),
  resultUnit: z.string().trim(),
  specificationMin: z.string().trim(),
  specificationMax: z.string().trim(),
  passFail: z.string().trim(),
});

type EnterResultsSchema = z.infer<typeof enterResultsSchema>;

interface EnterResultsModalProps {
  isOpen: boolean;
  test: TestResult | null;
  onClose: () => void;
  // Records the result on the test, then advances it to 'entered'. The parent
  // owns the PATCH + status POST + list refresh; this component owns the form.
  onSubmit: (testId: string, values: EnterResultsValues) => Promise<void>;
}

const toInputString = (value: number | null | undefined): string =>
  value == null ? '' : String(value);

// Ticket T2: replaces the old no-data "Enter Results" click (which flipped a
// blank test to 'entered'). The action now opens this form, requires a real
// result value + pass/fail outcome (mirroring the backend RESULT_REQUIRED gate),
// and only then advances the test to 'entered'. Reuses CreateTestModal's
// result-entry fields and its auto-calculated pass/fail behaviour.
//
// PR-L: converted from Modal to ResponsiveSheet so field staff get a native
// bottom-sheet on mobile (the most-used field action, audit finding #9).
// All form logic/validation/mutations are preserved.
export const EnterResultsModal = React.memo(function EnterResultsModal({
  isOpen,
  test,
  onClose,
  onSubmit,
}: EnterResultsModalProps) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const { register, handleSubmit, reset, watch, setValue } = useForm<EnterResultsSchema>({
    resolver: zodResolver(enterResultsSchema),
    mode: 'onBlur',
    defaultValues: {
      resultValue: '',
      resultUnit: '',
      specificationMin: '',
      specificationMax: '',
      passFail: 'pending',
    },
  });

  const resultValue = watch('resultValue');
  const specificationMin = watch('specificationMin');
  const specificationMax = watch('specificationMax');
  const passFail = watch('passFail');

  // Seed the form from the existing test each time it opens.
  useEffect(() => {
    if (isOpen && test) {
      reset({
        resultValue: toInputString(test.resultValue),
        resultUnit: test.resultUnit ?? '',
        specificationMin: toInputString(test.specificationMin),
        specificationMax: toInputString(test.specificationMax),
        passFail: test.passFail || 'pending',
      });
      setFormError(null);
    }
  }, [isOpen, test, reset]);

  // Auto-calculate pass/fail when result value or spec bounds change.
  useEffect(() => {
    const newPassFail = calculatePassFail(resultValue, specificationMin, specificationMax);
    if (newPassFail !== 'pending' && newPassFail !== passFail) {
      setValue('passFail', newPassFail);
    }
  }, [resultValue, specificationMin, specificationMax, setValue, passFail]);

  // Mirror the backend RESULT_REQUIRED gate so submit is blocked client-side.
  const resultRecorded = hasRecordedResult({
    resultValue: resultValue.trim() === '' ? null : Number(resultValue),
    passFail,
  });

  const onFormSubmit = useCallback(
    async (data: EnterResultsSchema) => {
      if (!test || savingRef.current) return;

      savingRef.current = true;
      setSaving(true);
      setFormError(null);
      try {
        await onSubmit(test.id, data);
        onClose();
      } catch (err) {
        setFormError(extractErrorMessage(err, 'Failed to record results.'));
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [test, onSubmit, onClose],
  );

  const handleClose = useCallback(() => {
    setFormError(null);
    onClose();
  }, [onClose]);

  const footer = (
    <>
      <Button variant="outline" type="button" onClick={handleClose} className="min-h-[44px]">
        Cancel
      </Button>
      <Button
        type="submit"
        form="enter-results-form"
        disabled={saving || !resultRecorded}
        className="min-h-[44px]"
      >
        {saving ? 'Saving...' : 'Save & Enter Results'}
      </Button>
    </>
  );

  return (
    <ResponsiveSheet
      open={isOpen && test !== null}
      onClose={handleClose}
      title="Enter Results"
      footer={footer}
      className="max-w-lg"
    >
      <p className="text-sm text-muted-foreground mb-4">
        Record the result value and pass/fail outcome
        {test ? ` for ${test.testType}` : ''}. A result and a definitive pass/fail are required
        before this test can be entered and verified.
      </p>
      {formError && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {formError}
        </div>
      )}
      <form id="enter-results-form" onSubmit={handleSubmit(onFormSubmit)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="enter-result-value">Result Value *</Label>
              <Input
                id="enter-result-value"
                type="number"
                step="any"
                className="min-h-[44px]"
                {...register('resultValue')}
                placeholder="e.g., 98.5"
              />
            </div>
            <div>
              <Label htmlFor="enter-result-unit">Unit</Label>
              <Input
                id="enter-result-unit"
                type="text"
                className="min-h-[44px]"
                {...register('resultUnit')}
                placeholder="e.g., %"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="enter-spec-min">Spec Min</Label>
              <Input
                id="enter-spec-min"
                type="number"
                step="any"
                className="min-h-[44px]"
                {...register('specificationMin')}
                placeholder="e.g., 95"
              />
            </div>
            <div>
              <Label htmlFor="enter-spec-max">Spec Max</Label>
              <Input
                id="enter-spec-max"
                type="number"
                step="any"
                className="min-h-[44px]"
                {...register('specificationMax')}
                placeholder="e.g., 100"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="enter-pass-fail">
              Pass/Fail Status *
              {resultValue && (specificationMin || specificationMax) && (
                <span className="ml-2 text-xs text-muted-foreground">(auto-calculated)</span>
              )}
            </Label>
            <NativeSelect
              id="enter-pass-fail"
              {...register('passFail')}
              className={
                passFail === 'pass'
                  ? 'border-success bg-success/10 min-h-[44px]'
                  : passFail === 'fail'
                    ? 'border-destructive bg-destructive/10 min-h-[44px]'
                    : 'min-h-[44px]'
              }
            >
              <option value="pending">Pending</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </NativeSelect>
            {!resultRecorded && (
              <p className="mt-1 text-xs text-muted-foreground">
                Enter a result value and choose Pass or Fail to continue.
              </p>
            )}
          </div>
        </div>
      </form>
    </ResponsiveSheet>
  );
});
