import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImageDropzoneProps {
  onFileSelect: (file: File) => void;
  preview?: string | null;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
  accept?: string;
}

export function ImageDropzone({
  onFileSelect,
  preview,
  onRemove,
  className,
  disabled = false,
  accept = 'image/jpeg,image/png,image/gif,image/webp',
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onFileSelect(file);
      }
    }
  }, [disabled, onFileSelect]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileSelect]);

  if (preview) {
    return (
      <div className={cn('relative rounded-lg overflow-hidden', className)}>
        <img
          src={preview}
          alt="Preview"
          className="w-full h-48 object-cover"
        />
        {onRemove && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg"
            onClick={onRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/20 hover:border-muted-foreground/40',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-2">
        {isDragging ? (
          <>
            <Upload className="h-10 w-10 text-primary animate-bounce" />
            <p className="text-sm text-primary font-medium">Drop your image here</p>
          </>
        ) : (
          <>
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                <span className="text-primary font-medium">Tap to add a photo</span>
              </p>
              <p className="text-xs text-muted-foreground/60">
                or drag and drop
              </p>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-2">
              JPEG, PNG, GIF, WebP up to 10MB
            </p>
          </>
        )}
      </div>
    </div>
  );
}
