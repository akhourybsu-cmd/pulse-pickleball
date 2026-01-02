import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GroupSettings, parseGroupSettings, DEFAULT_GROUP_SETTINGS } from '@/types/groupSettings';

export function useGroupSettings(groupId: string | undefined) {
  const [settings, setSettings] = useState<GroupSettings>(DEFAULT_GROUP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('settings')
        .eq('id', groupId)
        .single();

      if (error) throw error;
      setSettings(parseGroupSettings(data?.settings));
    } catch (error) {
      console.error('Error fetching group settings:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<GroupSettings>): Promise<boolean> => {
    if (!groupId) return false;
    
    setSaving(true);
    const newSettings = { ...settings, ...updates };
    
    // Optimistic update
    setSettings(newSettings);
    
    try {
      const { error } = await supabase
        .from('groups')
        .update({ settings: newSettings })
        .eq('id', groupId);

      if (error) throw error;
      
      toast({ title: 'Settings saved' });
      return true;
    } catch (error: any) {
      // Revert on error
      setSettings(settings);
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = async <K extends keyof GroupSettings>(
    key: K,
    value: GroupSettings[K]
  ): Promise<boolean> => {
    return updateSettings({ [key]: value });
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
    updateSetting,
    refetch: fetchSettings,
  };
}
