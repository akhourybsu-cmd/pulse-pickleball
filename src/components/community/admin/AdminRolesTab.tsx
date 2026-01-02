import { useState } from 'react';
import { Crown, Shield, ChevronDown, ChevronUp, UserMinus, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroupMemberWithProfile } from '@/hooks/useGroupMembers';

interface AdminRolesTabProps {
  members: GroupMemberWithProfile[];
  currentUserId: string | null;
  isOwner: boolean;
  onPromoteToModerator: (memberId: string) => Promise<boolean>;
  onDemoteToMember: (memberId: string) => Promise<boolean>;
  onTransferOwnership: (newOwnerId: string) => Promise<boolean>;
}

export function AdminRolesTab({
  members,
  currentUserId,
  isOwner,
  onPromoteToModerator,
  onDemoteToMember,
  onTransferOwnership,
}: AdminRolesTabProps) {
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  const owner = members.find((m) => m.role === 'owner');
  const moderators = members.filter((m) => m.role === 'moderator');
  const regularMembers = members.filter((m) => m.role === 'member');

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) return;
    setIsTransferring(true);
    const success = await onTransferOwnership(selectedNewOwner);
    setIsTransferring(false);
    if (success) {
      setTransferDialogOpen(false);
      setSelectedNewOwner('');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Owner Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Owner
          </CardTitle>
          <CardDescription>
            The owner has full control over the group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {owner && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={owner.profile.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(owner.profile.display_name || owner.profile.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{owner.profile.display_name || owner.profile.full_name}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    <Crown className="h-3 w-3 mr-1" />
                    Owner
                  </Badge>
                </div>
              </div>
              {isOwner && members.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transfer
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Moderators Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Moderators
            <Badge variant="secondary" className="ml-2">{moderators.length}</Badge>
          </CardTitle>
          <CardDescription>
            Moderators help manage the group based on permissions you've set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {moderators.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No moderators yet. Promote members from the list below.
            </p>
          ) : (
            moderators.map((mod) => (
              <div key={mod.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={mod.profile.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(mod.profile.display_name || mod.profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{mod.profile.display_name || mod.profile.full_name}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      <Shield className="h-3 w-3 mr-1" />
                      Moderator
                    </Badge>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDemoteToMember(mod.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Demote
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Members to Promote */}
      {isOwner && regularMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Promote to Moderator</CardTitle>
            <CardDescription>
              Select members to give moderator privileges.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {regularMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profile.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(member.profile.display_name || member.profile.full_name)}</AvatarFallback>
                  </Avatar>
                  <p className="font-medium">{member.profile.display_name || member.profile.full_name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPromoteToModerator(member.id)}
                >
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Promote
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transfer Ownership Dialog */}
      <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                You are about to transfer ownership of this group. This action cannot be undone.
                You will become a moderator after the transfer.
              </p>
              <div className="pt-2">
                <Select value={selectedNewOwner} onValueChange={setSelectedNewOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {moderators.map((mod) => (
                      <SelectItem key={mod.user_id} value={mod.user_id}>
                        {mod.profile.display_name || mod.profile.full_name}
                      </SelectItem>
                    ))}
                    {regularMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profile.display_name || member.profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransferring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={!selectedNewOwner || isTransferring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isTransferring ? 'Transferring...' : 'Transfer Ownership'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
