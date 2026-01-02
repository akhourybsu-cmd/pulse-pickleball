import { useState } from 'react';
import { Send, Image, BarChart3, Calendar, Gamepad2, Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type PostType = 'post' | 'photo' | 'poll' | 'event' | 'lfg' | 'result';

interface QuickPostComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: PostType;
  onSubmit: (data: {
    type: string;
    content?: string;
    title?: string;
    session_date?: string;
    session_time?: string;
    max_players?: number;
  }) => Promise<boolean>;
}

export function QuickPostComposer({ 
  open, 
  onOpenChange, 
  initialType = 'post',
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

  const resetForm = () => {
    setContent('');
    setTitle('');
    setSessionDate('');
    setSessionTime('');
    setMaxPlayers('4');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    let data: any = {};
    
    switch (activeTab) {
      case 'post':
      case 'photo':
        data = { type: 'feed', content: content.trim() };
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
      case 'poll':
        data = { type: 'poll', title: title.trim(), content: content.trim() };
        break;
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

  const canSubmit = () => {
    switch (activeTab) {
      case 'post':
      case 'photo':
        return content.trim().length > 0;
      case 'lfg':
        return title.trim().length > 0;
      case 'poll':
        return title.trim().length > 0;
      default:
        return content.trim().length > 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
          <DialogDescription>
            Share something with the group
          </DialogDescription>
        </DialogHeader>

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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
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
            <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
              <Image className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Photo upload coming soon</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
