import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VenueStaffMember {
  id: string;
  venue_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'staff';
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export function useVenueStaff(venueId: string | null) {
  const [staff, setStaff] = useState<VenueStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStaff = useCallback(async () => {
    if (!venueId) {
      setStaff([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_staff')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fetch profiles for each staff member
      const staffWithProfiles = await Promise.all(
        (data || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', member.user_id)
            .single();
          
          return {
            ...member,
            profile: profile || undefined,
          } as VenueStaffMember;
        })
      );
      
      setStaff(staffWithProfiles);
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to load staff members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [venueId, toast]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const updateStaffRole = async (staffId: string, role: 'owner' | 'manager' | 'staff') => {
    try {
      const { error } = await supabase
        .from('venue_staff')
        .update({ role })
        .eq('id', staffId);

      if (error) throw error;
      
      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, role } : s));
      toast({
        title: 'Role Updated',
        description: 'Staff member role has been updated',
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const removeStaff = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from('venue_staff')
        .delete()
        .eq('id', staffId);

      if (error) throw error;
      
      setStaff(prev => prev.filter(s => s.id !== staffId));
      toast({
        title: 'Staff Removed',
        description: 'Staff member has been removed from the venue',
      });
    } catch (error: any) {
      console.error('Error removing staff:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove staff member',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    staff,
    loading,
    refetch: fetchStaff,
    updateStaffRole,
    removeStaff,
  };
}
