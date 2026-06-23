import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Calendar, Clock, Users, Plus, Trash2, UserPlus, Search } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupEmptyState } from './GroupEmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGroupPosts, type GroupPost } from '@/hooks/useGroupPosts';
import { cn } from '@/lib/utils';

interface GroupLFGProps {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string | null;
}

export function GroupLFG({ groupId, isAdmin, currentUserId }: GroupLFGProps) {
  const { posts, loading, createPost, deletePost, joinLfgPost, leaveLfgPost } = useGroupPosts(groupId);
  const [joiningPostId, setJoiningPostId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('4');

  // Filter only LFG posts
  const lfgPosts = posts.filter(p => p.type === 'lfg');

  const resetForm = () => {
    setTitle('');
    setContent('');
    setSessionDate('');
    setSessionTime('');
    setMaxPlayers('4');
  };

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsCreating(true);
    const result = await createPost({
      type: 'lfg',
      title: title.trim(),
      content: content.trim() || undefined,
      session_date: sessionDate || undefined,
      session_time: sessionTime || undefined,
      max_players: maxPlayers ? parseInt(maxPlayers) : undefined,
    });

    if (result) {
      setCreateDialogOpen(false);
      resetForm();
    }
    setIsCreating(false);
  };

  const handleJoinToggle = async (post: typeof posts[0]) => {
    setJoiningPostId(post.id);
    if (post.user_joined) {
      await leaveLfgPost(post.id);
    } else {
      await joinLfgPost(post.id);
    }
    setJoiningPostId(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create LFG Button */}
      <Button onClick={() => setCreateDialogOpen(true)} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Post LFG
      </Button>

      {/* LFG Posts List */}
      {lfgPosts.length === 0 ? (
        <GroupEmptyState
          icon={Gamepad2}
          title="No one's looking for a game"
          description="Need players? Post an LFG to find others in the group."
          actions={[
            { label: 'Post LFG', onClick: () => setCreateDialogOpen(true), icon: Plus },
            { label: 'Browse Events', onClick: () => {}, variant: 'outline', icon: Search },
          ]}
        />
      ) : (
        lfgPosts.map((post) => {
          const isAuthor = currentUserId === post.user_id;
          const canDelete = isAuthor || isAdmin;
          const initials = (post.profile?.display_name || post.profile?.full_name || 'U')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={post.profile?.avatar_url || undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {post.profile?.display_name || post.profile?.full_name || 'Someone'}
                        </span>
                        {post.profile?.current_rating && (
                          <Badge variant="outline" className="text-xs h-5">
                            {post.profile.current_rating.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deletePost(post.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pb-3 space-y-3">
                <CardTitle className="text-lg">{post.title}</CardTitle>
                
                {post.content && (
                  <p className="text-sm text-muted-foreground">{post.content}</p>
                )}

                {/* Session Info */}
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  {post.session_date && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(post.session_date), 'EEE, MMM d')}
                    </div>
                  )}
                  {post.session_time && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {post.session_time}
                    </div>
                  )}
                  {post.max_players && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {post.participant_count || 0}/{post.max_players} joined
                    </div>
                  )}
                  {!post.max_players && (post.participant_count || 0) > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {post.participant_count} joined
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-0">
                {!isAuthor && (
                  <Button 
                    variant={post.user_joined ? "secondary" : "outline"} 
                    className="w-full gap-2"
                    onClick={() => handleJoinToggle(post)}
                    disabled={joiningPostId === post.id}
                  >
                    <UserPlus className="h-4 w-4" />
                    {joiningPostId === post.id 
                      ? 'Loading...' 
                      : post.user_joined 
                        ? 'Leave' 
                        : "I'm In!"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })
      )}

      {/* Create LFG Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Looking for Game</DialogTitle>
            <DialogDescription>
              Post to find players in this group
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Need 1 more for doubles"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Details</Label>
              <Textarea
                id="content"
                placeholder="Skill level, format, etc."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPlayers">Players Needed</Label>
              <Input
                id="maxPlayers"
                type="number"
                min="1"
                max="20"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!title.trim() || isCreating}
            >
              {isCreating ? 'Posting...' : 'Post LFG'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
