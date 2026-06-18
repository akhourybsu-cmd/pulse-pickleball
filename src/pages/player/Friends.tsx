import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, UserMinus, Check, X, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFriends } from '@/hooks/useFriends';
import { useFriendSuggestions } from '@/hooks/useFriendSuggestions';
import { ConnectSheet } from '@/components/community/ConnectSheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const initials = (name: string | null) =>
  (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export default function Friends() {
  const navigate = useNavigate();
  const [connectOpen, setConnectOpen] = useState(false);
  const {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    acceptRequest,
    declineRequest,
    removeFriend,
    sendFriendRequest,
  } = useFriends();
  const { suggestions, loading: suggestionsLoading, refetch: refetchSuggestions } = useFriendSuggestions();

  const openDM = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc('get_or_create_dm_conversation', {
        other_user_id: userId,
      });
      if (error) throw error;
      navigate(`/player/messages/${data}`);
    } catch (e) {
      console.error(e);
      toast.error('Could not open conversation');
    }
  };

  const totalRequests = pendingRequests.length + sentRequests.length;

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/player/community')}
          className="h-8 w-8"
          aria-label="Back to Community"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold font-display">Friends</h1>
      </div>

      <Tabs defaultValue="friends" className="flex-1 flex flex-col">
        <div className="px-4 sm:px-6 pt-3">
          <TabsList className="w-full h-11 bg-muted/40 p-1 rounded-xl grid grid-cols-3">
            <TabsTrigger value="friends" className="h-9 rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Friends
              {friends.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{friends.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="requests" className="h-9 rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Requests
              {totalRequests > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] font-semibold">
                  {totalRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="h-9 rounded-lg text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Suggestions
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Friends list */}
          <TabsContent value="friends" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : friends.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5 text-muted-foreground/70" />}
                title="No friends yet"
                description="Find people you play with in Suggestions or invite them to a group."
              />
            ) : (
              friends.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={f.profile.avatar_url || undefined} />
                    <AvatarFallback>{initials(f.profile.display_name || f.profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => navigate(`/player/profile?userId=${f.profile.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm font-medium truncate">
                      {f.profile.display_name || f.profile.full_name || 'Player'}
                    </div>
                    {f.profile.current_rating != null && (
                      <div className="text-xs text-muted-foreground">
                        Rating {f.profile.current_rating.toFixed(2)}
                      </div>
                    )}
                  </button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openDM(f.profile.id)} aria-label="Message">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => removeFriend(f.id)} aria-label="Remove friend">
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          {/* Requests */}
          <TabsContent value="requests" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-6">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Received {pendingRequests.length > 0 && `(${pendingRequests.length})`}
              </h2>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incoming requests.</p>
              ) : (
                pendingRequests.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={r.profile.avatar_url || undefined} />
                      <AvatarFallback>{initials(r.profile.display_name || r.profile.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.profile.display_name || r.profile.full_name || 'Player'}
                      </div>
                      <div className="text-xs text-muted-foreground">Wants to be friends</div>
                    </div>
                    <Button size="icon" className="h-9 w-9 rounded-full" onClick={() => acceptRequest(r.id)} aria-label="Accept">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => declineRequest(r.id)} aria-label="Decline">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Sent {sentRequests.length > 0 && `(${sentRequests.length})`}
              </h2>
              {sentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending sent requests.</p>
              ) : (
                sentRequests.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={r.profile.avatar_url || undefined} />
                      <AvatarFallback>{initials(r.profile.display_name || r.profile.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.profile.display_name || r.profile.full_name || 'Player'}
                      </div>
                      <div className="text-xs text-muted-foreground">Request sent</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => declineRequest(r.id)}>
                      Cancel
                    </Button>
                  </div>
                ))
              )}
            </section>
          </TabsContent>

          {/* Suggestions */}
          <TabsContent value="suggestions" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-3">
            {suggestionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : suggestions.length === 0 ? (
              <EmptyState
                icon={<UserPlus className="h-5 w-5 text-muted-foreground/70" />}
                title="No suggestions right now"
                description="Play matches or join groups — we'll suggest people you might know."
              />
            ) : (
              suggestions.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={s.avatar_url || undefined} />
                    <AvatarFallback>{initials(s.display_name || s.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.display_name || s.full_name || 'Player'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{s.reason}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const ok = await sendFriendRequest(s.id);
                      if (ok) refetchSuggestions();
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Add
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>
    </div>
  );
}
