// PhotoCaptureModal - Full screen photo capture with GPS
import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Camera, RotateCcw, Check, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useForemanMobileStore } from '@/stores/foremanMobileStore'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { capturePhotoOffline } from '@/lib/offlineDb'
import { useAuth } from '@/lib/auth'
import { toast } from '@/components/ui/toaster'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'

interface PhotoCaptureModalProps {
  projectId: string
  lotId?: string
  entityType?: 'lot' | 'ncr' | 'holdpoint' | 'itp' | 'test' | 'general'
  entityId?: string
  onCapture?: (photoId: string) => void
  onClose: () => void
}

export function PhotoCaptureModal({
  projectId,
  lotId,
  entityType = 'general',
  entityId,
  onCapture,
  onClose,
}: PhotoCaptureModalProps) {
  const { user } = useAuth()
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore()
  const { latitude, longitude, accuracy, error: gpsError, refresh: refreshGps } = useGeoLocation()

  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close modal handler
  const handleClose = useCallback(() => {
    setIsCameraOpen(false)
    onClose()
  }, [setIsCameraOpen, onClose])

  // Handle file selection (native camera or gallery)
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCapturedFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setCapturedImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  // Retake photo
  const handleRetake = useCallback(() => {
    setCapturedImage(null)
    setCapturedFile(null)
    setCaption('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Save photo
  const handleSave = useCallback(async () => {
    if (!capturedFile || !user) return

    setSaving(true)
    try {
      const photo = await capturePhotoOffline(projectId, capturedFile, {
        lotId,
        entityType,
        entityId,
        caption: caption.trim() || undefined,
        capturedBy: user.id,
        gpsLatitude: latitude ?? undefined,
        gpsLongitude: longitude ?? undefined,
      })

      toast({ description: 'Photo saved', variant: 'success' })
      onCapture?.(photo.id)
      handleClose()
    } catch (error) {
      console.error('Failed to save photo:', error)
      toast({ description: 'Failed to save photo', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [
    capturedFile,
    user,
    projectId,
    lotId,
    entityType,
    entityId,
    caption,
    latitude,
    longitude,
    onCapture,
    handleClose,
  ])

  // Handle voice input for caption
  const handleVoiceCaption = useCallback((text: string) => {
    setCaption((prev) => (prev ? `${prev} ${text}` : text))
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [handleClose])

  if (!isCameraOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <button
          onClick={handleClose}
          className="p-2 text-white touch-manipulation min-h-[48px] min-w-[48px] flex items-center justify-center"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-medium">Capture Photo</h2>
        <div className="w-12" /> {/* Spacer for centering */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {!capturedImage ? (
          <>
            {/* Camera capture button */}
            <div className="flex-1 flex items-center justify-center bg-gray-900">
              <div className="text-center p-8">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-white flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
                >
                  <Camera className="w-12 h-12 text-gray-900" />
                </button>
                <p className="text-white mt-4">Tap to take photo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* GPS indicator */}
            <div className="p-4 bg-black/80">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className={cn('w-4 h-4', latitude ? 'text-green-500' : 'text-yellow-500')} />
                {latitude ? (
                  <span className="text-white">
                    GPS: {latitude.toFixed(6)}, {longitude?.toFixed(6)}
                    {accuracy && <span className="text-gray-400 ml-2">±{accuracy.toFixed(0)}m</span>}
                  </span>
                ) : gpsError ? (
                  <span className="text-yellow-500">{gpsError}</span>
                ) : (
                  <span className="text-gray-400">Getting location...</span>
                )}
                <button onClick={refreshGps} className="ml-auto text-blue-400 text-xs">
                  Refresh
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Preview captured image */}
            <div className="flex-1 relative bg-black">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
            </div>

            {/* Caption input */}
            <div className="p-4 bg-white dark:bg-gray-900">
              <div className="flex items-start gap-2">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add caption (optional)"
                  className="flex-1 p-3 border rounded-lg resize-none min-h-[80px] dark:bg-gray-800 dark:border-gray-700"
                  rows={2}
                />
                <VoiceInputButton onTranscript={handleVoiceCaption} />
              </div>

              {/* GPS display */}
              {latitude && (
                <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                  <MapPin className="w-4 h-4" />
                  Location captured
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg font-medium touch-manipulation min-h-[48px] dark:border-gray-700"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retake
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium',
                    'bg-primary text-primary-foreground touch-manipulation min-h-[48px]',
                    saving && 'opacity-50'
                  )}
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
