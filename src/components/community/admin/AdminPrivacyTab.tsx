import { Copy, RefreshCw, Eye, EyeOff, Lock, Globe, UserPlus, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';

interface AdminPrivacyTabProps {
  visibility: string;
  joinMethod: string;
  inviteCode: string | null;
  onVisibilityChange: (visibility: string) => void;
  onJoinMethodChange: (method: string) => void;
  onRegenerateCode: () => Promise<void>;
}

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone can find and view this group', icon: Globe },
  { value: 'unlisted', label: 'Unlisted', description: 'Hidden from search, accessible via link', icon: EyeOff },
  { value: 'private', label: 'Private', description: 'Only members can see group content', icon: Lock },
];

const JOIN_OPTIONS = [
  { value: 'open', label: 'Open', description: 'Anyone can join instantly', icon: Globe },
  { value: 'request', label: 'Request to Join', description: 'Admins must approve new members', icon: UserPlus },
  { value: 'invite', label: 'Invite Only', description: 'Members can only join via invite code', icon: Link2 },
];

export function AdminPrivacyTab({
  visibility,
  joinMethod,
  inviteCode,
  onVisibilityChange,
  onJoinMethodChange,
  onRegenerateCode,
}: AdminPrivacyTabProps) {
  const { toast } = useToast();

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    toast({ title: 'Copied!', description: 'Invite code copied to clipboard' });
  };

  const copyInviteLink = () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/player/community?join=${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Copied!', description: 'Invite link copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      {/* Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visibility
          </CardTitle>
          <CardDescription>
            Control who can find and view your group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={visibility} onValueChange={onVisibilityChange} className="space-y-3">
            {VISIBILITY_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={`visibility-${option.value}`} className="mt-1" />
                <Label htmlFor={`visibility-${option.value}`} className="flex flex-col cursor-pointer">
                  <span className="flex items-center gap-2 font-medium">
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </span>
                  <span className="text-sm text-muted-foreground">{option.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Join Method */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Join Method
          </CardTitle>
          <CardDescription>
            How can new members join your group?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={joinMethod} onValueChange={onJoinMethodChange} className="space-y-3">
            {JOIN_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={`join-${option.value}`} className="mt-1" />
                <Label htmlFor={`join-${option.value}`} className="flex flex-col cursor-pointer">
                  <span className="flex items-center gap-2 font-medium">
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </span>
                  <span className="text-sm text-muted-foreground">{option.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Invite Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Invite Code
          </CardTitle>
          <CardDescription>
            Share this code to invite new members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-lg">
            <span className="flex-1">{inviteCode || 'No code generated'}</span>
            <Button variant="ghost" size="icon" onClick={copyInviteCode} disabled={!inviteCode}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={copyInviteLink} disabled={!inviteCode}>
              <Link2 className="h-4 w-4 mr-2" />
              Copy Invite Link
            </Button>
            <Button variant="outline" onClick={onRegenerateCode}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Regenerating will invalidate the old code. Anyone with the old code won't be able to join.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
