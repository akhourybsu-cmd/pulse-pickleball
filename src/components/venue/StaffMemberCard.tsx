import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreVertical, Shield, UserCog, User, Trash2 } from 'lucide-react';
import { VenueStaffMember } from '@/hooks/useVenueStaff';

interface StaffMemberCardProps {
  member: VenueStaffMember;
  currentUserId: string | null;
  onUpdateRole: (staffId: string, role: 'owner' | 'manager' | 'staff') => Promise<void>;
  onRemove: (staffId: string) => Promise<void>;
}

export function StaffMemberCard({ member, currentUserId, onUpdateRole, onRemove }: StaffMemberCardProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const isCurrentUser = member.user_id === currentUserId;
  const isOwner = member.role === 'owner';

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(member.id);
      setRemoveDialogOpen(false);
    } finally {
      setIsRemoving(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'manager': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Shield;
      case 'manager': return UserCog;
      default: return User;
    }
  };

  const RoleIcon = getRoleIcon(member.role);
  const initials = member.profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.profile?.avatar_url || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {member.profile?.full_name || 'Unknown User'}
                  </p>
                  {isCurrentUser && (
                    <Badge variant="outline" className="text-xs">You</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {member.profile?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize">
                <RoleIcon className="h-3 w-3 mr-1" />
                {member.role}
              </Badge>

              {!isOwner && !isCurrentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'manager')}>
                      <UserCog className="h-4 w-4 mr-2" />
                      Make Manager
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'staff')}>
                      <User className="h-4 w-4 mr-2" />
                      Make Staff
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setRemoveDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {member.profile?.full_name || 'this user'} from 
              the venue? They will lose access to all venue management features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
