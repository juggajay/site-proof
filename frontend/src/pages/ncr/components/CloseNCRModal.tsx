import { memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NCR } from '../types';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NCREvidenceList } from './NCREvidenceList';

const closeNCRSchema = z.object({
  verificationNotes: z.string().trim().optional().default(''),
  lessonsLearned: z.string().trim().optional().default(''),
});

type CloseNCRFormData = z.infer<typeof closeNCRSchema>;

interface CloseNCRModalProps {
  isOpen: boolean;
  ncr: NCR | null;
  onClose: () => void;
  onSubmit: (ncrId: string, data: { verificationNotes: string; lessonsLearned: string }) => void;
  loading: boolean;
}

function CloseNCRModalInner({ isOpen, ncr, onClose, onSubmit, loading }: CloseNCRModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CloseNCRFormData>({
    resolver: zodResolver(closeNCRSchema),
    mode: 'onBlur',
    defaultValues: {
      verificationNotes: '',
      lessonsLearned: '',
    },
  });

  const onFormSubmit = (data: CloseNCRFormData) => {
    if (!ncr) return;
    onSubmit(ncr.id, {
      verificationNotes: data.verificationNotes?.trim() ?? '',
      lessonsLearned: data.lessonsLearned?.trim() ?? '',
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen || !ncr) return null;

  const footer = (
    <>
      <Button type="button" variant="outline" className="min-h-[44px]" onClick={handleClose}>
        Cancel
      </Button>
      <Button
        type="submit"
        form="close-ncr-form"
        variant="success"
        className="min-h-[44px]"
        disabled={loading}
      >
        {loading ? 'Closing...' : 'Close NCR'}
      </Button>
    </>
  );

  return (
    <ResponsiveSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={`Close NCR ${ncr.ncrNumber}`}
      footer={footer}
      className="max-w-lg"
    >
      {ncr.severity === 'major' && ncr.qmApprovedAt && (
        <div className="mb-4 bg-success/10 border border-success/30 text-success px-3 py-2 rounded-lg text-sm">
          QM Approval granted by {ncr.qmApprovedBy?.fullName || 'Quality Manager'}
        </div>
      )}

      <div className="mb-4">
        <NCREvidenceList
          evidence={ncr.ncrEvidence ?? []}
          emptyLabel="No rectification evidence has been uploaded yet."
        />
      </div>

      <form id="close-ncr-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <Label>Verification Notes</Label>
          <Textarea
            {...register('verificationNotes')}
            className={errors.verificationNotes ? 'border-destructive mt-1' : 'mt-1'}
            rows={3}
            placeholder="Notes about the verification and closure..."
          />
          {errors.verificationNotes && (
            <p className="text-sm text-destructive mt-1" role="alert">
              {errors.verificationNotes.message}
            </p>
          )}
        </div>
        {/* Feature #474: Lessons Learned Recording */}
        <div>
          <Label>Lessons Learned</Label>
          <Textarea
            {...register('lessonsLearned')}
            className={errors.lessonsLearned ? 'border-destructive mt-1' : 'mt-1'}
            rows={3}
            placeholder="What lessons can be learned from this NCR? How can similar issues be prevented in the future?"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Document insights for continuous improvement and future reference.
          </p>
        </div>
      </form>
    </ResponsiveSheet>
  );
}

export const CloseNCRModal = memo(CloseNCRModalInner);
