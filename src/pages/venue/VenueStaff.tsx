import { useState, useEffect } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueStaff } from '@/hooks/useVenueStaff';
import { StaffMemberCard } from '@/components/venue/StaffMemberCard';
import { InviteStaffDialog } from '@/components/venue/InviteStaffDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Mail, Shield, UserCog, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function VenueStaff() {
  const { currentVenueId } = useMode();
  const { staff, loading, refetch, updateStaffRole, removeStaff } = useVenueStaff(currentVenueId);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id || null);
    };
    getUser();
  }, []);

  if (!currentVenueId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No venue selected. Please select a venue from the mode switcher.
          </CardContent>
        </Card>
      </div>
    );
  }

  const owners = staff.filter(s => s.role === 'owner');
  const managers = staff.filter(s => s.role === 'manager');
  const staffMembers = staff.filter(s => s.role === 'staff');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">
            Manage your venue's team and permissions
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Mail className="h-4 w-4 mr-2" />
          Invite Staff
        </Button>
      </div>

      <InviteStaffDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        venueId={currentVenueId}
        onSuccess={refetch}
      />

      {/* Role Legend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Role Permissions</CardTitle>
          <CardDescription>Understanding staff access levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Owner</p>
                <p className="text-sm text-muted-foreground">
                  Full access including billing and staff management
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <UserCog className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Manager</p>
                <p className="text-sm text-muted-foreground">
                  Manage courts, events, and bookings
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Staff</p>
                <p className="text-sm text-muted-foreground">
                  View access and check-in assistance
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : staff.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">No staff members</h3>
            <p className="text-muted-foreground mb-4">
              Invite team members to help manage your venue.
            </p>
            <Button onClick={() => setInviteOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Invite Staff
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {owners.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Owners ({owners.length})
              </h3>
              <div className="space-y-2">
                {owners.map((member) => (
                  <StaffMemberCard
                    key={member.id}
                    member={member}
                    currentUserId={currentUserId}
                    onUpdateRole={updateStaffRole}
                    onRemove={removeStaff}
                  />
                ))}
              </div>
            </div>
          )}

          {managers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Managers ({managers.length})
              </h3>
              <div className="space-y-2">
                {managers.map((member) => (
                  <StaffMemberCard
                    key={member.id}
                    member={member}
                    currentUserId={currentUserId}
                    onUpdateRole={updateStaffRole}
                    onRemove={removeStaff}
                  />
                ))}
              </div>
            </div>
          )}

          {staffMembers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Staff ({staffMembers.length})
              </h3>
              <div className="space-y-2">
                {staffMembers.map((member) => (
                  <StaffMemberCard
                    key={member.id}
                    member={member}
                    currentUserId={currentUserId}
                    onUpdateRole={updateStaffRole}
                    onRemove={removeStaff}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
