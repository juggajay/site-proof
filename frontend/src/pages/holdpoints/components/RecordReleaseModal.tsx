import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { HoldPoint } from '../types';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatDateKey } from '@/lib/localDate';

const recordReleaseSchema = z.object({
  releasedByName: z.string().trim().min(1, 'Name of person releasing is required'),
  releasedByOrg: z.string().trim().min(1, 'Organisation of person releasing is required'),
  releaseDate: z.string().trim().min(1, 'Release date is required'),
  releaseTime: z.string().trim().min(1, 'Release time is required'),
  releaseNotes: z.string().trim().optional().default(''),
  releaseMethod: z.enum(['digital', 'email', 'paper']),
});

type RecordReleaseFormData = z.infer<typeof recordReleaseSchema>;

interface RecordReleaseModalProps {
  holdPoint: HoldPoint;
  recording: boolean;
  error?: string | null;
  approvalRequirement?: 'any' | 'superintendent';
  onClose: () => void;
  onSubmit: (
    releasedByName: string,
    releasedByOrg: string,
    releaseDate: string,
    releaseTime: string,
    releaseNotes: string,
    releaseMethod: string,
    signatureDataUrl: string | null,
    evidenceFile: File | null,
  ) => void;
}

export function RecordReleaseModal({
  holdPoint,
  recording,
  error,
  approvalRequirement,
  onClose,
  onSubmit,
}: RecordReleaseModalProps) {
  const isMobile = useIsMobile();
  const [emailEvidenceFile, setEmailEvidenceFile] = useState<File | null>(null);
  const [paperEvidenceFile, setPaperEvidenceFile] = useState<File | null>(null);
  // Feature #884: Signature capture state
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    formState: { errors },
  } = useForm<RecordReleaseFormData>({
    resolver: zodResolver(recordReleaseSchema),
    mode: 'onBlur',
    defaultValues: {
      releasedByName: '',
      releasedByOrg: '',
      releaseDate: formatDateKey(),
      releaseTime: new Date().toTimeString().slice(0, 5),
      releaseNotes: '',
      releaseMethod: 'digital',
    },
  });

  const releaseMethod = watch('releaseMethod');
  const releasedByName = watch('releasedByName');
  const releasedByOrg = watch('releasedByOrg');

  useEffect(() => {
    if (releaseMethod !== 'digital' && signatureDataUrl) {
      setSignatureDataUrl(null);
    }
  }, [releaseMethod, signatureDataUrl]);

  const getEvidenceFileForMethod = (method: RecordReleaseFormData['releaseMethod']) => {
    if (method === 'email') return emailEvidenceFile;
    if (method === 'paper') return paperEvidenceFile;
    return null;
  };

  const handleFileChange =
    (method: Extract<RecordReleaseFormData['releaseMethod'], 'email' | 'paper'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        if (method === 'email') {
          setEmailEvidenceFile(e.target.files[0]);
        } else {
          setPaperEvidenceFile(e.target.files[0]);
        }
      }
    };

  const onFormSubmit = (data: RecordReleaseFormData) => {
    const evidenceFile = getEvidenceFileForMethod(data.releaseMethod);

    // Feature #884: Require signature for digital release
    if (data.releaseMethod === 'digital' && !signatureDataUrl) {
      toast({
        title: 'Signature required',
        description: 'Please provide your signature to release the hold point',
        variant: 'error',
      });
      return;
    }
    if ((data.releaseMethod === 'email' || data.releaseMethod === 'paper') && !evidenceFile) {
      toast({
        title: 'Release evidence required',
        description: 'Upload the email, form, or screenshot that proves the release was approved',
        variant: 'error',
      });
      return;
    }
    onSubmit(
      data.releasedByName.trim(),
      data.releasedByOrg.trim(),
      data.releaseDate.trim(),
      data.releaseTime.trim(),
      data.releaseNotes?.trim() || '',
      data.releaseMethod,
      data.releaseMethod === 'digital' ? signatureDataUrl : null,
      evidenceFile,
    );
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={recording}>
        Cancel
      </Button>
      <Button
        variant="success"
        type="submit"
        form="record-release-form"
        disabled={recording || !releasedByName?.trim() || !releasedByOrg?.trim()}
      >
        {recording ? 'Recording...' : 'Record Manual Release'}
      </Button>
    </>
  );

  return (
    <ResponsiveSheet
      open={true}
      onClose={onClose}
      title="Record Manual Hold Point Release"
      footer={footer}
      className="max-w-lg"
    >
      {/* Hold-point info summary */}
      <div className="mb-4 p-3 bg-muted rounded-lg">
        <div className="text-sm text-muted-foreground">Lot</div>
        <div className="font-medium">{holdPoint.lotNumber}</div>
        <div className="text-sm text-muted-foreground mt-2">Hold Point</div>
        <div className="font-medium">{holdPoint.description}</div>
      </div>

      {/* Feature #698 - Superintendent approval requirement notice */}
      {approvalRequirement === 'superintendent' && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Superintendent Approval Required</span>
          </div>
          <p className="text-xs text-warning mt-1">
            This project requires superintendent-level authorization to release hold points.
          </p>
        </div>
      )}

      {error && (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <form id="record-release-form" onSubmit={rhfHandleSubmit(onFormSubmit)} className="space-y-4">
        {/* Release Method Selection (Feature #185) */}
        <div>
          <Label>Release Method</Label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="digital"
                {...register('releaseMethod')}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">Digital (On-site)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="email"
                {...register('releaseMethod')}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">Email Confirmation</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="paper"
                {...register('releaseMethod')}
                className="w-4 h-4 text-primary"
              />
              <span className="text-sm">Paper Form</span>
            </label>
          </div>
        </div>

        <div>
          <Label>
            Releaser Name <span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            {...register('releasedByName')}
            className={errors.releasedByName ? 'border-destructive' : ''}
            placeholder="Enter name of person releasing"
          />
          {errors.releasedByName && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {errors.releasedByName.message}
            </p>
          )}
        </div>

        <div>
          <Label>
            Organisation <span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            {...register('releasedByOrg')}
            className={errors.releasedByOrg ? 'border-destructive' : ''}
            placeholder="Enter organisation (e.g., Superintendent's Rep)"
          />
          {errors.releasedByOrg && (
            <p className="mt-1 text-sm text-destructive" role="alert">
              {errors.releasedByOrg.message}
            </p>
          )}
        </div>

        {/* Date / time: full-width rows on mobile, side-by-side on desktop */}
        <div className={isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4'}>
          <div>
            <Label>Release Date</Label>
            <Input
              type="date"
              {...register('releaseDate')}
              className={errors.releaseDate ? 'border-destructive' : ''}
            />
            {errors.releaseDate && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.releaseDate.message}
              </p>
            )}
          </div>
          <div>
            <Label>Release Time</Label>
            <Input
              type="time"
              {...register('releaseTime')}
              className={errors.releaseTime ? 'border-destructive' : ''}
            />
            {errors.releaseTime && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {errors.releaseTime.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea
            {...register('releaseNotes')}
            rows={3}
            placeholder="Any additional notes about the release..."
          />
        </div>

        {/* Signature or Evidence based on method */}
        {releaseMethod === 'digital' ? (
          <div className="space-y-2">
            <Label>
              Digital Signature <span className="text-destructive">*</span>
            </Label>
            {/*
             * fullWidth=true: canvas stretches to sheet width so a finger can
             * draw a full-width stroke.  mobileHeight=160 ensures ≥160 px of
             * vertical signing room.
             *
             * The SignaturePad container stops pointer propagation when
             * fullWidth=true (see SignaturePad.tsx), so a downward signing
             * stroke never reaches the BottomSheet's panel onPointerDown handler
             * and does not trigger drag-to-dismiss.
             */}
            <SignaturePad
              onChange={setSignatureDataUrl}
              fullWidth={isMobile}
              width={380}
              height={150}
              mobileHeight={160}
              className={isMobile ? 'w-full' : 'mx-auto'}
            />
            <p className="text-xs text-muted-foreground">
              Draw your signature above to authorize this release
            </p>
          </div>
        ) : releaseMethod === 'email' ? (
          <div className="space-y-2">
            <Label>
              Email Evidence <span className="text-destructive">*</span>
            </Label>
            <div className="p-4 border border-dashed border-border rounded-lg bg-muted">
              <input
                type="file"
                accept=".pdf,.eml,.msg,.png,.jpg,.jpeg"
                onChange={handleFileChange('email')}
                className="w-full text-sm text-foreground min-h-[44px]"
                id="evidence-upload"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Upload email or screenshot as evidence (PDF, EML, MSG, PNG, JPG)
              </p>
              {emailEvidenceFile && (
                <div className="mt-2 p-2 bg-success/10 rounded text-sm text-success flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  <span>Selected: {emailEvidenceFile.name}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>
              Paper Form Evidence <span className="text-destructive">*</span>
            </Label>
            <div className="p-4 border border-dashed border-border rounded-lg bg-muted">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange('paper')}
                className="w-full text-sm text-foreground min-h-[44px]"
                id="paper-evidence-upload"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Upload photo or scan of signed release form (PDF, PNG, JPG)
              </p>
              {paperEvidenceFile && (
                <div className="mt-2 p-2 bg-success/10 rounded text-sm text-success flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  <span>Selected: {paperEvidenceFile.name}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </ResponsiveSheet>
  );
}
