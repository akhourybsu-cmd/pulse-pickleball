export type ImageFit = 'cover' | 'contain';

interface PrepareImageOptions {
  maxInputMB?: number;
  maxOutputMB?: number;
  maxDimension?: number;
  minWidth?: number;
  minHeight?: number;
  quality?: number;
  /** Bake the selected fit into a square file for avatars. */
  squareFit?: ImageFit;
}

export interface PreparedImage {
  blob: Blob;
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
}

export const IMAGE_FILE_ACCEPT = 'image/jpeg,image/png,image/webp';

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extensionFor(type: string): PreparedImage['extension'] {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    const cleanUp = () => URL.revokeObjectURL(url);
    image.onload = () => {
      cleanUp();
      resolve(image);
    };
    image.onerror = () => {
      cleanUp();
      reject(new Error('This image could not be read. Try exporting it as JPG, PNG, or WebP.'));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('This image could not be prepared for upload.')),
      type,
      quality,
    );
  });
}

/**
 * Validate and normalize an image before it reaches Supabase Storage.
 *
 * Large camera images are resized client-side, while avatar uploads can bake
 * either a crop or a full-photo fit into a square file. This keeps every
 * existing avatar renderer consistent without storing per-component crop data.
 */
export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {},
): Promise<PreparedImage> {
  const {
    maxInputMB = 12,
    maxOutputMB = 8,
    maxDimension = 2560,
    minWidth = 1,
    minHeight = 1,
    quality = 0.9,
    squareFit,
  } = options;

  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size > maxInputMB * 1024 * 1024) {
    throw new Error(`Choose an image smaller than ${maxInputMB}MB.`);
  }

  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('This image has no readable dimensions.');
  }
  if (sourceWidth < minWidth || sourceHeight < minHeight) {
    throw new Error(
      `For a crisp result, choose an image at least ${minWidth}×${minHeight}px. ` +
        `This one is ${sourceWidth}×${sourceHeight}px.`,
    );
  }

  const needsResize = sourceWidth > maxDimension || sourceHeight > maxDimension;
  const needsNormalization = needsResize || Boolean(squareFit) || file.size > 1024 * 1024;

  if (!needsNormalization && file.size <= maxOutputMB * 1024 * 1024) {
    return {
      blob: file,
      extension: extensionFor(file.type),
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image editing is not available in this browser.');

  if (squareFit) {
    const sourceReference = squareFit === 'cover'
      ? Math.min(sourceWidth, sourceHeight)
      : Math.max(sourceWidth, sourceHeight);
    const side = Math.max(1, Math.round(Math.min(maxDimension, sourceReference)));
    canvas.width = side;
    canvas.height = side;

    const scale = squareFit === 'cover'
      ? Math.max(side / sourceWidth, side / sourceHeight)
      : Math.min(side / sourceWidth, side / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(
      image,
      (side - drawWidth) / 2,
      (side - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  } else {
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  // WebP keeps transparent logo/avatar backgrounds while producing much
  // smaller high-resolution files than an uncompressed camera PNG.
  const blob = await canvasBlob(canvas, 'image/webp', quality);
  if (blob.size > maxOutputMB * 1024 * 1024) {
    throw new Error(`The optimized image is still larger than ${maxOutputMB}MB. Try a smaller file.`);
  }

  return {
    blob,
    extension: 'webp',
    width: canvas.width,
    height: canvas.height,
  };
}

/** Return an object path only when the URL belongs to the expected public bucket. */
export function storagePathFromPublicUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  try {
    const pathname = new URL(url).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}
