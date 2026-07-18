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
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-left">New message</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-3">
          <SearchField
            autoFocus
            placeholder="Search friends..."
            value={query}
            onValueChange={setQuery}
            className="h-10"
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
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <MessageCircle className="h-5 w-5 text-muted-foreground/70" />
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
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left disabled:opacity-60"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={f.profile.avatar_url || undefined} />
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
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
