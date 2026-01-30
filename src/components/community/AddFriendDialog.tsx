import { useState } from 'react';
import { Search, UserPlus, Check, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useFriends } from '@/hooks/useFriends';
import { useDebounce } from '@/hooks/useDebounce';
import { useEffect } from 'react';

interface SearchResult {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
}

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { sendFriendRequest, getFriendshipStatus, currentUserId } = useFriends();
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .or(`display_name.ilike.%${debouncedQuery}%,full_name.ilike.%${debouncedQuery}%`)
          .neq('id', currentUserId || '')
          .limit(10);

        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error('Error searching users:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchUsers();
  }, [debouncedQuery, currentUserId]);

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    await sendFriendRequest(userId);
    setSendingTo(null);
  };

  const getInitials = (result: SearchResult) => {
    const name = result.display_name || result.full_name || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderActionButton = (userId: string) => {
    const status = getFriendshipStatus(userId);

    if (status === 'accepted') {
      return (
        <Button variant="outline" size="sm" disabled className="h-8">
          <Check className="h-3.5 w-3.5 mr-1" />
          Friends
        </Button>
      );
    }

    if (status === 'pending_sent') {
      return (
        <Button variant="outline" size="sm" disabled className="h-8">
          <Clock className="h-3.5 w-3.5 mr-1" />
          Pending
        </Button>
      );
    }

    if (status === 'pending_received') {
      return (
        <Button variant="secondary" size="sm" className="h-8">
          Accept
        </Button>
      );
    }

    return (
      <Button 
        size="sm" 
        className="h-8"
        onClick={() => handleSendRequest(userId)}
        disabled={sendingTo === userId}
      >
        <UserPlus className="h-3.5 w-3.5 mr-1" />
        {sendingTo === userId ? '...' : 'Add'}
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {loading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {query.length < 2 
                  ? 'Type at least 2 characters to search'
                  : 'No players found'
                }
              </div>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={result.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(result)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {result.display_name || result.full_name || 'Unknown'}
                    </p>
                    {result.current_rating && (
                      <p className="text-xs text-muted-foreground">
                        {result.current_rating.toFixed(2)} rating
                      </p>
                    )}
                  </div>

                  {renderActionButton(result.id)}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
