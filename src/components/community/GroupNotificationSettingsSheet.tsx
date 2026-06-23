import { useEffect, useState, useCallback } from 'react';
import { BellOff, MessageSquare, Megaphone, Calendar, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Channel = 'all' | 'posts' | 'announcements' | 'events' | 'chat';

type Prefs = {
  muted_all: boolean;
  posts: boolean;
  announcements: boolean;
  events: boolean;
  chat: boolean;
};

const DEFAULTS: Prefs = {
  muted_all: false,
  posts: true,
  announcements: true,
  events: true,
  chat: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName?: string;
}

export function GroupNotificationSettingsSheet({ open, onOpenChange, groupId, groupName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Channel | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    if (!open || !groupId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('group_notification_prefs')
        .select('muted_all,posts,announcements,events,chat')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setPrefs(data ? { ...DEFAULTS, ...data } : DEFAULTS);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, groupId]);

  const update = useCallback(async (channel: Channel, enabled: boolean) => {
    setSaving(channel);
    // Optimistic
    setPrefs((p) => {
      if (channel === 'all') return { ...p, muted_all: !enabled };
      return { ...p, [channel]: enabled } as Prefs;
    });
    const { error } = await supabase.rpc('set_group_notification_pref', {
      p_group_id: groupId,
      p_channel: channel,
      p_enabled: enabled,
    });
    setSaving(null);
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
      // Revert
      setPrefs((p) => {
        if (channel === 'all') return { ...p, muted_all: enabled };
        return { ...p, [channel]: !enabled } as Prefs;
      });
    }
  }, [groupId, toast]);

  const channelMuted = prefs.muted_all;

  const rows: Array<{ key: Exclude<Channel, 'all'>; label: string; desc: string; icon: React.ReactNode }> = [
    { key: 'announcements', label: 'Announcements', desc: 'Pinned posts and group-wide alerts', icon: <Megaphone className="h-4 w-4" /> },
    { key: 'posts', label: 'Posts & replies', desc: 'New posts, comments on your posts, mentions', icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'events', label: 'Events', desc: 'New events, RSVPs, reminders', icon: <Calendar className="h-4 w-4" /> },
    { key: 'chat', label: 'Chat', desc: 'New messages in group chat', icon: <MessageCircle className="h-4 w-4" /> },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Choose what you want to be notified about{groupName ? ` in ${groupName}` : ''}.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 mt-4">
            {[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {/* Mute all */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-background"><BellOff className="h-4 w-4" /></div>
                <div>
                  <p className="font-medium text-sm">Mute this community</p>
                  <p className="text-xs text-muted-foreground">
                    Silences everything except announcements
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.muted_all}
                disabled={saving === 'all'}
                onCheckedChange={(v) => update('all', !v)}
              />
            </div>

            <div className="pt-2 pb-1 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Notify me about
            </div>

            {rows.map((row) => {
              const isAnnouncements = row.key === 'announcements';
              const disabled = saving === row.key || (channelMuted && !isAnnouncements);
              return (
                <div
                  key={row.key}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border border-border/30 bg-card',
                    disabled && !isAnnouncements && 'opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted/50">{row.icon}</div>
                    <div>
                      <p className="font-medium text-sm">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs[row.key]}
                    disabled={disabled}
                    onCheckedChange={(v) => update(row.key, v)}
                  />
                </div>
              );
            })}

            <p className="pt-2 text-[11px] text-muted-foreground text-center">
              Announcements always come through, even when muted.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
