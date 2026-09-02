import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/getErrorMessage';

interface UseImageUploadOptions {
  bucket: string;
  folder?: string;
  maxSizeMB?: number;
  compressionQuality?: number;
  maxDimension?: number;
}

interface UploadResult {
  url: string;
  path: string;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function compressImage(
  file: File,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const url = URL.createObjectURL(file);

    const cleanUp = () => URL.revokeObjectURL(url);

    img.onload = () => {
      let { width, height } = img;

      // Scale down if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        cleanUp();
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          cleanUp();
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp',
        quality
      );
    };

    img.onerror = () => {
      cleanUp();
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

function extensionForMimeType(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

export function useImageUpload(options: UseImageUploadOptions) {
  const {
    bucket,
    folder = '',
    maxSizeMB = 10,
    compressionQuality = 0.8,
    maxDimension = 1920,
  } = options;

  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, GIF, or WebP)';
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size must be less than ${maxSizeMB}MB`;
    }

    return null;
  }, [maxSizeMB]);

  const uploadImage = useCallback(async (file: File): Promise<UploadResult | null> => {
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: 'Invalid file',
        description: validationError,
        variant: 'destructive',
      });
      return null;
    }

    setUploading(true);
    setProgress(10);

    try {
      // Compress image if larger than 1MB
      let uploadBlob: Blob = file;
      // Animated GIFs must remain byte-for-byte intact; drawing them to a
      // canvas would silently flatten the animation to one frame.
      if (file.size > 1024 * 1024 && file.type !== 'image/gif') {
        setProgress(30);
        uploadBlob = await compressImage(file, maxDimension, compressionQuality);
        setProgress(50);
      } else {
        setProgress(50);
      }

      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const extension = extensionForMimeType(uploadBlob.type || file.type);
      const fileName = `${timestamp}-${random}.${extension}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      setProgress(70);

      // Upload to storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, uploadBlob, {
          contentType: uploadBlob.type || 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      setProgress(90);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      setProgress(100);

      return {
        url: urlData.publicUrl,
        path: data.path,
      };
    } catch (error: unknown) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: getErrorMessage(error, 'Failed to upload image'),
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [bucket, folder, maxDimension, compressionQuality, validateFile, toast]);

  const deleteImage = useCallback(async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
      return true;
    } catch (error: unknown) {
      console.error('Delete error:', error);
      return false;
    }
  }, [bucket]);

  return {
    uploadImage,
    deleteImage,
    uploading,
    progress,
    validateFile,
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  };
}
