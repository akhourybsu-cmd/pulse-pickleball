import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, Bell, BellOff, Loader2 } from 'lucide-react';
import { useVenueFollow } from '@/hooks/useVenueFollow';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface FollowButtonProps {
  venueId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function FollowButton({
  venueId,
  variant = 'outline',
  size = 'default',
  showLabel = true,
  className,
}: FollowButtonProps) {
  const { 
    isFollowing, 
    followStatus,
    isLoading, 
    toggleFollow, 
    updatePreferences,
    isToggling 
  } = useVenueFollow(venueId);
  
  const [showPreferences, setShowPreferences] = useState(false);

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (isFollowing && showLabel) {
    return (
      <Popover open={showPreferences} onOpenChange={setShowPreferences}>
        <PopoverTrigger asChild>
          <Button
            variant="default"
            size={size}
            className={cn('gap-2', className)}
          >
            <Heart className="h-4 w-4 fill-current" />
            Following
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="font-medium">Notification Settings</div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-events" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  New Events
                </Label>
                <Switch
                  id="notify-events"
                  checked={followStatus?.notify_new_events ?? true}
                  onCheckedChange={(checked) => 
                    updatePreferences({ notify_new_events: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-announcements" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Announcements
                </Label>
                <Switch
                  id="notify-announcements"
                  checked={followStatus?.notify_announcements ?? true}
                  onCheckedChange={(checked) => 
                    updatePreferences({ notify_announcements: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-schedule" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Schedule Changes
                </Label>
                <Switch
                  id="notify-schedule"
                  checked={followStatus?.notify_schedule_changes ?? true}
                  onCheckedChange={(checked) => 
                    updatePreferences({ notify_schedule_changes: checked })
                  }
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                toggleFollow();
                setShowPreferences(false);
              }}
              disabled={isToggling}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <BellOff className="h-4 w-4 mr-2" />
              )}
              Unfollow
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleFollow}
      disabled={isToggling}
      className={cn('gap-2', className)}
    >
      {isToggling ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn('h-4 w-4', isFollowing && 'fill-current')} />
      )}
      {showLabel && (isFollowing ? 'Following' : 'Follow')}
    </Button>
  );
}
