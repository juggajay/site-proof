// CaptureModal - Camera-first capture workflow for foreman
// Research-backed: Camera opens immediately. Categorize AFTER capture, not before.
// Goal: Take photo, optionally link to Lot/ITP/NCR, done in <10 seconds
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Camera,
  MapPin,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { capturePhotoOffline } from '@/lib/offlineDb';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { apiFetch, authFetch } from '@/lib/api';
import { logError } from '@/lib/logger';

type CaptureType = 'photo' | 'ncr' | 'note';

interface LotOption {
  id: string;
  lotNumber: string;
  description?: string | null;
}

interface CaptureModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onCapture?: (result: { type: CaptureType; id: string }) => void;
  defaultLotId?: string;
  defaultItpId?: string;
  /**
   * Which capture type the categorize step starts on after a photo is taken.
   * Defaults to 'photo' (existing behavior). The Issues shell opens the modal
   * pre-set to 'ncr' so "Raise an issue" lands on the Defect affordance — the
   * foreman still confirms with a description before the NCR is raised.
   */
  defaultCaptureType?: CaptureType;
}

interface UploadedDocumentResponse {
  id?: string;
  document?: { id?: string };
}

export function CaptureModal({
  projectId,
  isOpen,
  onClose,
  onCapture,
  defaultLotId,
  defaultItpId,
  defaultCaptureType = 'photo',
}: CaptureModalProps) {
  const { user } = useAuth();
  const { latitude, longitude } = useGeoLocation();

  const [phase, setPhase] = useState<'capture' | 'categorize'>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  const [captureType, setCaptureType] = useState<CaptureType>(defaultCaptureType);
  const [linkedLot, setLinkedLot] = useState<string | null>(defaultLotId || null);
  const [linkedItp, setLinkedItp] = useState<string | null>(defaultItpId || null);
  const [description, setDescription] = useState('');
  const [lots, setLots] = useState<LotOption[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsError, setLotsError] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const loadLots = useCallback(async () => {
    if (!projectId) return;

    setLotsLoading(true);
    setLotsError('');

    try {
      const data = await apiFetch<{ lots: LotOption[] }>(
        `/api/lots?projectId=${encodeURIComponent(projectId)}`,
      );
      setLots(data.lots || []);
    } catch {
      setLots([]);
      setLotsError('Unable to load lots');
    } finally {
      setLotsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      setPhase('capture');
      setCapturedImage(null);
      setCapturedFile(null);
      setCaptureType(defaultCaptureType);
      setLinkedLot(defaultLotId || null);
      setLinkedItp(defaultItpId || null);
      setDescription('');
      void loadLots();
      const timer = setTimeout(() => fileInputRef.current?.click(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultLotId, defaultItpId, defaultCaptureType, loadLots]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        onClose();
        return;
      }

      setCapturedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        setPhase('categorize');
      };
      reader.readAsDataURL(file);
    },
    [onClose],
  );

  const handleSave = useCallback(async () => {
    if (!capturedFile || !user) return;

    setSaving(true);
    try {
      const entityType =
        captureType === 'ncr' ? 'ncr' : captureType === 'note' ? 'general' : 'general';

      // For a defect, try to raise a real NCR first (online only) so the issue
      // actually lands in the NCR register. If that succeeds we link the photo to
      // the new NCR; otherwise we still keep the photo and tell the foreman the
      // truth - they need to raise the NCR from the register when back online.
      let raisedNcr: { id: string; ncrNumber: string } | null = null;
      let attachedNcrEvidenceDocumentId: string | null = null;
      let uploadedNcrEvidenceDocumentId: string | null = null;
      if (captureType === 'ncr' && navigator.onLine) {
        try {
          const response = await apiFetch<{ ncr: { id: string; ncrNumber: string } }>('/api/ncrs', {
            method: 'POST',
            body: JSON.stringify({
              projectId,
              description: description.trim() || 'Defect captured on site - details pending',
              category: 'general',
              lotIds: linkedLot ? [linkedLot] : undefined,
            }),
          });
          raisedNcr = response.ncr;
        } catch (error) {
          // Online but NCR creation failed - fall through to the offline wording
          // so we never claim an NCR was raised when it wasn't.
          logError('Failed to raise NCR from capture:', error);
        }
      }

      const caption = description.trim() || undefined;

      if (raisedNcr) {
        try {
          const formData = new FormData();
          formData.append('file', capturedFile);
          formData.append('projectId', projectId);
          if (linkedLot) formData.append('lotId', linkedLot);
          formData.append('documentType', 'ncr_evidence');
          formData.append('category', 'ncr_evidence');
          if (caption) formData.append('caption', caption);
          if (latitude != null) formData.append('gpsLatitude', String(latitude));
          if (longitude != null) formData.append('gpsLongitude', String(longitude));

          const uploadResponse = await authFetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error((await uploadResponse.text()) || 'Failed to upload NCR evidence');
          }

          const uploaded = (await uploadResponse.json()) as UploadedDocumentResponse;
          uploadedNcrEvidenceDocumentId = uploaded.id ?? uploaded.document?.id ?? null;

          if (!uploadedNcrEvidenceDocumentId) {
            throw new Error('Document upload response did not include a document id');
          }

          await apiFetch(`/api/ncrs/${encodeURIComponent(raisedNcr.id)}/evidence`, {
            method: 'POST',
            body: JSON.stringify({
              documentId: uploadedNcrEvidenceDocumentId,
              evidenceType: 'photo',
              ...(caption ? { caption } : {}),
            }),
          });
          attachedNcrEvidenceDocumentId = uploadedNcrEvidenceDocumentId;
        } catch (error) {
          // The NCR exists, but the evidence link did not complete. Queue the
          // photo against that NCR so the offline sync worker retries the attach.
          logError('Failed to attach captured evidence to NCR:', error);
        }
      }

      const photo =
        attachedNcrEvidenceDocumentId && raisedNcr
          ? null
          : await capturePhotoOffline(projectId, capturedFile, {
              lotId: linkedLot || undefined,
              entityType,
              entityId: raisedNcr ? raisedNcr.id : linkedItp || undefined,
              documentType: captureType === 'ncr' ? 'ncr_evidence' : 'photo',
              category: captureType === 'ncr' ? 'ncr_evidence' : undefined,
              caption,
              capturedBy: user.id,
              gpsLatitude: latitude ?? undefined,
              gpsLongitude: longitude ?? undefined,
              serverDocumentId: uploadedNcrEvidenceDocumentId ?? undefined,
            });

      if (captureType === 'ncr') {
        if (raisedNcr) {
          toast({
            description: `NCR ${raisedNcr.ncrNumber} raised - add details from the NCR register.`,
            variant: 'success',
          });
        } else {
          // Offline (or creation failed): the photo is saved, but no NCR exists yet.
          toast({
            description:
              "Photo saved offline - raise the NCR from the NCR register when you're back online.",
            variant: 'success',
          });
        }
      } else {
        toast({ description: 'Photo saved', variant: 'success' });
      }

      onCapture?.({
        type: captureType,
        id: raisedNcr?.id ?? attachedNcrEvidenceDocumentId ?? photo?.id ?? '',
      });
      onClose();
    } catch (error) {
      logError('Failed to save:', error);
      toast({ description: 'Failed to save', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [
    capturedFile,
    user,
    projectId,
    linkedLot,
    linkedItp,
    captureType,
    description,
    latitude,
    longitude,
    onCapture,
    onClose,
  ]);

  const handleQuickSave = useCallback(async () => {
    setCaptureType('photo');
    setLinkedLot(defaultLotId || null);
    setDescription('');
    if (!capturedFile || !user) return;

    setSaving(true);
    try {
      const photo = await capturePhotoOffline(projectId, capturedFile, {
        lotId: defaultLotId || undefined,
        entityType: 'general',
        documentType: 'photo',
        caption: undefined,
        capturedBy: user.id,
        gpsLatitude: latitude ?? undefined,
        gpsLongitude: longitude ?? undefined,
      });

      toast({ description: 'Photo saved', variant: 'success' });
      onCapture?.({ type: 'photo', id: photo.id });
      onClose();
    } catch (error) {
      logError('Failed to save:', error);
      toast({ description: 'Failed to save', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [capturedFile, user, projectId, defaultLotId, latitude, longitude, onCapture, onClose]);

  const handleVoiceInput = useCallback((text: string) => {
    setDescription((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      {/* Gallery alternative: no capture attribute, so photos taken earlier can
          be attached without forcing the camera. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {phase === 'capture' && !capturedImage && (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900">
          <Camera className="h-16 w-16 text-gray-500 mb-4" />
          <p className="text-gray-400 mb-2">Opening camera...</p>
          <p className="text-gray-500 text-sm">If camera doesn't open, tap below</p>
          <Button onClick={() => fileInputRef.current?.click()} className="mt-4 min-h-[48px]">
            Open Camera
          </Button>
          <Button
            variant="outline"
            onClick={() => galleryInputRef.current?.click()}
            className="mt-3 min-h-[48px]"
          >
            <ImageIcon className="h-4 w-4" />
            From gallery
          </Button>
          <Button variant="ghost" onClick={onClose} className="mt-4 text-gray-400 min-h-[48px]">
            Cancel
          </Button>
        </div>
      )}

      {phase === 'categorize' && capturedImage && (
        <>
          <div className="flex items-center justify-between p-4 bg-black/90">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 min-h-[44px] min-w-[44px]"
            >
              <X className="w-6 h-6" />
            </Button>
            <h2 className="text-white font-medium">Captured</h2>
            <Button onClick={handleQuickSave} disabled={saving} size="sm" className="min-h-[44px]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>

          <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
            <img
              src={capturedImage}
              alt="Captured"
              className="max-w-full max-h-full object-contain"
            />
            {latitude && (
              <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1.5 bg-success text-success-foreground text-xs rounded-full">
                <MapPin className="h-3 w-3" />
                GPS captured
              </div>
            )}
          </div>

          <div className="bg-background rounded-t-2xl p-4 space-y-4 max-h-[45vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground text-center">
              Optional: Add details now or save and categorize later
            </p>

            <div className="flex gap-2">
              <TypeButton
                icon={Camera}
                label="Photo"
                selected={captureType === 'photo'}
                onClick={() => setCaptureType('photo')}
              />
              <TypeButton
                icon={AlertTriangle}
                label="Defect"
                selected={captureType === 'ncr'}
                onClick={() => setCaptureType('ncr')}
                accentColor="text-destructive"
              />
              <TypeButton
                icon={FileText}
                label="Note"
                selected={captureType === 'note'}
                onClick={() => setCaptureType('note')}
              />
            </div>

            {(captureType === 'ncr' || captureType === 'note') && (
              <div className="flex items-start gap-2">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    captureType === 'ncr' ? 'Brief defect description' : 'Note description'
                  }
                  autoCapitalize="sentences"
                  autoComplete="off"
                  enterKeyHint="done"
                  spellCheck={true}
                />
                <VoiceInputButton onTranscript={handleVoiceInput} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="capture-linked-lot">Link to Lot</Label>
              <div className="relative">
                <NativeSelect
                  id="capture-linked-lot"
                  value={linkedLot || ''}
                  onChange={(e) => setLinkedLot(e.target.value || null)}
                  disabled={lotsLoading}
                  className="h-12 pr-10"
                >
                  <option value="">No lot selected</option>
                  {linkedLot && !lots.some((lot) => lot.id === linkedLot) && (
                    <option value={linkedLot}>Selected lot</option>
                  )}
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lotNumber}
                      {lot.description ? ` - ${lot.description}` : ''}
                    </option>
                  ))}
                </NativeSelect>
                {lotsLoading && (
                  <Loader2 className="absolute right-3 top-3.5 h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
              {lotsError && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-destructive">{lotsError}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadLots()}
                    className="h-8 px-2"
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full min-h-[56px] font-semibold"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : captureType === 'ncr' ? (
                'Save Defect Photo'
              ) : captureType === 'note' ? (
                'Save Note'
              ) : (
                'Save Photo'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface TypeButtonProps {
  icon: typeof Camera;
  label: string;
  selected: boolean;
  onClick: () => void;
  accentColor?: string;
}

function TypeButton({ icon: Icon, label, selected, onClick, accentColor }: TypeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors',
        'touch-manipulation min-h-[72px]',
        selected ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5',
          selected ? 'text-primary' : accentColor || 'text-muted-foreground',
        )}
      />
      <span className={cn('text-xs', selected && 'font-medium')}>{label}</span>
    </button>
  );
}

export default CaptureModal;
