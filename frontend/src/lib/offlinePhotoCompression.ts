import { devLog } from './logger';

// Compression configuration
const COMPRESSION_CONFIG = {
  maxWidth: 1920, // Maximum width in pixels
  maxHeight: 1080, // Maximum height in pixels
  quality: 0.8, // JPEG quality (0-1)
  maxSizeKB: 500, // Target max file size in KB
};

// Feature #317: Compress and resize image
export async function compressImage(
  file: File,
): Promise<{ dataUrl: string; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;

  // Skip compression for already small files (< 100KB) or non-image files
  if (originalSize < 100 * 1024 || !file.type.startsWith('image/')) {
    const dataUrl = await fileToDataUrl(file);
    return { dataUrl, originalSize, compressedSize: originalSize };
  }

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
        const { maxWidth, maxHeight, quality } = COMPRESSION_CONFIG;

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

        // Convert to JPEG with compression
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);

        // Calculate compressed size (base64 is ~1.37x larger than binary)
        const base64Length = compressedDataUrl.split(',')[1]?.length || 0;
        const compressedSize = Math.round(base64Length * 0.75);

        devLog(
          `[Compression] Original: ${(originalSize / 1024).toFixed(1)}KB -> Compressed: ${(compressedSize / 1024).toFixed(1)}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`,
        );

        resolve({ dataUrl: compressedDataUrl, originalSize, compressedSize });
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

// Convert File to base64 data URL (without compression)
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
