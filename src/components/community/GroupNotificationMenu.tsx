import { Bell, BellOff, MessageSquare, Megaphone, Calendar, MessageCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useGroupNotificationPrefs, type GroupChannel } from '@/hooks/useGroupNotificationPrefs';

interface GroupNotificationMenuProps {
  groupId: string;
}

/**
 * Bell button in the group header. Opens a popover with per-channel
 * mute switches:
 *
 *   - Mute everything (toggles muted_all)
 *   - Posts          — feed posts, including LFG
 *   - Announcements  — pinned + announcement-type posts. Bypasses
 *                       "Mute everything" so the organizer can still
 *                       reach a muted member with critical alerts.
 *   - Events         — RSVP changes + scheduled reminders
 *   - Chat           — only relevant once push lands; in-app chat is
 *                       always rendered. Toggle is shown today so the
 *                       choice persists for Phase 3.3.
 *
 * The bell icon swaps to BellOff when muted_all is on, giving the user
 * an at-a-glance signal that this group is silenced.
 */
export function GroupNotificationMenu({ groupId }: GroupNotificationMenuProps) {
  const { prefs, setPref } = useGroupNotificationPrefs(groupId);
  const isMutedAll = prefs.muted_all;

  const channels: { key: GroupChannel; label: string; sub: string; icon: typeof Bell; alwaysOn?: boolean }[] = [
    { key: 'announcements', label: 'Announcements', sub: 'Pinned + critical broadcasts', icon: Megaphone, alwaysOn: true },
    { key: 'posts',         label: 'Posts',         sub: 'Updates and LFG',              icon: MessageSquare },
    { key: 'events',        label: 'Events',        sub: 'RSVPs and reminders',          icon: Calendar },
    { key: 'chat',          label: 'Chat',          sub: 'Push for new messages',        icon: MessageCircle },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 sm:h-8 sm:w-8 relative"
          aria-label={isMutedAll ? 'Notifications muted — open settings' : 'Open notification settings'}
        >
          {isMutedAll ? (
            <BellOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="px-4 py-3 border-b border-border/40">
          <div className="text-sm font-semibold">Notifications</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            What this group can send you
          </div>
        </div>

        {/* Master mute — flips muted_all. Announcements still go through. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0',
              isMutedAll ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
            )}>
              {isMutedAll ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Mute everything</div>
              <div className="text-[11px] text-muted-foreground truncate">
                Announcements still come through
              </div>
            </div>
          </div>
          <Switch
            checked={isMutedAll}
            onCheckedChange={(checked) => setPref('all', !checked)}
          />
        </div>

        {/* Per-channel toggles. */}
        <div className="py-1.5">
          {channels.map((c) => {
            const Icon = c.icon;
            const checked = (prefs as any)[c.key] as boolean;
            // muted_all collapses every non-announcement row to "off"
            // visually so it's obvious why the group is quiet.
            const effective = c.alwaysOn ? checked : !isMutedAll && checked;
            const disabled = !c.alwaysOn && isMutedAll;
            return (
              <div
                key={c.key}
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-2',
                  disabled && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.sub}</div>
                  </div>
                </div>
                <Switch
                  checked={effective}
                  disabled={disabled}
                  onCheckedChange={(v) => setPref(c.key, v)}
                />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
