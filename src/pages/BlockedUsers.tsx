import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useBlockedUsers } from '@/hooks/useMessagingSafety';

const initials = (n: string | null) =>
  (n || 'U').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2);

export default function BlockedUsers() {
  const navigate = useNavigate();
  const { blocked, loading, unblock } = useBlockedUsers();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Blocked users</h1>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-3">
        <p className="text-sm text-muted-foreground">
          Blocked users can't message you, add you to groups, or trigger notifications to you.
        </p>

        {loading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
        ) : blocked.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Shield className="h-5 w-5 text-muted-foreground/70" />
            </div>
            <h3 className="text-base font-medium mb-1">No one blocked</h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              You haven't blocked anyone yet.
            </p>
          </div>
        ) : (
          blocked.map(b => {
            const name = b.profile?.display_name || b.profile?.full_name || 'Player';
            return (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={b.profile?.avatar_url || undefined} />
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground">Blocked</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => unblock(b.blocked_id)}>
                  <UserCheck className="h-4 w-4 mr-1.5" /> Unblock
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
