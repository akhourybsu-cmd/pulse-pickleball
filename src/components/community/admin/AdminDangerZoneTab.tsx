import { useState } from 'react';
import { AlertTriangle, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface AdminDangerZoneTabProps {
  groupName: string;
  isOwner: boolean;
  onLeave: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function AdminDangerZoneTab({
  groupName,
  isOwner,
  onLeave,
  onDelete,
}: AdminDangerZoneTabProps) {
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLeave = async () => {
    setIsProcessing(true);
    await onLeave();
    setIsProcessing(false);
    setLeaveDialogOpen(false);
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    await onDelete();
    setIsProcessing(false);
    setDeleteDialogOpen(false);
  };

  const canDelete = deleteConfirmation === groupName;

  return (
    <div className="space-y-6">
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            These actions are irreversible. Please proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Leave Group */}
          {!isOwner && (
            <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg">
              <div>
                <h4 className="font-medium">Leave Group</h4>
                <p className="text-sm text-muted-foreground">
                  Remove yourself from this group. You'll lose access to all group content.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setLeaveDialogOpen(true)}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave
              </Button>
            </div>
          )}

          {/* Delete Group (Owner Only) */}
          {isOwner && (
            <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg">
              <div>
                <h4 className="font-medium">Delete Group</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this group and all its content. This cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

          {isOwner && (
            <p className="text-sm text-muted-foreground">
              As the owner, you cannot leave the group. Transfer ownership first if you want to leave.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <strong>{groupName}</strong>? You'll lose access to all group content
              and will need to rejoin (if the group allows it).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Leaving...' : 'Leave Group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group Permanently?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  This will permanently delete <strong>{groupName}</strong> and all associated data including:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>All posts and comments</li>
                  <li>All events and RSVPs</li>
                  <li>All chat messages</li>
                  <li>All uploaded files</li>
                  <li>All member data</li>
                </ul>
                <div className="pt-2">
                  <Label htmlFor="delete-confirm">
                    Type <strong>{groupName}</strong> to confirm:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Enter group name"
                    className="mt-2"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing} onClick={() => setDeleteConfirmation('')}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete || isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
