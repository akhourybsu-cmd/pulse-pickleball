import { useState, useEffect } from 'react';
import {
  BarChart3,
  Camera,
  LockKeyhole,
  Megaphone,
  MessageSquareText,
  Plus,
  UsersRound,
  X,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

export type PostType = 'post' | 'photo' | 'poll' | 'event' | 'lfg' | 'result' | 'announcement';
export type ComposerPostType = 'post' | 'photo' | 'poll' | 'lfg' | 'announcement';

interface PostSubmission {
  type: 'feed' | 'lfg' | 'poll' | 'announcement';
  content?: string;
  title?: string;
  session_date?: string;
  session_time?: string;
  max_players?: number;
  image_url?: string;
  poll_options?: { idx: number; text: string }[];
}

interface QuickPostComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: PostType;
  groupId: string;
  contextName?: string;
  venueMode?: boolean;
  canPostAnnouncements?: boolean;
  canPostLfg?: boolean;
  onSubmit: (data: PostSubmission) => Promise<boolean>;
}

const COMPOSER_TYPES: Array<{
  value: ComposerPostType;
  label: string;
  description: string;
  icon: typeof MessageSquareText;
}> = [
  {
    value: 'post',
    label: 'Update',
    description: 'Share news or start a conversation',
    icon: MessageSquareText,
  },
  {
    value: 'announcement',
    label: 'Announcement',
    description: 'Publish an official venue update',
    icon: Megaphone,
  },
  {
    value: 'lfg',
    label: 'Find players',
    description: 'Fill open spots for a game',
    icon: UsersRound,
  },
  {
    value: 'poll',
    label: 'Poll',
    description: 'Let the community choose',
    icon: BarChart3,
  },
  {
    value: 'photo',
    label: 'Photo',
    description: 'Share a moment from the venue',
    icon: Camera,
  },
];

