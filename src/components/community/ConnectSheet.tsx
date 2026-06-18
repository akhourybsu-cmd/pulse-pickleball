import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Search, UserPlus, Check, Clock, QrCode, Copy, Share2,
  Sparkles, AtSign, Loader2, Users,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useFriends } from '@/hooks/useFriends';
import { useFriendSuggestions, type SuggestedFriend } from '@/hooks/useFriendSuggestions';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

interface ConnectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  handle: string | null;
  reason?: string;
}

const getInitials = (name: string | null) =>
  (name || 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const displayName = (p: { display_name: string | null; full_name: string | null }) =>
  p.display_name || p.full_name || 'Unknown';

export function ConnectSheet({ open, onOpenChange }: ConnectSheetProps) {
  const { sendFriendRequest, getFriendshipStatus, currentUserId } = useFriends();
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Load my handle
  useEffect(() => {
    if (!open || !currentUserId) return;
    supabase
      .from('profiles')
      .select('handle')
      .eq('id', currentUserId)
      .maybeSingle()
      .then(({ data }) => setMyHandle(data?.handle ?? null));
  }, [open, currentUserId]);

  const handleAdd = async (userId: string) => {
    setSendingTo(userId);
    await sendFriendRequest(userId);
    setSendingTo(null);
  };

  const actionButton = (userId: string) => {
    const status = getFriendshipStatus(userId);
    if (status === 'accepted') {
      return (
        <Button variant="outline" size="sm" disabled className="h-8 shrink-0">
          <Check className="h-3.5 w-3.5 mr-1" /> Friends
        </Button>
      );
    }
    if (status === 'pending_sent') {
      return (
        <Button variant="outline" size="sm" disabled className="h-8 shrink-0">
          <Clock className="h-3.5 w-3.5 mr-1" /> Pending
        </Button>
      );
    }
    if (status === 'pending_received') {
      return (
        <Button variant="secondary" size="sm" className="h-8 shrink-0" onClick={() => handleAdd(userId)}>
          Accept
        </Button>
      );
    }
    return (
      <Button size="sm" className="h-8 shrink-0" onClick={() => handleAdd(userId)} disabled={sendingTo === userId}>
        {sendingTo === userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (<><UserPlus className="h-3.5 w-3.5 mr-1" />Add</>)}
      </Button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] p-0 flex flex-col rounded-t-2xl">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30 text-left">
          <SheetTitle className="font-display text-xl">Connect with players</SheetTitle>
          <SheetDescription className="text-xs">
            Add friends from people you've played with — no public directory.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="suggested" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3">
            <TabsList className="grid grid-cols-4 h-9 w-full">
              <TabsTrigger value="suggested" className="text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1" />For you
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs">
                <QrCode className="h-3.5 w-3.5 mr-1" />My code
              </TabsTrigger>
              <TabsTrigger value="enter" className="text-xs">
                <AtSign className="h-3.5 w-3.5 mr-1" />Enter
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs">
                <Search className="h-3.5 w-3.5 mr-1" />Search
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="suggested" className="m-0 p-5">
              <SuggestionsPanel actionButton={actionButton} />
            </TabsContent>

            <TabsContent value="code" className="m-0 p-5">
              <MyCodePanel handle={myHandle} displayNameStr={displayName} />
            </TabsContent>

            <TabsContent value="enter" className="m-0 p-5">
              <EnterCodePanel actionButton={actionButton} />
            </TabsContent>

            <TabsContent value="search" className="m-0 p-5">
              <ScopedSearchPanel actionButton={actionButton} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Suggestions ----------
function SuggestionsPanel({ actionButton }: { actionButton: (id: string) => JSX.Element }) {
  const { suggestions, loading } = useFriendSuggestions();

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-12">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Sparkles className="h-5 w-5 text-muted-foreground/70" />
        </div>
        <h3 className="text-base font-medium mb-1">No suggestions yet</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Play matches, join groups, or register for events — we'll suggest people from there.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">
        People you've already crossed paths with on Pulse.
      </p>
      {suggestions.map((s) => <SuggestionRow key={s.id} player={s} action={actionButton(s.id)} />)}
    </div>
  );
}

function SuggestionRow({ player, action }: { player: SuggestedFriend; action: JSX.Element }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30">
      <Avatar className="h-10 w-10">
        <AvatarImage src={player.avatar_url || undefined} />
        <AvatarFallback>{getInitials(displayName(player))}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate font-display">{displayName(player)}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{player.reason}</span>
          {player.current_rating && (
            <>
              <span>·</span>
              <span>{player.current_rating.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------- My Code ----------
function MyCodePanel({
  handle,
  displayNameStr,
}: {
  handle: string | null;
  displayNameStr: typeof displayName;
}) {
  if (!handle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}/u/${handle}`;

  const copy = async () => {
    await navigator.clipboard.writeText(`@${handle}`);
    toast.success('Handle copied');
  };

  const share = async () => {
    const text = `Add me on Pulse: @${handle}\n${inviteUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Add me on Pulse', text, url: inviteUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Invite copied');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-card border border-border/40 p-6 flex flex-col items-center">
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG value={inviteUrl} size={180} level="M" includeMargin={false} />
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Your handle</p>
          <p className="text-2xl font-display font-semibold">@{handle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={copy} className="h-11">
          <Copy className="h-4 w-4 mr-2" /> Copy
        </Button>
        <Button onClick={share} className="h-11">
          <Share2 className="h-4 w-4 mr-2" /> Share
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Anyone with your handle or QR can send you a friend request.
      </p>
    </div>
  );
}

// ---------- Enter handle ----------
function EnterCodePanel({ actionButton }: { actionButton: (id: string) => JSX.Element }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = async () => {
    const cleaned = code.trim().replace(/^@/, '');
    if (!cleaned) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('lookup_player_by_handle', { _handle: cleaned });
      if (error) throw error;
      if (data && data.length > 0) setResult(data[0] as SearchResult);
      else setNotFound(true);
    } catch (e) {
      console.error(e);
      toast.error('Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Friend's handle</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="alex-7q4"
              className="pl-9"
              autoFocus
            />
          </div>
          <Button onClick={lookup} disabled={loading || code.trim().length < 2}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ask your friend for their handle from their <span className="font-medium">My code</span> tab.
        </p>
      </div>

      {result && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30">
          <Avatar className="h-12 w-12">
            <AvatarImage src={result.avatar_url || undefined} />
            <AvatarFallback>{getInitials(displayName(result))}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium font-display truncate">{displayName(result)}</p>
            <p className="text-xs text-muted-foreground truncate">@{result.handle}</p>
          </div>
          {actionButton(result.id)}
        </div>
      )}

      {notFound && (
        <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          No player found with that handle.
        </div>
      )}
    </div>
  );
}

// ---------- Scoped search ----------
function ScopedSearchPanel({ actionButton }: { actionButton: (id: string) => JSX.Element }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    const run = async () => {
      if (!debounced.trim() || debounced.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_connectable_users', { _query: debounced.trim() });
        if (error) throw error;
        setResults((data || []) as SearchResult[]);
      } catch (e) {
        console.error(e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [debounced]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or handle..."
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 flex items-start gap-2">
        <Users className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          We only show players you share a group, event, tournament, match, or mutual friend with.
        </p>
      </div>

      <div className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </>
        ) : results.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {query.trim().length < 2 ? 'Type at least 2 characters to search' : 'No matches in your network'}
          </div>
        ) : (
          results.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30">
              <Avatar className="h-10 w-10">
                <AvatarImage src={r.avatar_url || undefined} />
                <AvatarFallback>{getInitials(displayName(r))}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate font-display">{displayName(r)}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {r.handle && <span className="truncate">@{r.handle}</span>}
                  {r.reason && (
                    <>
                      <span>·</span>
                      <Badge variant="secondary" className="h-4 text-[10px] px-1.5">{r.reason}</Badge>
                    </>
                  )}
                </div>
              </div>
              {actionButton(r.id)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
