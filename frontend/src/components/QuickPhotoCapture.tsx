// Feature #311: Quick Photo Capture Component for Offline Use
import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, MapPin, Tag, Image, AlertTriangle } from 'lucide-react';
import { capturePhotoOffline, OfflinePhoto } from '@/lib/offlineDb';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { SyncStatusBadge } from '@/components/OfflineIndicator';
import { useAuth } from '@/lib/auth';

interface QuickPhotoCaptureProps {
  projectId: string;
  lotId?: string;
  entityType: OfflinePhoto['entityType'];
  entityId?: string;
  onPhotoCapture?: (photo: OfflinePhoto) => void;
  className?: string;
}

export function QuickPhotoCapture({
  projectId,
  lotId,
  entityType,
  entityId,
  onPhotoCapture,
  className = ''
}: QuickPhotoCaptureProps) {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dimensionWarning, setDimensionWarning] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Minimum recommended dimensions for construction photos
  const MIN_WIDTH = 100;
  const MIN_HEIGHT = 100;

  // Get GPS position
  const getGpsPosition = useCallback(() => {
    if (!navigator.geolocation) return;

    setGpsEnabled(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error('GPS error:', error);
        setGpsEnabled(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Handle file selection (camera or file picker)
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be smaller than 10MB');
      return;
    }

    // Create object URL for preview
    const objectUrl = URL.createObjectURL(file);

    // Check image dimensions
    const img = new window.Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      setImageDimensions({ width, height });

      // Check minimum dimensions
      if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        setDimensionWarning(
          `Warning: Image dimensions (${width}x${height}) are below recommended minimum (${MIN_WIDTH}x${MIN_HEIGHT}). Photo may lack detail for documentation.`
        );
      } else {
        setDimensionWarning(null);
      }

      setSelectedFile(file);
      setPreviewUrl(objectUrl);
      setIsCapturing(true);

      // Auto-get GPS when capturing
      getGpsPosition();
    };
    img.onerror = () => {
      alert('Failed to load image. Please try another file.');
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  // Open camera (on mobile) or file picker
  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Cancel capture
  const cancelCapture = () => {
    setIsCapturing(false);
    setPreviewUrl(null);
    setSelectedFile(null);
    setCaption('');
    setTags('');
    setGpsPosition(null);
    setDimensionWarning(null);
    setImageDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save photo (offline)
  const savePhoto = async () => {
    if (!selectedFile || !user) return;

    setIsSaving(true);
    try {
      const tagArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const photo = await capturePhotoOffline(projectId, selectedFile, {
        lotId,
        entityType,
        entityId,
        caption: caption || undefined,
        tags: tagArray.length > 0 ? tagArray : undefined,
        capturedBy: user.id,
        gpsLatitude: gpsPosition?.lat,
        gpsLongitude: gpsPosition?.lng
      });

      onPhotoCapture?.(photo);
      cancelCapture();
    } catch (error) {
      console.error('Error saving photo:', error);
      alert('Failed to save photo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={className}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Capture button */}
      {!isCapturing && (
        <button
          onClick={openCamera}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Camera className="h-5 w-5" />
          <span>Quick Photo</span>
          {!isOnline && (
            <span className="bg-amber-500 text-xs px-1.5 py-0.5 rounded">Offline</span>
          )}
        </button>
      )}

      {/* Preview and edit modal */}
      {isCapturing && previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Image className="h-5 w-5" />
                Photo Preview
              </h3>
              <button
                onClick={cancelCapture}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview image */}
            <div className="p-4">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-auto max-h-64 object-contain rounded-lg bg-gray-100"
              />

              {/* Sync status indicator */}
              <div className="mt-2 text-sm text-gray-500">
                {!isOnline ? (
                  <span className="flex items-center gap-1 text-amber-600">
                    <MapPin className="h-4 w-4" />
                    Will sync when online
                  </span>
                ) : (
                  <SyncStatusBadge status="pending" />
                )}
              </div>

              {/* Image dimensions info */}
              {imageDimensions && (
                <div className="mt-2 text-sm text-gray-500">
                  Dimensions: {imageDimensions.width} x {imageDimensions.height} pixels
                </div>
              )}

              {/* Dimension warning */}
              {dimensionWarning && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{dimensionWarning}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Form fields */}
            <div className="px-4 pb-4 space-y-4">
              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caption (optional)
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe this photo..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Tag className="h-4 w-4 inline mr-1" />
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., excavation, concrete, inspection"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* GPS indicator */}
              {gpsPosition && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <MapPin className="h-4 w-4" />
                  <span>
                    Location: {gpsPosition.lat.toFixed(6)}, {gpsPosition.lng.toFixed(6)}
                  </span>
                </div>
              )}
              {gpsEnabled && !gpsPosition && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 animate-pulse" />
                  <span>Getting location...</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={cancelCapture}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePhoto}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Photo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple button variant for inline use
export function QuickPhotoCaptureButton({
  projectId,
  lotId,
  entityType,
  entityId,
  onPhotoCapture,
  variant = 'default'
}: QuickPhotoCaptureProps & { variant?: 'default' | 'icon' | 'small' }) {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const photo = await capturePhotoOffline(projectId, file, {
        lotId,
        entityType,
        entityId,
        capturedBy: user.id
      });

      onPhotoCapture?.(photo);
    } catch (error) {
      console.error('Error capturing photo:', error);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (variant === 'icon') {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Take quick photo"
        >
          <Camera className="h-5 w-5 text-gray-600" />
        </button>
      </>
    );
  }

  if (variant === 'small') {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          <Camera className="h-4 w-4" />
          Photo
        </button>
      </>
    );
  }

  return <QuickPhotoCapture
    projectId={projectId}
    lotId={lotId}
    entityType={entityType}
    entityId={entityId}
    onPhotoCapture={onPhotoCapture}
  />;
}

export default QuickPhotoCapture;