export function QuickPostComposer({ 
  open, 
  onOpenChange, 
  initialType = 'post',
  groupId,
  contextName = 'this community',
  venueMode = false,
  canPostAnnouncements = false,
  canPostLfg = true,
  onSubmit 
}: QuickPostComposerProps) {
  const [activeTab, setActiveTab] = useState<ComposerPostType>(
    initialType === 'announcement' ? 'announcement' :
      initialType === 'photo' || initialType === 'poll' || initialType === 'lfg' ? initialType : 'post',
  );
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
      const requestedType =
        initialType === 'announcement' ? 'announcement' :
          initialType === 'photo' || initialType === 'poll' || initialType === 'lfg' ? initialType : 'post';
      setActiveTab(requestedType === 'lfg' && !canPostLfg ? 'post' : requestedType);
    }
  }, [canPostLfg, initialType, open]);

  const visibleTypes = COMPOSER_TYPES.filter(
    (type) =>
      (type.value !== 'announcement' || canPostAnnouncements) &&
      (type.value !== 'lfg' || canPostLfg),
  );
  const activeType = COMPOSER_TYPES.find((type) => type.value === activeTab) ?? COMPOSER_TYPES[0];

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
    
    let data: PostSubmission;
    
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
      case 'announcement':
        data = {
          type: 'announcement',
          title: title.trim(),
          content: content.trim(),
        };
        break;
      default:
        data = { type: 'feed', content: content.trim() };
    }

    try {
      const success = await onSubmit(data);
      if (success) {
        resetForm();
        onOpenChange(false);
      }
    } catch (error) {
      // The data hook owns the user-facing error toast. The composer still
      // needs to recover its controls when a mutation rejects.
      console.error('Post submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
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
      case 'announcement':
        return title.trim().length > 0 && content.trim().length > 0;
      default:
        return content.trim().length > 0;
    }
  };

  const submitLabel: Record<ComposerPostType, string> = {
    post: 'Share update',
    photo: 'Post photo',
    poll: 'Publish poll',
    lfg: 'Find players',
    announcement: 'Publish update',
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          'flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-[28px] border-border/70 p-0',
          venueMode &&
            'lg:bottom-6 lg:left-1/2 lg:right-auto lg:h-[min(760px,calc(100dvh-3rem))] lg:max-h-[760px] lg:w-[min(640px,calc(100vw-3rem))] lg:-translate-x-1/2 lg:rounded-[28px] lg:shadow-2xl [&>div:first-child]:lg:hidden',
        )}
      >
        <DrawerHeader className="shrink-0 border-b border-border/60 px-0 pb-4 pt-4 text-left">
          <div className="mx-auto w-full max-w-xl px-4 sm:px-6">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <LockKeyhole className="h-3 w-3" aria-hidden />
              Visible to {contextName} members
            </div>
            <DrawerTitle className="text-xl font-semibold tracking-[-0.025em]">
              {venueMode ? `Share with ${contextName}` : 'Create a post'}
            </DrawerTitle>
            <p className="mt-1 text-sm text-muted-foreground">{activeType.description}</p>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-xl px-4 py-4 sm:px-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ComposerPostType)} className="w-full">
            <TabsList
              className={cn(
                '-mx-4 flex h-auto w-[calc(100%+2rem)] justify-start gap-2 overflow-x-auto rounded-none bg-transparent px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:w-full sm:px-0',
                venueMode && 'lg:gap-1.5 lg:overflow-visible',
              )}
            >
              {visibleTypes.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    'h-10 shrink-0 gap-1.5 rounded-full border border-border/70 bg-card px-3.5 text-xs font-semibold text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm',
                    venueMode && 'lg:px-2.5',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Post Tab */}
            <TabsContent value="post" className="mt-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="venue-post-content" className="text-sm font-semibold">Your update</Label>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{content.length}/2000</span>
                </div>
                <Textarea
                  id="venue-post-content"
                  placeholder={`What should ${contextName} know?`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={2000}
                  className="min-h-[180px] resize-none rounded-2xl border-border/70 bg-muted/20 px-4 py-3 text-base leading-6 shadow-none focus-visible:bg-background"
                />
              </div>
            </TabsContent>

            {/* LFG Tab */}
            <TabsContent value="lfg" className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="lfg-title" className="text-sm font-semibold">What are you playing?</Label>
                <Input
                  id="lfg-title"
                  placeholder="Need one more for doubles"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  className="h-12 rounded-xl border-border/70 bg-background px-3.5 text-base shadow-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lfg-details" className="text-sm font-semibold">Details</Label>
                <Textarea
                  id="lfg-details"
                  placeholder="Skill level, format, court, or anything players should know"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={1000}
                  className="min-h-[110px] resize-none rounded-2xl border-border/70 bg-muted/20 px-4 py-3 text-base leading-6 shadow-none"
                />
              </div>
              <div className="rounded-2xl bg-muted/35 p-3.5">
                <p className="mb-3 text-sm font-semibold">When and how many</p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="lfg-date" className="text-xs text-muted-foreground">Date</Label>
                  <Input
                    id="lfg-date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="h-11 rounded-xl border-border/70 bg-background shadow-none"
                  />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="lfg-time" className="text-xs text-muted-foreground">Time</Label>
                    <Input
                      id="lfg-time"
                      type="time"
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                      className="h-11 rounded-xl border-border/70 bg-background shadow-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lfg-spots" className="text-xs text-muted-foreground">Spots available</Label>
                    <Input
                      id="lfg-spots"
                      type="number"
                      min="1"
                      max="20"
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(e.target.value)}
                      className="h-11 rounded-xl border-border/70 bg-background shadow-none"
                    />
                  </div>
                </div>
                </div>
              </div>
            </TabsContent>

            {/* Poll Tab */}
            <TabsContent value="poll" className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="poll-question" className="text-sm font-semibold">Question</Label>
                <Input
                  id="poll-question"
                  placeholder="Which clinic time works best?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  className="h-12 rounded-xl border-border/70 bg-background px-3.5 text-base shadow-none"
                />
              </div>

              {/* Options (2–4). Each row is one option string. The composer
                  ignores blank rows when packing into poll_options so users
                  can add then ignore without manually pruning. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-semibold">Choices</Label>
                  <span className="text-[11px] text-muted-foreground">{pollOptions.filter((o) => o.trim()).length}/4</span>
                </div>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <Input
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        maxLength={80}
                        className="h-11 rounded-xl border-border/70 bg-background shadow-none"
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
                          className="h-9 w-9 flex-shrink-0 rounded-full text-muted-foreground hover:text-destructive"
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
                    className="-ml-2 h-9 rounded-full text-primary"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add option
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="poll-details" className="text-sm font-semibold">Helpful context <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="poll-details"
                  placeholder="Add a little context for members"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={1000}
                  className="min-h-[100px] resize-none rounded-2xl border-border/70 bg-muted/20 px-4 py-3 text-base leading-6 shadow-none"
                />
              </div>
            </TabsContent>

            {/* Photo Tab */}
            <TabsContent value="photo" className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="photo-caption" className="text-sm font-semibold">Caption <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="photo-caption"
                  placeholder={`Say something about this moment at ${contextName}`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={1000}
                  className="min-h-[100px] resize-none rounded-2xl border-border/70 bg-muted/20 px-4 py-3 text-base leading-6 shadow-none"
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

            {canPostAnnouncements && (
              <TabsContent value="announcement" className="mt-5 space-y-4">
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-3">
                  <div className="flex items-start gap-2.5">
                    <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold">Official venue update</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        This will be clearly marked as an announcement from {contextName}.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-title" className="text-sm font-semibold">Headline</Label>
                  <Input
                    id="announcement-title"
                    placeholder="Court closure, schedule change, or venue news"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    className="h-12 rounded-xl border-border/70 bg-background px-3.5 text-base shadow-none"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="announcement-content" className="text-sm font-semibold">Details</Label>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{content.length}/2000</span>
                  </div>
                  <Textarea
                    id="announcement-content"
                    placeholder="Give members the details they need"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    maxLength={2000}
                    className="min-h-[180px] resize-none rounded-2xl border-border/70 bg-muted/20 px-4 py-3 text-base leading-6 shadow-none"
                  />
                </div>
              </TabsContent>
            )}
          </Tabs>
          </div>
        </div>

        <DrawerFooter className="shrink-0 border-t border-border/60 bg-background/95 p-0 backdrop-blur [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 pt-3 sm:px-6">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || uploading}
              className="h-11 rounded-xl px-4 text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit() || isSubmitting || uploading}
              className="h-11 flex-1 rounded-xl text-sm font-semibold shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.8)]"
            >
              {uploading ? 'Uploading…' : isSubmitting ? 'Posting…' : submitLabel[activeTab]}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
