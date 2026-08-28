import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SearchField } from '@/components/ui/search-field';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFriends } from '@/hooks/useFriends';
import { useDirectMessages } from '@/hooks/useDirectMessages';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const initials = (n: string | null) =>
  (n || 'U').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2);

export function MessageFriendPickerSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { friends, loading } = useFriends();
  const { startConversation } = useDirectMessages();
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(f => {
      const name = f.profile.display_name || f.profile.full_name || '';
      return name.toLowerCase().includes(q);
    });
  }, [friends, query]);

  const handleSelect = async (userId: string) => {
    setOpening(userId);
    const convoId = await startConversation(userId);
    setOpening(null);
    if (convoId) {
      onOpenChange(false);
      navigate(`/player/messages/${convoId}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85dvh] p-0 flex flex-col">
        {/* Premium header band — ambient bloom + accent-ruled eyebrow. */}
        <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-primary/[0.10] via-primary/[0.03] to-background">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -left-10 h-44 w-44 rounded-full blur-3xl opacity-[0.18]"
            style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
          />
          <SheetHeader className="relative px-4 pb-3 pt-4 text-left">
            <div className="relative pl-3.5">
              <span
                aria-hidden
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary to-primary/25"
              />
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80">
                Direct message
              </div>
              <SheetTitle className="text-left text-[19px] font-extrabold tracking-tight">
                New message
              </SheetTitle>
            </div>
          </SheetHeader>
        </div>
        <div className="px-4 pb-3 pt-3">
          <SearchField
            autoFocus
            placeholder="Search friends..."
            value={query}
            onValueChange={setQuery}
            className="h-10 rounded-xl border-border/60 bg-card/70 backdrop-blur-sm"
            aria-label="Search your friends"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6">
              <div className="relative mb-3">
                <div aria-hidden className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm font-medium mb-1">
                {friends.length === 0 ? 'No friends yet' : 'No matches'}
              </p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                {friends.length === 0
                  ? 'Add friends to start a conversation.'
                  : 'Try a different name.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map(f => {
                const name = f.profile.display_name || f.profile.full_name || 'Player';
                return (
                  <li key={f.id}>
                    <button
                      onClick={() => handleSelect(f.profile.id)}
                      disabled={opening === f.profile.id}
                      className="w-full flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/60 hover:bg-card/70 hover:backdrop-blur-sm disabled:opacity-60"
                    >
                      <Avatar className="h-10 w-10 ring-1 ring-border/60">
                        <AvatarImage src={f.profile.avatar_url || undefined} />
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
                        {f.profile.current_rating != null && (
                          <p className="text-xs text-muted-foreground">
                            {Number(f.profile.current_rating).toFixed(2)} rating
                          </p>
                        )}
                      </div>
                      {opening === f.profile.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
