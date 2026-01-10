import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  ChevronUp, 
  Trash2, 
  Clock, 
  Loader2,
  Settings2,
  Zap
} from 'lucide-react';
import { useWaitlistSettings, useEventWaitlist, useWaitlistManagement } from '@/hooks/useWaitlistSettings';
import { formatDistanceToNow } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface WaitlistManagerProps {
  eventId: string;
  className?: string;
}

export function WaitlistManager({ eventId, className }: WaitlistManagerProps) {
  const { settings, isLoading: settingsLoading, updateSettings, isUpdating } = useWaitlistSettings(eventId);
  const { data: waitlist, isLoading: waitlistLoading } = useEventWaitlist(eventId);
  const { promoteNext, removeFromWaitlist, promotePlayer, isPromoting, isRemoving } = useWaitlistManagement(eventId);
  
  const [showSettings, setShowSettings] = useState(false);
  const [promotionHours, setPromotionHours] = useState(settings?.promotion_window_hours || 12);

  const isLoading = settingsLoading || waitlistLoading;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
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
              <Users className="h-5 w-5" />
              Waitlist
              {waitlist && waitlist.length > 0 && (
                <Badge variant="secondary">{waitlist.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Manage players waiting for spots
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => promoteNext()}
              disabled={isPromoting || !waitlist?.length}
            >
              {isPromoting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-1" />
              )}
              Promote Next
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Settings Panel */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent>
            <div className="p-4 bg-muted/50 rounded-lg space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-promote">Auto-promote</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically promote when spots open
                  </p>
                </div>
                <Switch
                  id="auto-promote"
                  checked={settings?.auto_promote ?? true}
                  onCheckedChange={(checked) => 
                    updateSettings({ auto_promote: checked })
                  }
                  disabled={isUpdating}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify-promotion">Notify on promotion</Label>
                  <p className="text-xs text-muted-foreground">
                    Send notification when promoted
                  </p>
                </div>
                <Switch
                  id="notify-promotion"
                  checked={settings?.notify_on_promotion ?? true}
                  onCheckedChange={(checked) => 
                    updateSettings({ notify_on_promotion: checked })
                  }
                  disabled={isUpdating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promotion-window">Claim window (hours)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="promotion-window"
                    type="number"
                    min={0}
                    max={72}
                    value={promotionHours}
                    onChange={(e) => setPromotionHours(parseInt(e.target.value) || 12)}
                    className="w-20"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => updateSettings({ promotion_window_hours: promotionHours })}
                    disabled={isUpdating || promotionHours === settings?.promotion_window_hours}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Time limit for promoted player to confirm (0 = no limit)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="charge-on-promotion">Charge on promotion</Label>
                  <p className="text-xs text-muted-foreground">
                    Wait to charge until promoted (vs on join)
                  </p>
                </div>
                <Switch
                  id="charge-on-promotion"
                  checked={settings?.charge_on_promotion ?? false}
                  onCheckedChange={(checked) => 
                    updateSettings({ charge_on_promotion: checked })
                  }
                  disabled={isUpdating}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Waitlist */}
        {!waitlist?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No one on the waitlist</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waitlist.map((registration: any, index: number) => (
              <div
                key={registration.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    #{index + 1}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={registration.profiles?.avatar_url} />
                    <AvatarFallback>
                      {registration.profiles?.display_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {registration.profiles?.display_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(registration.registered_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => promotePlayer(registration.id)}
                    disabled={isPromoting}
                    title="Promote"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromWaitlist(registration.id)}
                    disabled={isRemoving}
                    title="Remove"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
