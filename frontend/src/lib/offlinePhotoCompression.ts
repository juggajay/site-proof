import { devLog } from './logger';

// Compression configuration
const COMPRESSION_CONFIG = {
  maxWidth: 1920, // Maximum width in pixels
  maxHeight: 1080, // Maximum height in pixels
  quality: 0.8, // JPEG quality (0-1)
  maxSizeKB: 500, // Target max file size in KB
};

// Only raster images benefit from canvas resize; everything else (and tiny
// files) is passed through untouched by both the offline and online paths.
function shouldCompress(file: File): boolean {
  return file.size >= 100 * 1024 && file.type.startsWith('image/');
}

// Shared core: load the file, resize onto a canvas (aspect-preserving), and
// hand back the canvas + the mime type both serializers use. This is the one
// place the resize maths lives — compressImage (offline, -> dataUrl) and
// compressImageForUpload (online, -> File) both build on it.
function renderResizedCanvas(file: File): Promise<{ canvas: HTMLCanvasElement; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const { maxWidth, maxHeight } = COMPRESSION_CONFIG;

        // Scale down if needed
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw image with smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG for everything except PNG (keeps PNG transparency)
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve({ canvas, mimeType });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };

    // Load the image
    img.src = objectUrl;
  });
}

// Feature #317: Compress and resize image (offline path -> base64 data URL)
export async function compressImage(
  file: File,
): Promise<{ dataUrl: string; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;

  // Skip compression for already small files (< 100KB) or non-image files
  if (!shouldCompress(file)) {
    const dataUrl = await fileToDataUrl(file);
    return { dataUrl, originalSize, compressedSize: originalSize };
  }

  const { canvas, mimeType } = await renderResizedCanvas(file);
  const compressedDataUrl = canvas.toDataURL(mimeType, COMPRESSION_CONFIG.quality);

  // Calculate compressed size (base64 is ~1.37x larger than binary)
  const base64Length = compressedDataUrl.split(',')[1]?.length || 0;
  const compressedSize = Math.round(base64Length * 0.75);

  devLog(
    `[Compression] Original: ${(originalSize / 1024).toFixed(1)}KB -> Compressed: ${(compressedSize / 1024).toFixed(1)}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`,
  );

  return { dataUrl: compressedDataUrl, originalSize, compressedSize };
}

// Feature: compress on ONLINE upload paths. Takes the File about to be POSTed
// and returns a resized/re-encoded File ready for FormData. Non-image files,
// tiny files, or ANY failure (bad canvas, corrupt image, upsize) fall back to
// the original File — compression must never block an upload.
export async function compressImageForUpload(file: File): Promise<File> {
  if (!shouldCompress(file)) {
    return file;
  }

  try {
    const { canvas, mimeType } = await renderResizedCanvas(file);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, COMPRESSION_CONFIG.quality);
    });

    // Only swap in the compressed file if it actually got smaller.
    if (!blob || blob.size >= file.size) {
      return file;
    }

    devLog(
      `[Compression] Upload ${(file.size / 1024).toFixed(1)}KB -> ${(blob.size / 1024).toFixed(1)}KB (${Math.round((1 - blob.size / file.size) * 100)}% reduction)`,
    );

    // Preserve the original filename so server-side naming/metadata is unchanged.
    return new File([blob], file.name, { type: mimeType, lastModified: file.lastModified });
  } catch {
    // ponytail: any compression failure -> upload the original, never throw.
    return file;
  }
}

// Convert File to base64 data URL (without compression)
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
