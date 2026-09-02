import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Palette,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
import { AdminVenueTab } from '@/components/community/admin/AdminVenueTab';
import { VenueStaffSection } from '@/components/community/admin/VenueStaffSection';
import { VenueAdminOverview } from '@/components/community/admin/VenueAdminOverview';
import {
  VenueAdminShell,
  type VenueAdminNavItem,
} from '@/components/community/admin/VenueAdminShell';
import type { VenueRole } from '@/components/venue/VenueStaffContext';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { Group } from '@/hooks/useGroups';

export default function GroupManage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [canManageCommunity, setCanManageCommunity] = useState(false);
  const [venueRole, setVenueRole] = useState<VenueRole | null>(null);
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
  const { members, updateRole, refetch: refetchMembers } = useGroupMembers(groupId);

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setCurrentUserId(user.id);

      // Community moderation and venue management are separate authorities.
      // Resolve both before deciding access so a venue manager can edit the
      // facility without also being handed chat/member moderation powers.
      const [groupResult, membershipResult] = await Promise.all([
        supabase
          .from('groups')
          .select(
            '*, venues:venue_id (id, name, slug, logo_url, cover_image_url, logo_image_fit, cover_image_fit, logo_shape, cover_focal_point, primary_color, secondary_color, tagline, welcome_headline, welcome_message, city, state, phone, email, website_url, hours_of_operation)',
          )
          .eq('id', groupId)
          .single(),
        supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (groupResult.error) throw groupResult.error;
      const groupData = groupResult.data as typeof groupResult.data & { venues?: Group['venue'] };
      const membership = membershipResult.data;
      const communityAccess = membership?.role === 'owner' || membership?.role === 'moderator';

      let resolvedVenueRole: VenueRole | null = null;
      if (groupData.venue_id) {
        const { data: staffRows, error: staffError } = await supabase
          .from('venue_staff_public')
          .select('role')
          .eq('venue_id', groupData.venue_id)
          .eq('user_id', user.id);
        if (staffError) throw staffError;
        resolvedVenueRole = ((staffRows?.[0] as { role?: VenueRole } | undefined)?.role ?? null);
      }

      const facilityAccess =
        resolvedVenueRole === 'owner' ||
        resolvedVenueRole === 'manager' ||
        membership?.role === 'owner';

      if (!communityAccess && !facilityAccess) {
        toast({ title: 'Access denied', description: 'You do not have venue or community management access.', variant: 'destructive' });
        navigate(`/player/community/group/${groupId}`);
        return;
      }

      setIsOwner(membership?.role === 'owner');
      setCanManageCommunity(communityAccess);
      setVenueRole(resolvedVenueRole);

      const normalizedGroup = {
        ...groupData,
        venue: groupData.venues ?? null,
      } as Group;
      setGroup(normalizedGroup);
      setName(groupData.name);
      setDescription(groupData.description || '');
      setType((groupData.type as GroupType) || 'crew');
      setVisibility(groupData.visibility);
      setJoinMethod(groupData.join_method);
      setIconUrl(groupData.icon_url);
      setActiveTab(groupData.venue_id && facilityAccess ? 'overview' : 'general');
    } catch (error) {
      console.error('Error fetching group:', error);
      toast({ title: 'Error', description: 'Failed to load group settings', variant: 'destructive' });
      navigate('/player/community');
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate, toast]);

  useEffect(() => {
    if (groupId) void fetchGroup();
  }, [fetchGroup, groupId]);

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
    } catch (error: unknown) {
      console.error('Error saving group:', error);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to save settings'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Optional expiry duration in seconds — null means "never expires".
  // 86400 = 24h, 604800 = 7 days. Driven by the duration picker in
  // AdminPrivacyTab.
  //
  // The live function signature is regenerate_group_invite_code(
  //   p_group_id uuid, p_expires_in_seconds int DEFAULT NULL
  // ) per migration 20260702000000. A later commit on main had the
  // client calling p_ttl_hours and discarding the expiresInSeconds
  // arg, which throws at runtime ("function ... does not exist") AND
  // silently drops the duration picker's value. This restores both
  // the correct param name and the wiring from the picker.
  const regenerateInviteCode = async (expiresInSeconds: number | null = null) => {
    if (!groupId) return;

    try {
      const { data, error } = await supabase.rpc('regenerate_group_invite_code' as never, {
        p_group_id: groupId,
        p_expires_in_seconds: expiresInSeconds,
      } as never);

      if (error) throw error;
      const result = (data ?? {}) as { invite_code?: string; expires_at?: string | null };
      if (!result.invite_code) throw new Error('Failed to generate invite code');

      setGroup(prev =>
        prev
          ? {
              ...prev,
              invite_code: result.invite_code!,
              invite_code_expires_at: result.expires_at ?? null,
            }
          : null,
      );
      toast({
        title: 'Regenerated',
        description: result.expires_at
          ? `New invite code generated · expires ${new Date(result.expires_at).toLocaleString()}`
          : 'New invite code generated',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to regenerate code'),
        variant: 'destructive',
      });
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
    } catch (error: unknown) {
      console.error('Error leaving group:', error);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to leave group'), variant: 'destructive' });
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
    } catch (error: unknown) {
      console.error('Error deleting group:', error);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to delete group'), variant: 'destructive' });
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
      const newOwnerMember = members.find(m => m.user_id === newOwnerId);

      if (!newOwnerMember) {
        toast({ title: 'Error', description: 'Could not find the selected member', variant: 'destructive' });
        return false;
      }

      // One transaction moves the community owner and, for official venues,
      // venues.owner_id plus the venue_staff owner role. The old two-request
      // flow could partially fail and leave two owners behind.
      const { data: transferResult, error } = await supabase.rpc('transfer_group_ownership', {
        p_group_id: groupId,
        p_new_owner_id: newOwnerId,
      });
      if (error) throw error;
      const venueTransferred =
        !!transferResult &&
        typeof transferResult === 'object' &&
        !Array.isArray(transferResult) &&
        transferResult.venue_transferred === true;

      setIsOwner(false);
      if (venueTransferred) setVenueRole('manager');
      await Promise.all([
        refetchMembers(),
        queryClient.invalidateQueries({ queryKey: ['group-detail', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['group-members', groupId] }),
        group?.venue_id
          ? queryClient.invalidateQueries({ queryKey: ['venue-staff', group.venue_id] })
          : Promise.resolve(),
        group?.venue_id
          ? queryClient.invalidateQueries({ queryKey: ['my-venue-role', group.venue_id] })
          : Promise.resolve(),
      ]);

      const nextName =
        newOwnerMember.profile?.display_name ||
        newOwnerMember.profile?.full_name ||
        'The selected member';
      toast({
        title: 'Ownership transferred',
        description: venueTransferred
          ? `${nextName} now owns the community and venue settings. You are now a moderator and venue manager.`
          : `${nextName} now owns this community. You are now a moderator.`,
      });
      return true;
    } catch (error: unknown) {
      console.error('Error transferring ownership:', error);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to transfer ownership'), variant: 'destructive' });
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

  // Once a group is linked to a venue, its managers must always receive the
  // venue console. Gating this shell behind the player-facing feature flag can
  // otherwise leave a valid manager with an empty generic settings page.
  const showsVenueAdmin = !!group.venue_id;
  const canManageFacility =
    venueRole === 'owner' || venueRole === 'manager' || isOwner;

  const venueItems: VenueAdminNavItem[] = [
    ...(canManageFacility
      ? [
          { value: 'overview', label: 'Overview', description: 'Venue health and shortcuts', icon: LayoutDashboard, section: 'venue' as const },
          { value: 'profile', label: 'Profile & brand', shortLabel: 'Profile', description: 'Identity, imagery, and contact details', icon: Palette, section: 'venue' as const },
          { value: 'facility', label: 'Courts & hours', shortLabel: 'Facility', description: 'Booking inventory and availability', icon: LayoutGrid, section: 'venue' as const },
          { value: 'staff', label: 'Staff access', shortLabel: 'Staff', description: 'Venue roles and operations access', icon: ShieldCheck, section: 'venue' as const },
        ]
      : []),
    ...(canManageCommunity
      ? [
          { value: 'general', label: 'Community profile', shortLabel: 'Community', description: 'Name, description, and identity', icon: Settings, section: 'community' as const },
          { value: 'permissions', label: 'Member permissions', shortLabel: 'Permissions', description: 'Venue posting and chat controls', icon: Shield, section: 'community' as const },
          { value: 'privacy', label: 'Access & privacy', shortLabel: 'Access', description: 'Visibility, joining, and invite codes', icon: Lock, section: 'community' as const },
          { value: 'roles', label: 'Community roles', shortLabel: 'Roles', description: 'Owner and moderator authority', icon: Users, section: 'community' as const },
          { value: 'danger', label: 'Danger zone', shortLabel: 'Danger', description: 'Leave or permanently remove the space', icon: AlertTriangle, section: 'advanced' as const },
        ]
      : []),
  ];

  const standardTabs: { value: string; label: string; icon: typeof Settings }[] = [
    { value: 'general', label: 'General', icon: Settings },
    { value: 'privacy', label: 'Privacy', icon: Lock },
    { value: 'permissions', label: 'Permissions', icon: Shield },
    { value: 'roles', label: 'Roles', icon: Users },
    { value: 'danger', label: 'Danger', icon: AlertTriangle },
  ];

  const panels = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {showsVenueAdmin && canManageFacility && group.venue_id && (
        <>
          <TabsContent value="overview" className="mt-0">
            <VenueAdminOverview
              venueId={group.venue_id}
              groupId={groupId!}
              venueName={group.venue?.name ?? group.name}
              memberCount={members.length}
              accent={group.venue?.primary_color}
              canManageCommunity={canManageCommunity}
              chatEnabled={settings.chat_enabled}
              onOpenTab={setActiveTab}
              onOperations={() => navigate(`/player/community/group/${groupId}/ops`)}
              onOpenVenueTab={(tab) =>
                navigate(
                  `/player/community/group/${groupId}${tab === 'home' ? '' : `?tab=${tab}`}`,
                )
              }
            />
          </TabsContent>
          <TabsContent value="profile" className="mt-0">
            <AdminVenueTab
              groupId={groupId!}
              venueId={group.venue_id}
              isVerified={!!group.is_venue_verified}
              mode="profile"
            />
          </TabsContent>
          <TabsContent value="facility" className="mt-0">
            <AdminVenueTab
              groupId={groupId!}
              venueId={group.venue_id}
              isVerified={!!group.is_venue_verified}
              mode="facility"
            />
          </TabsContent>
          <TabsContent value="staff" className="mt-0">
            <VenueStaffSection
              venueId={group.venue_id}
              members={members}
              canAssignManagers={venueRole === 'owner' || isOwner}
              currentUserId={currentUserId}
            />
          </TabsContent>
        </>
      )}

      {canManageCommunity && (
        <>
          <TabsContent value="general" className={showsVenueAdmin ? 'mt-0' : 'mt-6'}>
            {showsVenueAdmin && <PanelSaveBar onSave={handleSave} saving={saving} disabled={!name.trim()} />}
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

          <TabsContent value="privacy" className={showsVenueAdmin ? 'mt-0' : 'mt-6'}>
            {showsVenueAdmin && <PanelSaveBar onSave={handleSave} saving={saving} disabled={!name.trim()} />}
            <AdminPrivacyTab
              visibility={visibility}
              joinMethod={joinMethod}
              inviteCode={group.invite_code}
              inviteCodeExpiresAt={group.invite_code_expires_at ?? null}
              onVisibilityChange={(v) => setVisibility(v as Group['visibility'])}
              onJoinMethodChange={(v) => setJoinMethod(v as Group['join_method'])}
              onRegenerateCode={regenerateInviteCode}
            />
          </TabsContent>

          <TabsContent value="permissions" className={showsVenueAdmin ? 'mt-0' : 'mt-6'}>
            <AdminPermissionsTab
              settings={settings}
              saving={savingSettings}
              venueMode={showsVenueAdmin}
              onSettingChange={updateSetting}
            />
          </TabsContent>

          <TabsContent value="roles" className={showsVenueAdmin ? 'mt-0' : 'mt-6'}>
            <AdminRolesTab
              members={members}
              currentUserId={currentUserId}
              isOwner={isOwner}
              isVenue={showsVenueAdmin}
              onPromoteToModerator={handlePromoteToModerator}
              onDemoteToMember={handleDemoteToMember}
              onTransferOwnership={handleTransferOwnership}
            />
          </TabsContent>

          <TabsContent value="danger" className={showsVenueAdmin ? 'mt-0' : 'mt-6'}>
            <AdminDangerZoneTab
              groupName={group.name}
              isOwner={isOwner}
              onLeave={handleLeave}
              onDelete={handleDelete}
            />
          </TabsContent>
        </>
      )}
    </Tabs>
  );

  if (showsVenueAdmin) {
    const roleLabel =
      venueRole === 'owner'
        ? 'Owner'
        : venueRole === 'manager'
          ? 'Manager'
          : isOwner
            ? 'Owner'
          : canManageCommunity
            ? 'Community moderator'
            : 'Venue staff';
    return (
      <VenueAdminShell
        venueName={group.venue?.name ?? group.name}
        verified={!!group.is_venue_verified}
        roleLabel={roleLabel}
        accent={group.venue?.primary_color}
        activeTab={activeTab}
        items={venueItems}
        onTabChange={setActiveTab}
        onBack={() => navigate(`/player/community/group/${groupId}`)}
        onViewVenue={() => navigate(`/player/community/group/${groupId}`)}
        onOperations={() => navigate(`/player/community/group/${groupId}/ops`)}
        showOperations={canManageFacility}
      >
        {panels}
      </VenueAdminShell>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-gradient-to-b from-primary/[0.06] via-background to-background pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(`/player/community/group/${groupId}`)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">Admin Suite</h1>
                <p className="truncate text-xs text-muted-foreground">{group.name}</p>
              </div>
            </div>
            {(activeTab === 'general' || activeTab === 'privacy') && (
              <Button onClick={handleSave} disabled={saving || !name.trim()} size="sm" className="shrink-0">
                <Save className="mr-2 h-4 w-4" />{saving ? 'Saving' : 'Save'}
              </Button>
            )}
          </div>
        </div>
        <div className="container mx-auto max-w-3xl px-2 sm:px-4">
          <div role="tablist" className="-mb-px flex items-center gap-1 overflow-x-auto scrollbar-none">
            {standardTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.value)}
                  className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5" />{tab.label}
                  <span className={`absolute -bottom-px left-2 right-2 h-0.5 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </header>
      <div className="container mx-auto max-w-3xl px-4 py-6">{panels}</div>
    </div>
  );
}

function PanelSaveBar({
  onSave,
  saving,
  disabled,
}: {
  onSave: () => void;
  saving: boolean;
  disabled: boolean;
}) {
  return (
    <div className="mb-4 flex justify-end">
      <Button onClick={onSave} disabled={saving || disabled} size="sm" className="rounded-full px-4">
        <Save className="mr-2 h-4 w-4" />{saving ? 'Saving' : 'Save changes'}
      </Button>
    </div>
  );
}
