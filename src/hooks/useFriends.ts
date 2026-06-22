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

export function useFriends() {
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const sendFriendRequest = useCallback(async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if friendship already exists in either direction
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'blocked') {
          toast.error('Unable to send friend request');
          return false;
        }
        if (existing.status === 'pending') {
          toast.info('Friend request already pending');
          return false;
        }
        if (existing.status === 'accepted') {
          toast.info('Already friends');
          return false;
        }
      }

      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: user.id, friend_id: friendId, status: 'pending' });

      if (error) throw error;

      toast.success('Friend request sent!');
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
      const { data: { user } } = await supabase.auth.getUser();
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
    currentUserId,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    blockUser,
    getFriendshipStatus,
    refetch: fetchFriends
  };
}
