import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Crown, Shield, MoreVertical, UserMinus, ShieldPlus, ShieldMinus, Ban, Check, X, UserPlus, Share2, MessageCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupEmptyState } from './GroupEmptyState';
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
import { useGroupMembers, type GroupMemberWithProfile } from '@/hooks/useGroupMembers';
import { useFriends } from '@/hooks/useFriends';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { OnlineIndicator } from './OnlineIndicator';
import { MemberActionSheet, type MemberActionTarget } from './MemberActionSheet';
import { cn } from '@/lib/utils';

interface GroupMembersProps {
  groupId: string;
  isAdmin: boolean;
  isOwner: boolean;
  currentUserId: string | null;
  onInviteClick?: () => void;
  isOnline?: (userId: string) => boolean;
}

// Memoized member card for better performance
const MemberCard = memo(function MemberCard({
  member,
  isPending = false,
  isSelf,
  isAdmin,
  isOwner,
  currentUserId,
  isOnline,
  onApprove,
  onReject,
  onUpdateRole,
  onRemove,
  onBan,
  onStartDM,
  onSendFriendRequest,
  getFriendshipStatus,
  onOpenSheet,
}: {
  member: GroupMemberWithProfile;
  isPending?: boolean;
  isSelf: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  currentUserId: string | null;
  isOnline: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onUpdateRole: (id: string, role: 'moderator' | 'member') => void;
  onRemove: (member: GroupMemberWithProfile) => void;
  onBan: (member: GroupMemberWithProfile) => void;
  onStartDM: (userId: string) => void;
  onSendFriendRequest: (userId: string) => void;
  getFriendshipStatus: (userId: string) => string;
  /** Opens the call/text/message/profile bottom sheet for this member. */
  onOpenSheet?: (member: GroupMemberWithProfile) => void;
}) {
  const canManage = isAdmin && !isSelf && member.role !== 'owner';
  const canChangeRole = isOwner && !isSelf && member.role !== 'owner';
  const initials = (member.profile?.display_name || member.profile?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const friendshipStatus = !isSelf ? getFriendshipStatus(member.user_id) : 'none';

  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="flex items-center gap-3 py-3">
        <div className="relative">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={member.profile?.avatar_url || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <OnlineIndicator 
            isOnline={isOnline} 
            size="sm" 
            showPulse={false}
            className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
          />
        </div>

        {/* Tap-target — opens MemberActionSheet for self/others alike. The
            sheet hides call/text rows automatically when the row is the
            current user (handled inside the sheet via target.userId check
            upstream — here we pass through every non-pending row). For
            pending requests this is non-tappable so admins focus on
            approve/reject. */}
        <button
          type="button"
          disabled={isPending}
          onClick={() => !isPending && onOpenSheet?.(member)}
          className={cn(
            'flex-1 min-w-0 text-left rounded-md -mx-1 px-1 py-0.5',
            !isPending && 'hover:bg-muted/30 active:bg-muted/50 transition-colors',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {member.profile?.display_name || member.profile?.full_name || 'Unknown'}
            </span>
            {member.profile?.current_rating && (
              <Badge variant="outline" className="text-xs h-5">
                {member.profile.current_rating.toFixed(2)}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {isPending
              ? `Requested ${formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}`
              : `Joined ${formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}`
            }
          </div>
        </button>

        {/* Role Badge */}
        {!isPending && (
          <Badge 
            variant="secondary" 
            className={cn(
              'gap-1',
              member.role === 'owner' && 'bg-amber-500/10 text-amber-600 border-amber-200',
              member.role === 'moderator' && 'bg-blue-500/10 text-blue-600 border-blue-200'
            )}
          >
            {member.role === 'owner' && <Crown className="h-3 w-3" />}
            {member.role === 'moderator' && <Shield className="h-3 w-3" />}
            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
          </Badge>
        )}

        {/* Pending Actions */}
        {isPending && isAdmin && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:bg-green-500/10"
              onClick={() => onApprove(member.id)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-500/10"
              onClick={() => onReject(member.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Quick Actions for non-self members */}
        {!isPending && !isSelf && (
          <div className="flex items-center gap-1">
            {/* Message Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onStartDM(member.user_id)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>

            {/* Friend Action Button */}
            {friendshipStatus === 'none' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onSendFriendRequest(member.user_id)}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
            {friendshipStatus === 'pending_sent' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                disabled
              >
                <Clock className="h-4 w-4" />
              </Button>
            )}
            {friendshipStatus === 'accepted' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                disabled
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Member Actions */}
        {!isPending && canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canChangeRole && member.role === 'member' && (
                <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'moderator')}>
                  <ShieldPlus className="h-4 w-4 mr-2" />
                  Make Moderator
                </DropdownMenuItem>
              )}
              {canChangeRole && member.role === 'moderator' && (
                <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'member')}>
                  <ShieldMinus className="h-4 w-4 mr-2" />
                  Remove Moderator
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onRemove(member)}
                className="text-destructive"
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Remove from Group
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onBan(member)}
                className="text-destructive"
              >
                <Ban className="h-4 w-4 mr-2" />
                Ban Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardContent>
    </Card>
  );
});

export function GroupMembers({ 
  groupId, 
  isAdmin, 
  isOwner, 
  currentUserId, 
  onInviteClick,
  isOnline: isOnlineProp,
}: GroupMembersProps) {
  const navigate = useNavigate();
  const { 
    members, 
    pendingMembers, 
    loading, 
    approveMember, 
    rejectMember, 
    updateRole, 
    removeMember, 
    banMember 
  } = useGroupMembers(groupId);

  const { sendFriendRequest, getFriendshipStatus } = useFriends();
  const { startConversation } = useDirectMessages();
  
  const [actionDialog, setActionDialog] = useState<{
    type: 'remove' | 'ban' | null;
    member: GroupMemberWithProfile | null;
  }>({ type: null, member: null });

  // Bottom-sheet target for the per-member contact actions. Opens on
  // row tap (avatar+name area) — replaces the prior pattern where DM
  // was the only one-click affordance on the row.
  const [sheetTarget, setSheetTarget] = useState<MemberActionTarget | null>(null);

  const handleOpenSheet = useCallback((member: GroupMemberWithProfile) => {
    setSheetTarget({
      userId: member.user_id,
      displayName: member.profile?.display_name || member.profile?.full_name || 'Unknown',
      avatarUrl: member.profile?.avatar_url ?? null,
      rating: member.profile?.current_rating ?? null,
      phoneNumber: member.profile?.phone_number ?? null,
    });
  }, []);

  const handleAction = useCallback(async () => {
    if (!actionDialog.member) return;
    
    if (actionDialog.type === 'remove') {
      await removeMember(actionDialog.member.id);
    } else if (actionDialog.type === 'ban') {
      await banMember(actionDialog.member.id);
    }
    
    setActionDialog({ type: null, member: null });
  }, [actionDialog, removeMember, banMember]);

  const handleStartDM = useCallback(async (userId: string) => {
    const conversationId = await startConversation(userId);
    if (conversationId) {
      navigate(`/player/messages/${conversationId}`);
    }
  }, [startConversation, navigate]);

  const handleRemove = useCallback((member: GroupMemberWithProfile) => {
    setActionDialog({ type: 'remove', member });
  }, []);

  const handleBan = useCallback((member: GroupMemberWithProfile) => {
    setActionDialog({ type: 'ban', member });
  }, []);

  // Default isOnline function if not provided
  const checkIsOnline = useCallback((userId: string) => {
    return isOnlineProp ? isOnlineProp(userId) : false;
  }, [isOnlineProp]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingMembers.length > 0 && isAdmin && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Badge variant="secondary" className="h-5">{pendingMembers.length}</Badge>
            Pending Requests
          </h3>
          {pendingMembers.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              isPending
              isSelf={currentUserId === m.user_id}
              isAdmin={isAdmin}
              isOwner={isOwner}
              currentUserId={currentUserId}
              isOnline={checkIsOnline(m.user_id)}
              onApprove={approveMember}
              onReject={rejectMember}
              onUpdateRole={updateRole}
              onRemove={handleRemove}
              onBan={handleBan}
              onStartDM={handleStartDM}
              onSendFriendRequest={sendFriendRequest}
              getFriendshipStatus={getFriendshipStatus}
              onOpenSheet={handleOpenSheet}
            />
          ))}
        </div>
      )}

      {/* Active Members */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          {members.length} Members
        </h3>
        {members.length === 0 ? (
          <GroupEmptyState
            icon={Users}
            title="Just you for now"
            description="Invite players to grow your group and start playing together!"
            actions={[
              { label: 'Invite Players', onClick: () => onInviteClick?.(), icon: UserPlus },
              { label: 'Share Link', onClick: () => onInviteClick?.(), variant: 'outline', icon: Share2 },
            ]}
          />
        ) : (
          members.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              isSelf={currentUserId === m.user_id}
              isAdmin={isAdmin}
              isOwner={isOwner}
              currentUserId={currentUserId}
              isOnline={checkIsOnline(m.user_id)}
              onApprove={approveMember}
              onReject={rejectMember}
              onUpdateRole={updateRole}
              onRemove={handleRemove}
              onBan={handleBan}
              onStartDM={handleStartDM}
              onSendFriendRequest={sendFriendRequest}
              getFriendshipStatus={getFriendshipStatus}
              onOpenSheet={handleOpenSheet}
            />
          ))
        )}
      </div>

      {/* Member action sheet — call / text / DM / profile */}
      <MemberActionSheet
        target={sheetTarget}
        onClose={() => setSheetTarget(null)}
        onMessage={handleStartDM}
      />

      {/* Confirmation Dialog */}
      <AlertDialog
        open={actionDialog.type !== null} 
        onOpenChange={() => setActionDialog({ type: null, member: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog.type === 'remove' ? 'Remove Member' : 'Ban Member'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === 'remove' 
                ? `Are you sure you want to remove ${actionDialog.member?.profile?.display_name || 'this member'} from the group? They can rejoin using the invite code.`
                : `Are you sure you want to ban ${actionDialog.member?.profile?.display_name || 'this member'}? They will not be able to rejoin the group.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionDialog.type === 'remove' ? 'Remove' : 'Ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
