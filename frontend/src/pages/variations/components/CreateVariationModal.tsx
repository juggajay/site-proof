import { memo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { Variation, VariationFormData, VariationLot } from '../types';

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || Number(value) > 0, 'Amount must be greater than zero')
  .refine(
    (value) => value === '' || /^\d+(?:\.\d{1,2})?$/.test(value),
    'Amount cannot have more than 2 decimal places',
  );

const variationFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().trim().max(5000, 'Description is too long').optional().default(''),
  clientReference: z
    .string()
    .trim()
    .max(200, 'Client reference is too long')
    .optional()
    .default(''),
  lotId: z.string().optional().default(''),
  approvedAmount: optionalAmountSchema.optional().default(''),
});

type VariationFormFields = z.infer<typeof variationFormSchema>;

const EMPTY_FORM: VariationFormFields = {
  title: '',
  description: '',
  clientReference: '',
  lotId: '',
  approvedAmount: '',
};

interface CreateVariationModalProps {
  isOpen: boolean;
  variation?: Variation | null;
  lots: VariationLot[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: VariationFormData) => void | Promise<void>;
}

function getDefaultValues(variation?: Variation | null): VariationFormFields {
  if (!variation) return EMPTY_FORM;

  return {
    title: variation.title,
    description: variation.description ?? '',
    clientReference: variation.clientReference ?? '',
    lotId: variation.lotId ?? '',
    approvedAmount: variation.approvedAmount == null ? '' : String(variation.approvedAmount),
  };
}

function CreateVariationModalInner({
  isOpen,
  variation,
  lots,
  loading,
  onClose,
  onSubmit,
}: CreateVariationModalProps) {
  const isEdit = Boolean(variation);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VariationFormFields>({
    resolver: zodResolver(variationFormSchema),
    mode: 'onBlur',
    defaultValues: getDefaultValues(variation),
  });

  useEffect(() => {
    if (isOpen) {
      reset(getDefaultValues(variation));
    }
  }, [isOpen, reset, variation]);

  const handleClose = () => {
    reset(getDefaultValues(variation));
    onClose();
  };

  const onFormSubmit = (data: VariationFormFields) => {
    void onSubmit({
      title: data.title.trim(),
      description: data.description.trim() || (isEdit ? null : undefined),
      clientReference: data.clientReference.trim() || (isEdit ? null : undefined),
      lotId: data.lotId || (isEdit ? null : undefined),
      approvedAmount: data.approvedAmount.trim()
        ? Number(data.approvedAmount)
        : isEdit
          ? null
          : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>{isEdit ? 'Edit Variation' : 'New Variation'}</ModalHeader>
      <ModalDescription>
        Capture changed or extra work so it can be submitted, approved, and claimed.
      </ModalDescription>
      <ModalBody>
        <form id="variation-form" className="space-y-4" onSubmit={handleSubmit(onFormSubmit)}>
          <div>
            <Label htmlFor="variation-title">Title *</Label>
            <Input
              id="variation-title"
              {...register('title')}
              className={errors.title ? 'mt-1 border-destructive' : 'mt-1'}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="variation-description">Description</Label>
            <Textarea
              id="variation-description"
              rows={4}
              {...register('description')}
              className={errors.description ? 'mt-1 border-destructive' : 'mt-1'}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.description.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="variation-client-reference">Client reference</Label>
            <Input
              id="variation-client-reference"
              {...register('clientReference')}
              className={errors.clientReference ? 'mt-1 border-destructive' : 'mt-1'}
            />
            {errors.clientReference && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.clientReference.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="variation-lot">Lot</Label>
            <NativeSelect id="variation-lot" {...register('lotId')} className="mt-1">
              <option value="">No linked lot</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                  {lot.description ? ` - ${lot.description}` : ''}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="variation-approved-amount">Amount (ex GST)</Label>
            <Input
              id="variation-approved-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              {...register('approvedAmount')}
              className={errors.approvedAmount ? 'mt-1 border-destructive' : 'mt-1'}
            />
            {errors.approvedAmount && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.approvedAmount.message}
              </p>
            )}
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button type="submit" form="variation-form" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Save Variation' : 'Create Variation'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export const CreateVariationModal = memo(CreateVariationModalInner);
