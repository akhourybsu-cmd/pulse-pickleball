import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User as UserIcon,
  Settings,
  Bell,
  Users,
  MessageSquare,
  Calendar,
  ClipboardList,
  Download,
  LogOut,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileSummary {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
}

interface HubLink {
  to: string;
  icon: typeof UserIcon;
  label: string;
  description: string;
}

const HUB_LINKS: HubLink[] = [
  {
    to: '/player/my-events',
    icon: Calendar,
    label: 'My Events',
    description: 'Upcoming and past registrations',
  },
  {
    to: '/player/my-bookings',
    icon: ClipboardList,
    label: 'My Bookings',
    description: 'Court reservations',
  },
  {
    to: '/player/community',
    icon: Users,
    label: 'Community',
    description: 'Groups and friends',
  },
  {
    to: '/player/messages',
    icon: MessageSquare,
    label: 'Messages',
    description: 'Direct conversations',
  },
  {
    to: '/settings/notifications',
    icon: Bell,
    label: 'Notifications',
    description: 'Manage what reaches you',
  },
  {
    to: '/profile/data-export',
    icon: Download,
    label: 'Export Data',
    description: 'Download your match history',
  },
];

export default function PlayerProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url, current_rating')
        .eq('id', user.id)
        .maybeSingle();

      if (!cancelled) {
        setProfile(data as ProfileSummary | null);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const initials = (profile?.display_name || profile?.full_name || 'Player')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your account hub</p>
      </div>

      {/* Identity card */}
      <Card className="mt-4">
        <CardContent className="p-5 flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/40">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || ''} />
            <AvatarFallback className="text-lg font-bold bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-lg truncate">
              {loading ? '…' : (profile?.display_name || profile?.full_name || 'Player')}
            </div>
            {profile?.current_rating != null && (
              <div className="text-sm text-muted-foreground">
                PULSE rating · <span className="font-medium text-foreground">{Number(profile.current_rating).toFixed(2)}</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => profile && navigate(`/profile/${profile.id}`)}
            aria-label="View public profile"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>

      {/* Quick edit row */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="outline" className="justify-start" onClick={() => navigate('/profile/edit')}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit profile
        </Button>
        <Button variant="outline" className="justify-start" onClick={() => navigate('/settings/notifications')}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Hub links */}
      <div className="mt-6 space-y-2">
        {HUB_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.to}
              onClick={() => navigate(link.to)}
              className={cn(
                'w-full flex items-center gap-4 rounded-xl border border-border/60 bg-card px-4 py-3.5',
                'hover:bg-accent/40 active:scale-[0.99] transition-all text-left'
              )}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{link.label}</div>
                <div className="text-xs text-muted-foreground truncate">{link.description}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Sign out */}
      <div className="mt-8">
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
