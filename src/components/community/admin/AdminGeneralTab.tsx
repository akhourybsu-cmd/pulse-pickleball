import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/getErrorMessage';
import {
  IMAGE_FILE_ACCEPT,
  prepareImageForUpload,
  storagePathFromPublicUrl,
  type ImageFit,
} from '@/lib/images/prepareImageUpload';
import { cn } from '@/lib/utils';

export type GroupType = 'crew' | 'league' | 'open_play' | 'tournament' | 'venue_official' | 'club';

interface AdminGeneralTabProps {
  name: string;
  description: string;
  type: GroupType;
  groupId: string;
  iconUrl: string | null;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onTypeChange: (type: GroupType) => void;
  onIconUrlChange: (url: string | null) => void;
}

const GROUP_TYPES: { value: GroupType; label: string; description: string }[] = [
  { value: 'crew', label: 'Crew', description: 'A tight-knit group of regular players' },
  { value: 'league', label: 'League', description: 'Organized competitive play' },
  { value: 'open_play', label: 'Open Play', description: 'Drop-in sessions open to all' },
  { value: 'tournament', label: 'Tournament', description: 'Tournament teams and brackets' },
  { value: 'club', label: 'Pickleball Club / Venue', description: 'A club or facility community with official programming' },
];

export function AdminGeneralTab({
  name,
  description,
  type,
  groupId,
  iconUrl,
  onNameChange,
  onDescriptionChange,
  onTypeChange,
  onIconUrlChange,
}: AdminGeneralTabProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarFit, setAvatarFit] = useState<ImageFit>('contain');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const prepared = await prepareImageForUpload(file, {
        maxInputMB: 12,
        maxOutputMB: 5,
        maxDimension: 1024,
        minWidth: 320,
        minHeight: 320,
        quality: 0.92,
        squareFit: avatarFit,
      });
      // IMPORTANT: storage RLS expects the first folder segment to be the groupId UUID.
      const filePath = `${groupId}/avatar-${Date.now()}.${prepared.extension}`;

      const { error: uploadError } = await supabase.storage
        .from('groups')
        .upload(filePath, prepared.blob, {
          upsert: false,
          contentType: prepared.blob.type,
          cacheControl: '31536000',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('groups')
        .getPublicUrl(filePath);

      // Update group icon_url in database
      const previousPath = storagePathFromPublicUrl(iconUrl, 'groups');
      const { error: updateError } = await supabase
        .from('groups')
        .update({ icon_url: publicUrl })
        .eq('id', groupId);

      if (updateError) {
        await supabase.storage.from('groups').remove([filePath]);
        throw updateError;
      }

      onIconUrlChange(publicUrl);
      if (previousPath && previousPath !== filePath) {
        void supabase.storage.from('groups').remove([previousPath]);
      }
      toast({
        title: 'Avatar updated',
        description: `${avatarFit === 'contain' ? 'Full image shown' : 'Frame filled'} at ${prepared.width}×${prepared.height}px.`,
      });
    } catch (error: unknown) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Upload failed',
        description: getErrorMessage(error, 'Failed to upload image'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      const previousPath = storagePathFromPublicUrl(iconUrl, 'groups');
      const { error } = await supabase
        .from('groups')
        .update({ icon_url: null })
        .eq('id', groupId);

      if (error) throw error;

      onIconUrlChange(null);
      if (previousPath) void supabase.storage.from('groups').remove([previousPath]);
      toast({ title: 'Avatar removed' });
    } catch (error: unknown) {
      console.error('Error removing avatar:', error);
      toast({ title: 'Error', description: 'Failed to remove avatar', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (groupName: string) => {
    return groupName.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-5">
      {/* Avatar Upload Card */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Group Avatar</CardTitle>
          <CardDescription>
            A square image works best. Shown across feeds, chat, and member lists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="group relative h-28 w-28 shrink-0 rounded-2xl overflow-hidden ring-1 ring-border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              aria-label="Upload group avatar"
            >
              {iconUrl ? (
                <img src={iconUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {getInitials(name || 'GR')}
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </button>
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <Button variant="default" size="sm" onClick={handleAvatarClick} disabled={uploading}>
                  <Camera className="h-4 w-4 mr-2" />
                  {iconUrl ? 'Change photo' : 'Upload photo'}
                </Button>
                {iconUrl && (
                  <Button variant="ghost" size="sm" onClick={handleRemoveAvatar} disabled={uploading}>
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Frame the next upload</p>
                <div role="group" aria-label="Avatar image fit" className="inline-flex rounded-lg border border-border bg-background p-1">
                  {([['contain', 'Show full image'], ['cover', 'Fill frame']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAvatarFit(value)}
                      aria-pressed={avatarFit === value}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                        avatarFit === value
                          ? 'bg-foreground text-background shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or WebP · Up to 12MB · At least 320×320px
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_FILE_ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Basic Info Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basic Information</CardTitle>
          <CardDescription>
            Update your group's name, description, and type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="group-name">Group Name</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{name.length}/50</span>
            </div>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter group name"
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="group-description">Description</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{description.length}/500</span>
            </div>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What is this group about?"
              rows={4}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-type">Group Type</Label>
            <Select value={type} onValueChange={onTypeChange}>
              <SelectTrigger id="group-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex flex-col">
                      <span>{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
