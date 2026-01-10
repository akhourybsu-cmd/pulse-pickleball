import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Megaphone, 
  Send, 
  Clock, 
  Users,
  Mail,
  Bell,
  Loader2,
  Calendar,
  Trash2
} from 'lucide-react';
import { useVenueAnnouncements } from '@/hooks/useVenueAnnouncements';
import { useVenueFollowers } from '@/hooks/useVenueFollow';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AnnouncementComposerProps {
  venueId: string;
  className?: string;
}

export function AnnouncementComposer({ venueId, className }: AnnouncementComposerProps) {
  const { 
    sentAnnouncements, 
    scheduledAnnouncements,
    isLoading, 
    createAnnouncement, 
    deleteAnnouncement,
    sendNow,
    isCreating,
    isSending
  } = useVenueAnnouncements(venueId);
  const { data: followersData } = useVenueFollowers(venueId);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'followers' | 'past_attendees' | 'all'>('followers');

  const handleSend = () => {
    if (!title.trim() || !message.trim()) return;
    
    createAnnouncement({
      title: title.trim(),
      message: message.trim(),
      target_audience: audience,
      channels: ['in_app'],
      send_immediately: true,
    });
    
    setTitle('');
    setMessage('');
    setIsDialogOpen(false);
  };

  const followerCount = followersData?.count || 0;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Announcements
            </CardTitle>
            <CardDescription>
              Communicate with your followers
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Send className="h-4 w-4 mr-1" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Announcement</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Weekend Tournament Reminder"
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your announcement..."
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {message.length}/500
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience">Audience</Label>
                  <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="followers">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          Followers ({followerCount})
                        </div>
                      </SelectItem>
                      <SelectItem value="past_attendees">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Past Attendees
                        </div>
                      </SelectItem>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          All
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Will be sent as in-app notification
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSend}
                  disabled={isCreating || !title.trim() || !message.trim()}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Send Now
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Scheduled Announcements */}
        {scheduledAnnouncements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled
            </h4>
            {scheduledAnnouncements.map((announcement) => (
              <div 
                key={announcement.id}
                className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Scheduled for {format(new Date(announcement.scheduled_for!), 'PPp')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendNow(announcement.id)}
                      disabled={isSending}
                    >
                      Send Now
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sent Announcements */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Announcements</h4>
          {sentAnnouncements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No announcements sent yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sentAnnouncements.slice(0, 5).map((announcement) => (
                <div 
                  key={announcement.id}
                  className="p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{announcement.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {announcement.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {announcement.target_audience}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(announcement.sent_at!), { addSuffix: true })}
                        </span>
                        {announcement.recipient_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            • {announcement.recipient_count} recipients
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAnnouncement(announcement.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
