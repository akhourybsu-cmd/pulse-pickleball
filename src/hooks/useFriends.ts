import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useFriends(options?: { realtime?: boolean }) {
  const realtime = options?.realtime ?? false;
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      setError(null);
      // getSession() reads the cached local session instead of a server
      // round-trip — RLS is the real auth boundary for every query below.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setCurrentUserId(user.id);

      // Fetch accepted friendships where user is either party
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (error) throw error;

      // Batch fetch all friend profiles to avoid N+1 queries
      const friendUserIds = (friendships || []).map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      
      const friendsWithProfiles: FriendWithProfile[] = [];
      
      if (friendUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .in('id', friendUserIds);
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        
        for (const f of friendships || []) {
          const otherUserId = f.user_id === user.id ? f.friend_id : f.user_id;
          const profile = profileMap.get(otherUserId);
          
          if (profile) {
            friendsWithProfiles.push({
              ...f,
              status: f.status as 'pending' | 'accepted' | 'blocked',
              profile: profile as FriendProfile
            });
          }
        }
      }

      setFriends(friendsWithProfiles);

      // Fetch pending requests received by user
      const { data: received, error: receivedError } = await supabase
        .from('friendships')
        .select('id, user_id, created_at')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (receivedError) throw receivedError;

      // Batch fetch pending request profiles
      const pendingWithProfiles: FriendRequest[] = [];
      const pendingUserIds = (received || []).map(r => r.user_id);
      
      if (pendingUserIds.length > 0) {
        const { data: pendingProfiles } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .in('id', pendingUserIds);
        
        const pendingProfileMap = new Map((pendingProfiles || []).map(p => [p.id, p]));
        
        for (const r of received || []) {
          const profile = pendingProfileMap.get(r.user_id);
          if (profile) {
            pendingWithProfiles.push({
              ...r,
              profile: profile as FriendProfile
            });
          }
        }
      }
      setPendingRequests(pendingWithProfiles);

      // Fetch sent pending requests
      const { data: sent, error: sentError } = await supabase
        .from('friendships')
        .select('id, friend_id, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (sentError) throw sentError;

      // Batch fetch sent request profiles
      const sentWithProfiles: FriendRequest[] = [];
      const sentUserIds = (sent || []).map(s => s.friend_id);
      
      if (sentUserIds.length > 0) {
        const { data: sentProfiles } = await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .in('id', sentUserIds);
        
        const sentProfileMap = new Map((sentProfiles || []).map(p => [p.id, p]));
        
        for (const s of sent || []) {
          const profile = sentProfileMap.get(s.friend_id);
          if (profile) {
            sentWithProfiles.push({
              id: s.id,
              user_id: s.friend_id,
              created_at: s.created_at,
              profile: profile as FriendProfile
            });
          }
        }
      }
      setSentRequests(sentWithProfiles);

    } catch (error) {
      console.error('Error fetching friends:', error);
      // Surface a real error so the UI can distinguish "load failed" from
      // "genuinely no friends yet" and offer a retry.
      setError('Could not load your friends. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      // (supabase as any): send_friend_request is not in the generated
      // types yet — same pattern as the user_blocks table below.
      const { data: status, error } = await (supabase as any).rpc('send_friend_request', {
        p_friend_id: friendId,
      });

      if (error) throw error;

      if (status === 'accepted') {
        toast.success("You're now friends!");
      } else {
        toast.success('Friend request sent!');
      }
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
      return false;
    }
  }, [fetchFriends]);

  const acceptRequest = useCallback(async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', friendshipId);

      if (error) throw error;

      toast.success('Friend request accepted!');
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast.error('Failed to accept friend request');
      return false;
    }
  }, [fetchFriends]);

  const declineRequest = useCallback(async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      toast.success('Friend request declined');
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error declining friend request:', error);
      toast.error('Failed to decline friend request');
      return false;
    }
  }, [fetchFriends]);

  // Cancelling your OWN outbound request — same delete, correct copy.
  const cancelRequest = useCallback(async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (error) throw error;
      toast.success('Friend request canceled');
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error canceling friend request:', error);
      toast.error('Failed to cancel friend request');
      return false;
    }
  }, [fetchFriends]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      toast.success('Friend removed');
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      toast.error('Failed to remove friend');
      return false;
    }
  }, [fetchFriends]);

  const blockUser = useCallback(async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      // Insert into user_blocks (canonical block source of truth).
      const { error: blockErr } = await (supabase as any)
        .from('user_blocks')
        .insert({ blocker_id: user.id, blocked_id: userId });

      if (blockErr && !/duplicate/i.test(blockErr.message)) throw blockErr;

      // Remove any friendship so they no longer appear as a friend.
      await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`);

      toast.success('User blocked');
      await fetchFriends();
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
      return false;
    }
  }, [fetchFriends]);

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
