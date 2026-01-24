// CaptureModal - Camera-first capture workflow for foreman
// Research-backed: Camera opens immediately. Categorize AFTER capture, not before.
// Goal: Take photo, optionally link to Lot/ITP/NCR, done in <10 seconds
import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Camera, MapPin, AlertTriangle, FileText, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { capturePhotoOffline } from '@/lib/offlineDb'
import { useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'

type CaptureType = 'photo' | 'ncr' | 'note'

interface CaptureModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onCapture?: (result: { type: CaptureType; id: string }) => void
  // Optional pre-selection for context-aware capture
  defaultLotId?: string
  defaultItpId?: string
}

export function CaptureModal({
  projectId,
  isOpen,
  onClose,
  onCapture,
  defaultLotId,
  defaultItpId
}: CaptureModalProps) {
  const { user } = useAuth()
  const { latitude, longitude } = useGeoLocation()

  // Capture state
  const [phase, setPhase] = useState<'capture' | 'categorize'>('capture')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)

  // Categorization state (all optional)
  const [captureType, setCaptureType] = useState<CaptureType>('photo')
  const [linkedLot, setLinkedLot] = useState<string | null>(defaultLotId || null)
  const [linkedItp, setLinkedItp] = useState<string | null>(defaultItpId || null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('capture')
      setCapturedImage(null)
      setCapturedFile(null)
      setCaptureType('photo')
      setLinkedLot(defaultLotId || null)
      setLinkedItp(defaultItpId || null)
      setDescription('')
      // Auto-trigger camera on open - slight delay to ensure render
      const timer = setTimeout(() => fileInputRef.current?.click(), 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen, defaultLotId, defaultItpId])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      // User cancelled camera - close modal
      onClose()
      return
    }

    setCapturedFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setCapturedImage(event.target?.result as string)
      setPhase('categorize')
    }
    reader.readAsDataURL(file)
  }, [onClose])

  const handleSave = useCallback(async () => {
    if (!capturedFile || !user) return

    setSaving(true)
    try {
      // Determine entity type based on capture type
      const entityType = captureType === 'ncr' ? 'ncr' : captureType === 'note' ? 'general' : 'general'

      const photo = await capturePhotoOffline(projectId, capturedFile, {
        lotId: linkedLot || undefined,
        entityType,
        entityId: linkedItp || undefined,
        caption: description.trim() || undefined,
        capturedBy: user.id,
        gpsLatitude: latitude ?? undefined,
        gpsLongitude: longitude ?? undefined,
      })

      // If NCR, show appropriate message
      if (captureType === 'ncr') {
        toast({ description: 'NCR captured - complete details later', variant: 'success' })
      } else {
        toast({ description: 'Photo saved', variant: 'success' })
      }

      onCapture?.({ type: captureType, id: photo.id })
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
      toast({ description: 'Failed to save', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [capturedFile, user, projectId, linkedLot, linkedItp, captureType, description, latitude, longitude, onCapture, onClose])

  // Quick save - no categorization, just save as photo
  const handleQuickSave = useCallback(async () => {
    setCaptureType('photo')
    setLinkedLot(defaultLotId || null)
    setDescription('')
    // Call save directly with current state
    if (!capturedFile || !user) return

    setSaving(true)
    try {
      const photo = await capturePhotoOffline(projectId, capturedFile, {
        lotId: defaultLotId || undefined,
        entityType: 'general',
        caption: undefined,
        capturedBy: user.id,
        gpsLatitude: latitude ?? undefined,
        gpsLongitude: longitude ?? undefined,
      })

      toast({ description: 'Photo saved', variant: 'success' })
      onCapture?.({ type: 'photo', id: photo.id })
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
      toast({ description: 'Failed to save', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [capturedFile, user, projectId, defaultLotId, latitude, longitude, onCapture, onClose])

  // Handle voice input for description
  const handleVoiceInput = useCallback((text: string) => {
    setDescription(prev => prev ? `${prev} ${text}` : text)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden file input - triggers camera immediately */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {phase === 'capture' && !capturedImage && (
        // Waiting for camera
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900">
          <Camera className="h-16 w-16 text-gray-500 mb-4" />
          <p className="text-gray-400 mb-2">Opening camera...</p>
          <p className="text-gray-500 text-sm">If camera doesn't open, tap below</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 px-6 py-3 bg-primary text-white rounded-lg font-medium touch-manipulation min-h-[48px]"
          >
            Open Camera
          </button>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-3 text-gray-400 touch-manipulation min-h-[48px]"
          >
            Cancel
          </button>
        </div>
      )}

      {phase === 'categorize' && capturedImage && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/90">
            <button
              onClick={onClose}
              className="p-2 text-white touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-white font-medium">Captured</h2>
            <button
              onClick={handleQuickSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium min-h-[44px] touch-manipulation"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
            <img
              src={capturedImage}
              alt="Captured"
              className="max-w-full max-h-full object-contain"
            />

            {/* GPS Badge */}
            {latitude && (
              <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600/90 text-white text-xs rounded-full">
                <MapPin className="h-3 w-3" />
                GPS captured
              </div>
            )}
          </div>

          {/* Categorization Panel (Optional) */}
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl p-4 space-y-4 max-h-[45vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground text-center">
              Optional: Add details now or save and categorize later
            </p>

            {/* Capture Type Selection */}
            <div className="flex gap-2">
              <TypeButton
                icon={Camera}
                label="Photo"
                selected={captureType === 'photo'}
                onClick={() => setCaptureType('photo')}
              />
              <TypeButton
                icon={AlertTriangle}
                label="NCR/Defect"
                selected={captureType === 'ncr'}
                onClick={() => setCaptureType('ncr')}
                accentColor="text-red-600"
              />
              <TypeButton
                icon={FileText}
                label="Note"
                selected={captureType === 'note'}
                onClick={() => setCaptureType('note')}
              />
            </div>

            {/* Quick description (especially useful for NCR) */}
            {(captureType === 'ncr' || captureType === 'note') && (
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={captureType === 'ncr' ? 'Brief NCR description' : 'Note description'}
                  className="flex-1 p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
                <VoiceInputButton onTranscript={handleVoiceInput} />
              </div>
            )}

            {/* Link to Lot (optional) - TODO: implement lot selector */}
            <button
              className="w-full flex items-center justify-between p-3 border rounded-lg dark:border-gray-700 touch-manipulation min-h-[48px]"
              onClick={() => {
                // TODO: Open lot selector modal
                toast({ description: 'Lot selector coming soon' })
              }}
            >
              <span className="text-muted-foreground">
                {linkedLot ? `Linked to Lot ${linkedLot}` : 'Link to Lot (optional)'}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Full Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'w-full py-4 rounded-lg font-semibold text-white',
                'bg-primary active:bg-primary/90',
                'touch-manipulation min-h-[56px]',
                'flex items-center justify-center gap-2',
                saving && 'opacity-50'
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                captureType === 'ncr' ? 'Save NCR' : captureType === 'note' ? 'Save Note' : 'Save Photo'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface TypeButtonProps {
  icon: typeof Camera
  label: string
  selected: boolean
  onClick: () => void
  accentColor?: string
}

function TypeButton({ icon: Icon, label, selected, onClick, accentColor }: TypeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors',
        'touch-manipulation min-h-[72px]',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <Icon className={cn(
        'h-5 w-5',
        selected ? 'text-primary' : (accentColor || 'text-muted-foreground')
      )} />
      <span className={cn('text-xs', selected && 'font-medium')}>{label}</span>
    </button>
  )
}

export default CaptureModal
