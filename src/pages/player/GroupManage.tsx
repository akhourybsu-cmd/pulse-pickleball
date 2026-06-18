import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Shield, Users, Lock, AlertTriangle, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useGroupSettings } from '@/hooks/useGroupSettings';
import { useGroupMembers } from '@/hooks/useGroupMembers';
import { AdminGeneralTab, GroupType } from '@/components/community/admin/AdminGeneralTab';
import { AdminPrivacyTab } from '@/components/community/admin/AdminPrivacyTab';
import { AdminPermissionsTab } from '@/components/community/admin/AdminPermissionsTab';
import { AdminRolesTab } from '@/components/community/admin/AdminRolesTab';
import { AdminDangerZoneTab } from '@/components/community/admin/AdminDangerZoneTab';
import type { Group } from '@/hooks/useGroups';

export default function GroupManage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GroupType>('crew');
  const [visibility, setVisibility] = useState<Group['visibility']>('unlisted');
  const [joinMethod, setJoinMethod] = useState<Group['join_method']>('open');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  
  // Hooks
  const { settings, saving: savingSettings, updateSetting } = useGroupSettings(groupId);
  const { members, updateRole } = useGroupMembers(groupId);

  useEffect(() => {
    if (groupId) {
      fetchGroup();
    }
  }, [groupId]);

  const fetchGroup = async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setCurrentUserId(user.id);

      // Check membership
      const { data: membership } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single();

      if (!membership || (membership.role !== 'owner' && membership.role !== 'moderator')) {
        toast({ title: 'Access Denied', description: 'You do not have permission to manage this group', variant: 'destructive' });
        navigate(`/player/community/group/${groupId}`);
        return;
      }

      setIsOwner(membership.role === 'owner');

      // Fetch group
      const { data: groupData, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error) throw error;

      setGroup(groupData);
      setName(groupData.name);
      setDescription(groupData.description || '');
      setType((groupData.type as GroupType) || 'crew');
      setVisibility(groupData.visibility);
      setJoinMethod(groupData.join_method);
      setIconUrl(groupData.icon_url);
    } catch (error) {
      console.error('Error fetching group:', error);
      toast({ title: 'Error', description: 'Failed to load group settings', variant: 'destructive' });
      navigate('/player/community');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!groupId || !name.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          type,
          visibility,
          join_method: joinMethod,
        })
        .eq('id', groupId);

      if (error) throw error;

      toast({ title: 'Saved', description: 'Group settings updated' });
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const regenerateInviteCode = async () => {
    if (!groupId) return;

    try {
      const newCode = `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      const { error } = await supabase
        .from('groups')
        .update({ invite_code: newCode })
        .eq('id', groupId);

      if (error) throw error;

      setGroup(prev => prev ? { ...prev, invite_code: newCode } : null);
      toast({ title: 'Regenerated', description: 'New invite code generated' });
    } catch (error: any) {
      console.error('Error regenerating code:', error);
      toast({ title: 'Error', description: 'Failed to regenerate code', variant: 'destructive' });
    }
  };

  const handleLeave = async () => {
    if (!groupId || !currentUserId) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast({ title: 'Left Group', description: 'You have left the group' });
      navigate('/player/community');
    } catch (error: any) {
      console.error('Error leaving group:', error);
      toast({ title: 'Error', description: error.message || 'Failed to leave group', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!groupId) return;

    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'Group has been deleted' });
      navigate('/player/community');
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast({ title: 'Error', description: error.message || 'Failed to delete group', variant: 'destructive' });
    }
  };

  const handlePromoteToModerator = async (memberId: string): Promise<boolean> => {
    try {
      await updateRole(memberId, 'moderator');
      return true;
    } catch {
      return false;
    }
  };

  const handleDemoteToMember = async (memberId: string): Promise<boolean> => {
    try {
      await updateRole(memberId, 'member');
      return true;
    } catch {
      return false;
    }
  };

  const handleTransferOwnership = async (newOwnerId: string): Promise<boolean> => {
    if (!groupId || !currentUserId) return false;

    try {
      // Find the current owner's member record and new owner's member record
      const currentOwnerMember = members.find(m => m.user_id === currentUserId);
      const newOwnerMember = members.find(m => m.user_id === newOwnerId);

      if (!currentOwnerMember || !newOwnerMember) {
        toast({ title: 'Error', description: 'Could not find member records', variant: 'destructive' });
        return false;
      }

      // Update new owner to 'owner' role
      const { error: newOwnerError } = await supabase
        .from('group_members')
        .update({ role: 'owner' })
        .eq('id', newOwnerMember.id);

      if (newOwnerError) throw newOwnerError;

      // Demote current owner to 'moderator'
      const { error: currentOwnerError } = await supabase
        .from('group_members')
        .update({ role: 'moderator' })
        .eq('id', currentOwnerMember.id);

      if (currentOwnerError) throw currentOwnerError;

      toast({ title: 'Ownership Transferred', description: 'You are now a moderator' });
      navigate(`/player/community/group/${groupId}`);
      return true;
    } catch (error: any) {
      console.error('Error transferring ownership:', error);
      toast({ title: 'Error', description: error.message || 'Failed to transfer ownership', variant: 'destructive' });
      return false;
    }
  };

  if (loading) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold">Group not found</h2>
        <Button onClick={() => navigate('/player/community')} className="mt-4">
          Back to Community
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(`/player/community/group/${groupId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Suite</h1>
            <p className="text-sm text-muted-foreground">{group.name}</p>
          </div>
        </div>
        {(activeTab === 'general' || activeTab === 'privacy') && (
          <Button onClick={handleSave} disabled={saving || !name.trim()} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      {/* Admin Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px]">
            <Settings className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">General</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px]">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px]">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px]">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Roles</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px]">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Danger</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <AdminGeneralTab
            name={name}
            description={description}
            type={type}
            groupId={groupId!}
            iconUrl={iconUrl}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onTypeChange={setType}
            onIconUrlChange={setIconUrl}
          />
        </TabsContent>

        <TabsContent value="privacy" className="mt-6">
          <AdminPrivacyTab
            visibility={visibility}
            joinMethod={joinMethod}
            inviteCode={group.invite_code}
            groupId={groupId!}
            onVisibilityChange={(v) => setVisibility(v as Group['visibility'])}
            onJoinMethodChange={(v) => setJoinMethod(v as Group['join_method'])}
            onRegenerateCode={regenerateInviteCode}
          />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <AdminPermissionsTab
            settings={settings}
            saving={savingSettings}
            onSettingChange={updateSetting}
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <AdminRolesTab
            members={members}
            currentUserId={currentUserId}
            isOwner={isOwner}
            onPromoteToModerator={handlePromoteToModerator}
            onDemoteToMember={handleDemoteToMember}
            onTransferOwnership={handleTransferOwnership}
          />
        </TabsContent>

        <TabsContent value="danger" className="mt-6">
          <AdminDangerZoneTab
            groupName={group.name}
            isOwner={isOwner}
            onLeave={handleLeave}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
