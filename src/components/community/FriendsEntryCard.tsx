import { useNavigate } from 'react-router-dom';
import { ChevronRight, UserPlus, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useFriends } from '@/hooks/useFriends';

const initials = (name: string | null) =>
  (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export function FriendsEntryCard() {
  const navigate = useNavigate();
  const { friends, pendingRequests, loading } = useFriends();

  const go = () => navigate('/player/friends');

  if (loading) {
    return (
      <button
        onClick={go}
        className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99] text-left"
      >
        <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center">
          <Users className="h-5 w-5 text-muted-foreground/60" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Friends</div>
          <div className="text-xs text-muted-foreground">Loading…</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  const count = friends.length;
  const pending = pendingRequests.length;
  const preview = friends.slice(0, 4);

  if (count === 0 && pending === 0) {
    return (
      <button
        onClick={go}
        className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99] text-left"
      >
        <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
          <UserPlus className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Add friends to play with</div>
          <div className="text-xs text-muted-foreground">Find players you know</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <button
      onClick={go}
      className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99] text-left"
    >
      {preview.length > 0 ? (
        <div className="flex -space-x-2 shrink-0">
          {preview.map((f) => (
            <Avatar key={f.id} className="h-9 w-9 ring-2 ring-card">
              <AvatarImage src={f.profile.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {initials(f.profile.display_name || f.profile.full_name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      ) : (
        <div className="h-10 w-10 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Friends</span>
          {pending > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
              {pending} new
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {count} {count === 1 ? 'friend' : 'friends'}
          {pending > 0 ? ` · ${pending} pending` : ''}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
