import { useState, useEffect } from 'react';
import { Send, Image, BarChart3, Gamepad2, Plus, X } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ImageDropzone } from './ImageDropzone';
import { useImageUpload } from '@/hooks/useImageUpload';

export type PostType = 'post' | 'photo' | 'poll' | 'event' | 'lfg' | 'result';

interface QuickPostComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: PostType;
  groupId: string;
  onSubmit: (data: {
    type: string;
    content?: string;
    title?: string;
    session_date?: string;
    session_time?: string;
    max_players?: number;
    image_url?: string;
    poll_options?: { idx: number; text: string }[];
  }) => Promise<boolean>;
}

export function QuickPostComposer({ 
  open, 
  onOpenChange, 
  initialType = 'post',
  groupId,
  onSubmit 
}: QuickPostComposerProps) {
  const [activeTab, setActiveTab] = useState<PostType>(initialType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('4');
  // Poll options — composer enforces 2..4 non-empty options. Start with two
  // blanks so the form is immediately fillable.
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  
  // Image state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const { uploadImage, uploading, progress } = useImageUpload({
    bucket: 'group-post-images',
    folder: groupId,
  });

  // Update active tab when initialType changes
  useEffect(() => {
    if (open) {
      setActiveTab(initialType);
    }
  }, [initialType, open]);

  // Update preview when image is selected
  useEffect(() => {
    if (selectedImage) {
      const url = URL.createObjectURL(selectedImage);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreview(null);
    }
  }, [selectedImage]);

  const resetForm = () => {
    setContent('');
    setTitle('');
    setSessionDate('');
    setSessionTime('');
    setMaxPlayers('4');
    setPollOptions(['', '']);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    let imageUrl: string | undefined;
    
    // Upload image if present
    if (selectedImage) {
      const result = await uploadImage(selectedImage);
      if (result) {
        imageUrl = result.url;
      } else {
        setIsSubmitting(false);
        return; // Upload failed, don't proceed
      }
    }
    
    let data: any = {};
    
    switch (activeTab) {
      case 'post':
        data = { type: 'feed', content: content.trim() };
        break;
      case 'photo':
        data = { type: 'feed', content: content.trim(), image_url: imageUrl };
        break;
      case 'lfg':
        data = {
          type: 'lfg',
          title: title.trim(),
          content: content.trim(),
          session_date: sessionDate || undefined,
          session_time: sessionTime || undefined,
          max_players: maxPlayers ? parseInt(maxPlayers) : undefined,
        };
        break;
      case 'poll': {
        // Pack the option strings into the {idx,text} shape stored in
        // group_posts.poll_options. Empty options are dropped, and
        // option_idx is reassigned from 0 so it always matches the
        // array position the voter sees.
        const cleaned = pollOptions
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
          .map((text, idx) => ({ idx, text }));
        data = {
          type: 'poll',
          title: title.trim(),
          content: content.trim(),
          poll_options: cleaned,
        };
        break;
      }
      default:
        data = { type: 'feed', content: content.trim() };
    }

    const success = await onSubmit(data);
    
    if (success) {
      resetForm();
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const canSubmit = () => {
    if (uploading) return false;
    
    switch (activeTab) {
      case 'post':
        return content.trim().length > 0;
      case 'photo':
        return selectedImage !== null;
      case 'lfg':
        return title.trim().length > 0;
      case 'poll':
        return (
          title.trim().length > 0 &&
          pollOptions.filter((o) => o.trim().length > 0).length >= 2
        );
      default:
        return content.trim().length > 0;
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85svh] max-h-[85svh] flex flex-col p-0 gap-0">
        <DrawerHeader className="px-4 pt-4 pb-2 shrink-0">
          <DrawerTitle>Create Post</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PostType)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="post" className="gap-1 text-xs">
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Post</span>
              </TabsTrigger>
              <TabsTrigger value="lfg" className="gap-1 text-xs">
                <Gamepad2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">LFG</span>
              </TabsTrigger>
              <TabsTrigger value="poll" className="gap-1 text-xs">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Poll</span>
              </TabsTrigger>
              <TabsTrigger value="photo" className="gap-1 text-xs">
                <Image className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Photo</span>
              </TabsTrigger>
            </TabsList>

            {/* Post Tab */}
            <TabsContent value="post" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>What's on your mind?</Label>
                <Textarea
                  placeholder="Share an update with the group..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                  autoFocus
                />
              </div>
            </TabsContent>

            {/* LFG Tab */}
            <TabsContent value="lfg" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="e.g., Need 1 more for doubles"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Details</Label>
                <Textarea
                  placeholder="Skill level, format, etc."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Spots</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Poll Tab */}
            <TabsContent value="poll" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Question *</Label>
                <Input
                  placeholder="e.g., Who's in for Saturday 9am?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Options (2–4). Each row is one option string. The composer
                  ignores blank rows when packing into poll_options so users
                  can add then ignore without manually pruning. */}
              <div className="space-y-2">
                <Label>Options ({pollOptions.filter((o) => o.trim()).length}/4)</Label>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        maxLength={80}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[i] = e.target.value;
                          setPollOptions(next);
                        }}
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove option ${i + 1}`}
                          onClick={() => {
                            setPollOptions(pollOptions.filter((_, j) => j !== i));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 4 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-primary h-8 -ml-2"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add option
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Additional details</Label>
                <Textarea
                  placeholder="Any context for the poll..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </TabsContent>

            {/* Photo Tab */}
            <TabsContent value="photo" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Caption</Label>
                <Textarea
                  placeholder="Add a caption..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              
              <ImageDropzone
                onFileSelect={setSelectedImage}
                preview={imagePreview}
                onRemove={handleRemoveImage}
                disabled={uploading || isSubmitting}
              />
              
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DrawerFooter className="flex-row gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isSubmitting || uploading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting || uploading}
            className="flex-1"
          >
            {uploading ? 'Uploading...' : isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
