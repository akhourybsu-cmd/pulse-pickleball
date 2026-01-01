import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, LogOut, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useToast } from '@/hooks/use-toast';
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
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Group['visibility']>('unlisted');
  const [joinMethod, setJoinMethod] = useState<Group['join_method']>('open');
  
  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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
      setVisibility(groupData.visibility);
      setJoinMethod(groupData.join_method);
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
          visibility,
          join_method: joinMethod,
        })
        .eq('id', groupId);

      if (error) throw error;

      toast({ title: 'Saved', description: 'Group settings updated' });
      navigate(`/player/community/group/${groupId}`);
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
      // Generate new code
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

  const copyInviteCode = async () => {
    if (!group?.invite_code) return;
    
    await navigator.clipboard.writeText(group.invite_code);
    setCodeCopied(true);
    toast({ title: 'Copied!', description: 'Invite code copied to clipboard' });
    setTimeout(() => setCodeCopied(false), 2000);
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

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold">Group not found</h2>
        <Button onClick={() => navigate('/player/community')} className="mt-4">
          Back to Community
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(`/player/community/group/${groupId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Group Settings</h1>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your group..."
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Access */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as Group['visibility'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public - Anyone can find</SelectItem>
                <SelectItem value="unlisted">Unlisted - Only with link/code</SelectItem>
                <SelectItem value="private">Private - Invite only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Join Method</Label>
            <Select value={joinMethod} onValueChange={(v) => setJoinMethod(v as Group['join_method'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open - Anyone can join</SelectItem>
                <SelectItem value="request_to_join">Request - Admin approval required</SelectItem>
                <SelectItem value="invite_only">Invite Only - No public joining</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invite Code */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Code</CardTitle>
          <CardDescription>Share this code to invite new members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <code className="font-mono text-lg font-semibold flex-1">
              {group.invite_code}
            </code>
            <Button variant="ghost" size="icon" onClick={copyInviteCode}>
              {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={regenerateInviteCode}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full gap-2">
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isOwner && (
            <Button 
              variant="outline" 
              className="w-full gap-2 text-destructive hover:bg-destructive/10"
              onClick={() => setLeaveDialogOpen(true)}
            >
              <LogOut className="h-4 w-4" />
              Leave Group
            </Button>
          )}
          {isOwner && (
            <Button 
              variant="destructive" 
              className="w-full gap-2"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Group
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Leave Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to rejoin using the invite code or request access again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All posts, events, files, and member data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}