import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Loader2, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { GroupMemberWithProfile } from '@/hooks/useGroupMembers';
import type { VenueRole } from '@/components/venue/VenueStaffContext';

interface VenueStaffRow {
  id: string;
  user_id: string;
  role: VenueRole;
  accepted_at: string | null;
  profile: {
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
}

const ROLE_DETAILS: Record<VenueRole, { label: string; description: string }> = {
  owner: {
    label: 'Owner',
    description: 'Full venue ownership, settings, staff, operations, and community control.',
  },
  manager: {
    label: 'Manager',
    description: 'Manages venue profile, courts, hours, staff, and daily operations.',
  },
  organizer: {
    label: 'Organizer',
    description: 'Runs programming, bookings, and the day-of venue operation.',
  },
  staff: {
    label: 'Staff',
    description: 'Works the floor and can use the live operations dashboard.',
  },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function VenueStaffSection({
  venueId,
  members,
  canAssignManagers,
  currentUserId,
}: {
  venueId: string;
  members: GroupMemberWithProfile[];
  canAssignManagers: boolean;
  currentUserId: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [staff, setStaff] = useState<VenueStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<VenueRole>('staff');
  const [removeTarget, setRemoveTarget] = useState<VenueStaffRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('venue_staff')
      .select('id, user_id, role, accepted_at')
      .eq('venue_id', venueId)
      .neq('is_active', false)
      .order('created_at', { ascending: true });

    if (error) {
      setLoading(false);
      toast({ title: 'Could not load venue staff', description: error.message, variant: 'destructive' });
      return;
    }

    const userIds = (rows ?? []).map((row) => row.user_id);
    const { data: profiles } = userIds.length
      ? await supabase
          .from('profiles_public')
          .select('id, display_name, full_name, avatar_url')
          .in('id', userIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    setStaff(
      (rows ?? []).map((row) => {
        const profile = profileById.get(row.user_id);
        return {
          ...row,
          role: row.role as VenueRole,
          profile: {
            display_name: profile?.display_name ?? null,
            full_name: profile?.full_name ?? 'Venue teammate',
            avatar_url: profile?.avatar_url ?? null,
          },
        };
      }),
    );
    setLoading(false);
  }, [toast, venueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const staffIds = useMemo(() => new Set(staff.map((row) => row.user_id)), [staff]);
  const candidates = useMemo(
    () => members.filter((member) => !staffIds.has(member.user_id)),
    [members, staffIds],
  );
  const assignableRoles: VenueRole[] = canAssignManagers
    ? ['manager', 'organizer', 'staff']
    : ['organizer', 'staff'];

  const runAction = async (userId: string, action: 'upsert' | 'remove', role: VenueRole) => {
    setSavingUserId(userId);
    const { error } = await supabase.rpc('manage_venue_staff' as never, {
      p_venue_id: venueId,
      p_user_id: userId,
      p_action: action,
      p_role: role,
    } as never);
    setSavingUserId(null);

    if (error) {
      toast({ title: 'Staff access was not changed', description: error.message, variant: 'destructive' });
      return false;
    }

    await Promise.all([
      load(),
      queryClient.invalidateQueries({ queryKey: ['venue-staff', venueId] }),
      queryClient.invalidateQueries({ queryKey: ['my-venue-role', venueId] }),
    ]);
    return true;
  };

  const addStaff = async () => {
    if (!selectedUserId) return;
    const success = await runAction(selectedUserId, 'upsert', selectedRole);
    if (!success) return;
    setSelectedUserId('');
    setSelectedRole('staff');
    toast({ title: 'Venue access granted' });
  };

  const updateRole = async (row: VenueStaffRow, role: VenueRole) => {
    const success = await runAction(row.user_id, 'upsert', role);
    if (success) toast({ title: 'Staff role updated' });
  };

  const removeStaff = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    const success = await runAction(target.user_id, 'remove', target.role);
    if (!success) return;
    setRemoveTarget(null);
    toast({ title: 'Venue access removed' });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-border/70 bg-card p-5 shadow-[0_14px_42px_-34px_hsl(var(--foreground)/0.4)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Venue staff access</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Venue roles control facility operations and official staff identity. Community moderator roles are managed separately.
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-border/70 shadow-[0_12px_36px_-32px_hsl(var(--foreground)/0.35)]">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4 text-primary" />
            Team
            <Badge variant="secondary" className="ml-1 tabular-nums">{staff.length}</Badge>
          </CardTitle>
          <CardDescription>People currently authorized to represent and operate this venue.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading venue staff" />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {staff.map((row) => {
                const name = row.profile.display_name || row.profile.full_name;
                const isOwner = row.role === 'owner';
                const canEdit =
                  !isOwner &&
                  row.user_id !== currentUserId &&
                  (canAssignManagers || row.role !== 'manager');
                return (
                  <div key={row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/70">
                        <AvatarImage src={row.profile.avatar_url || undefined} />
                        <AvatarFallback className="text-xs font-semibold">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold">{name}</p>
                          {row.user_id === currentUserId && (
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">You</span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {ROLE_DETAILS[row.role].description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-[52px] sm:pl-0">
                      {isOwner ? (
                        <Badge variant="outline" className="h-9 gap-1.5 rounded-lg px-3">
                          <Crown className="h-3.5 w-3.5 text-amber-500" /> Owner
                        </Badge>
                      ) : canEdit ? (
                        <Select
                          value={row.role}
                          onValueChange={(role) => void updateRole(row, role as VenueRole)}
                          disabled={savingUserId === row.user_id}
                        >
                          <SelectTrigger className="h-9 w-[142px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignableRoles.map((role) => (
                              <SelectItem key={role} value={role}>{ROLE_DETAILS[role].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="h-9 rounded-lg px-3">
                          {ROLE_DETAILS[row.role].label}
                        </Badge>
                      )}

                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setRemoveTarget(row)}
                          aria-label={`Remove ${name} from venue staff`}
                        >
                          {savingUserId === row.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" /> Add a teammate
          </CardTitle>
          <CardDescription>
            Staff must already be an active member of the venue community. This keeps identity and access tied to a real account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="venue-staff-person">Community member</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="venue-staff-person" className="w-full">
                  <SelectValue placeholder={candidates.length ? 'Choose a member' : 'Everyone is already assigned'} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profile.display_name || member.profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="venue-staff-role">Venue role</label>
              <Select value={selectedRole} onValueChange={(role) => setSelectedRole(role as VenueRole)}>
                <SelectTrigger id="venue-staff-role" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_DETAILS[role].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void addStaff()} disabled={!selectedUserId || !!savingUserId} className="w-full sm:w-auto">
              {savingUserId === selectedUserId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Add staff
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove venue access?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.profile.display_name || removeTarget?.profile.full_name} will lose operations access and their staff badge. Their community membership is unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!savingUserId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void removeStaff();
              }}
              disabled={!!savingUserId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
