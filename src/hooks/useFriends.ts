import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthState } from '@/hooks/useAuthState';

export interface FriendProfile {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  accepted_at: string | null;
}

export interface FriendWithProfile extends Friendship {
  profile: FriendProfile;
}

export interface FriendRequest {
  id: string;
  user_id: string;
  created_at: string;
  profile: FriendProfile;
}

export function useFriends(options?: { realtime?: boolean; includeSent?: boolean }) {
  const realtime = options?.realtime ?? false;
  const includeSent = options?.includeSent ?? true;
  const { user } = useAuthState();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = user?.id ?? null;

  const fetchFriends = useCallback(async () => {
    try {
      setError(null);
      if (!currentUserId) {
        setFriends([]);
        setPendingRequests([]);
        setSentRequests([]);
        return;
      }

      // Relationship lists are independent. Fetch them together, then resolve
      // every referenced user with one profile query. This changes the full
      // friends load from as many as six sequential round trips to two.
      const [acceptedResult, receivedResult, sentResult] = await Promise.all([
        supabase
          .from('friendships')
          .select('*')
          .eq('status', 'accepted')
          .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`),
        supabase
          .from('friendships')
          .select('id, user_id, created_at')
          .eq('friend_id', currentUserId)
          .eq('status', 'pending'),
        includeSent
          ? supabase
              .from('friendships')
              .select('id, friend_id, created_at')
              .eq('user_id', currentUserId)
              .eq('status', 'pending')
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (acceptedResult.error) throw acceptedResult.error;
      if (receivedResult.error) throw receivedResult.error;
      if (sentResult.error) throw sentResult.error;

      const friendships = acceptedResult.data || [];
      const received = receivedResult.data || [];
      const sent = sentResult.data || [];
      const profileIds = [...new Set([
        ...friendships.map((friendship) =>
          friendship.user_id === currentUserId ? friendship.friend_id : friendship.user_id,
        ),
        ...received.map((request) => request.user_id),
        ...sent.map((request) => request.friend_id),
      ])];

      const { data: profiles, error: profileError } = profileIds.length
        ? await supabase
            .from('profiles_public')
            .select('id, display_name, full_name, avatar_url, current_rating')
            .in('id', profileIds)
        : { data: [], error: null };
      if (profileError) throw profileError;

      const profileMap = new Map(
        (profiles || []).map((profile) => [profile.id, profile as FriendProfile]),
      );

      setFriends(friendships.flatMap((friendship) => {
        const otherUserId = friendship.user_id === currentUserId
          ? friendship.friend_id
          : friendship.user_id;
        const profile = profileMap.get(otherUserId);
        return profile ? [{
          ...friendship,
          status: friendship.status as Friendship['status'],
          profile,
        }] : [];
      }));

      setPendingRequests(received.flatMap((request) => {
        const profile = profileMap.get(request.user_id);
        return profile ? [{ ...request, profile }] : [];
      }));

      setSentRequests(sent.flatMap((request) => {
        const profile = profileMap.get(request.friend_id);
        return profile ? [{
          id: request.id,
          user_id: request.friend_id,
          created_at: request.created_at,
          profile,
        }] : [];
      }));

    } catch (error) {
      console.error('Error fetching friends:', error);
      // Surface a real error so the UI can distinguish "load failed" from
      // "genuinely no friends yet" and offer a retry.
      setError('Could not load your friends. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, includeSent]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Opt-in realtime (only the Friends surface passes realtime:true, so the
  // lightweight rail/card consumers don't each open a channel). Incoming
  // requests / accepts / removals update the list live instead of only on
  // remount or after a local mutation.
  useEffect(() => {
    if (!realtime || !currentUserId) return;
    const channel = supabase
      .channel(`friendships-rt-${currentUserId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `user_id=eq.${currentUserId}` },
        () => { void fetchFriends(); })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `friend_id=eq.${currentUserId}` },
        () => { void fetchFriends(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [realtime, currentUserId, fetchFriends]);

  const sendFriendRequest = useCallback(async (friendId: string) => {
    try {
      // The server RPC serializes concurrent A→B / B→A sends under an
      // advisory lock — the previous client-side SELECT-then-INSERT
      // raced, leaving both users stuck on "pending sent". It returns
      // the resulting status: 'pending' (sent or already pending) or
      // 'accepted' (the other side had a pending request — instant
      // friends).
      // The RPC is not in the generated types yet.
      // types yet — same pattern as the user_blocks table below.
      const { data: status, error } = await supabase.rpc('send_friend_request' as never, {
        p_friend_id: friendId,
      } as never);

      if (error) throw error;

      if (status === 'accepted') {
        toast.success("You're now friends!");
      } else {
        toast.success('Friend request sent!');
      }
      // Background reconcile — we don't have the target's profile here to
      // build an optimistic row, but no need to block the button on it.
      void fetchFriends();
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
      return false;
    }
  }, [fetchFriends]);

  // Accept/decline/cancel/remove/block are all OPTIMISTIC: the local lists
  // update instantly so the tap feels immediate, then the write runs and a
  // background fetchFriends() reconciles. On failure we restore the snapshot
  // and surface a toast. (fetchFriends never flips `loading`, so the
  // reconcile is invisible.)
  const acceptRequest = useCallback(async (friendshipId: string) => {
    const prevPending = pendingRequests;
    const prevFriends = friends;
    const req = pendingRequests.find((r) => r.id === friendshipId);
    setPendingRequests((p) => p.filter((r) => r.id !== friendshipId));
    if (req && currentUserId) {
      setFriends((f) => [
        {
          id: friendshipId,
          user_id: req.user_id,
          friend_id: currentUserId,
          status: 'accepted',
          created_at: req.created_at,
          accepted_at: new Date().toISOString(),
          profile: req.profile,
        },
        ...f,
      ]);
    }
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', friendshipId);
      if (error) throw error;
      toast.success('Friend request accepted!');
      void fetchFriends();
      return true;
    } catch (error) {
      setPendingRequests(prevPending);
      setFriends(prevFriends);
      console.error('Error accepting friend request:', error);
      toast.error('Failed to accept friend request');
      return false;
    }
  }, [pendingRequests, friends, currentUserId, fetchFriends]);

  const declineRequest = useCallback(async (friendshipId: string) => {
    const prevPending = pendingRequests;
    setPendingRequests((p) => p.filter((r) => r.id !== friendshipId));
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      toast.success('Friend request declined');
      void fetchFriends();
      return true;
    } catch (error) {
      setPendingRequests(prevPending);
      console.error('Error declining friend request:', error);
      toast.error('Failed to decline friend request');
      return false;
    }
  }, [pendingRequests, fetchFriends]);

  // Cancelling your OWN outbound request — same delete, correct copy.
  const cancelRequest = useCallback(async (friendshipId: string) => {
    const prevSent = sentRequests;
    setSentRequests((s) => s.filter((r) => r.id !== friendshipId));
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      toast.success('Friend request canceled');
      void fetchFriends();
      return true;
    } catch (error) {
      setSentRequests(prevSent);
      console.error('Error canceling friend request:', error);
      toast.error('Failed to cancel friend request');
      return false;
    }
  }, [sentRequests, fetchFriends]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    const prevFriends = friends;
    setFriends((f) => f.filter((fr) => fr.id !== friendshipId));
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      toast.success('Friend removed');
      void fetchFriends();
      return true;
    } catch (error) {
      setFriends(prevFriends);
      console.error('Error removing friend:', error);
      toast.error('Failed to remove friend');
      return false;
    }
  }, [friends, fetchFriends]);

  const blockUser = useCallback(async (userId: string) => {
    const prevFriends = friends;
    const prevPending = pendingRequests;
    const prevSent = sentRequests;
    // Optimistically drop the user from every list.
    setFriends((f) => f.filter((fr) => fr.user_id !== userId && fr.friend_id !== userId));
    setPendingRequests((p) => p.filter((r) => r.user_id !== userId));
    setSentRequests((s) => s.filter((r) => r.user_id !== userId));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      // Insert into user_blocks (canonical block source of truth).
      const { error: blockErr } = await supabase
        .from('user_blocks' as never)
        .insert({ blocker_id: user.id, blocked_id: userId });

      if (blockErr && !/duplicate/i.test(blockErr.message)) throw blockErr;

      // Remove any friendship so they no longer appear as a friend.
      await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`);

      toast.success('User blocked');
      void fetchFriends();
      return true;
    } catch (error) {
      setFriends(prevFriends);
      setPendingRequests(prevPending);
      setSentRequests(prevSent);
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
      return false;
    }
  }, [friends, pendingRequests, sentRequests, fetchFriends]);

  const getFriendshipStatus = useCallback((userId: string): 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked' => {
    if (!currentUserId) return 'none';
    
    const friend = friends.find(f => 
      f.user_id === userId || f.friend_id === userId
    );
    if (friend) return 'accepted';

    const sentReq = sentRequests.find(r => r.user_id === userId);
    if (sentReq) return 'pending_sent';

    const receivedReq = pendingRequests.find(r => r.user_id === userId);
    if (receivedReq) return 'pending_received';

    return 'none';
  }, [currentUserId, friends, sentRequests, pendingRequests]);

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    error,
    currentUserId,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    blockUser,
    getFriendshipStatus,
    refetch: fetchFriends
  };
}
