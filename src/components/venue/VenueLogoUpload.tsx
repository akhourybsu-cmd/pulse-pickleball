import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { getVenueLogoSrc, getVenueLogoFallback } from '@/lib/venueBranding';
import { cn } from '@/lib/utils';

interface VenueLogoUploadProps {
  venueId: string;
  currentLogoUrl: string | null | undefined;
  venueName?: string | null;
  venueSlug?: string | null;
  logoShape?: 'circle' | 'square';
  onLogoChange: (newUrl: string | null) => void;
  disabled?: boolean;
}

export function VenueLogoUpload({
  venueId,
  currentLogoUrl,
  venueName,
  venueSlug,
  logoShape = 'circle',
  onLogoChange,
  disabled = false,
}: VenueLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(currentLogoUrl || '');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logoSrc = getVenueLogoSrc(currentLogoUrl, venueName, venueSlug);
  const hasCustomLogo = currentLogoUrl && currentLogoUrl.trim() !== '';

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    try {
      setUploading(true);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${venueId}/logo-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('venue-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('venue-logos')
        .getPublicUrl(data.path);

      onLogoChange(urlData.publicUrl);
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onLogoChange(urlInput.trim());
      setShowUrlInput(false);
    }
  };

  const handleRemoveLogo = () => {
    onLogoChange(null);
    setUrlInput('');
  };

  return (
    <div className="space-y-4">
      <Label>Venue Logo</Label>
      
      {/* Logo Preview */}
      <div className="flex items-start gap-4">
        <div 
          className={cn(
            "relative w-24 h-24 bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border",
            logoShape === 'circle' ? 'rounded-full' : 'rounded-lg'
          )}
        >
          <img
            src={logoSrc}
            alt={venueName || 'Venue logo'}
            className={cn(
              "w-full h-full object-cover",
              logoShape === 'circle' ? 'rounded-full' : 'rounded-lg'
            )}
            onError={(e) => {
              e.currentTarget.src = getVenueLogoFallback();
            }}
          />
          {uploading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="w-full"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Image
          </Button>

          {/* URL Input Toggle */}
          {!showUrlInput ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowUrlInput(true)}
              disabled={disabled}
              className="w-full text-muted-foreground"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Use URL instead
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={disabled}
                className="flex-1 h-9"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim() || disabled}
              >
                Set
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowUrlInput(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Remove Button */}
          {hasCustomLogo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveLogo}
              disabled={disabled}
              className="w-full text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Remove Logo
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Recommended: Square image, at least 200x200px. Max 2MB.
      </p>
    </div>
  );
}
