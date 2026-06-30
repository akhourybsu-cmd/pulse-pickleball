import { useState } from 'react';
import { Copy, RefreshCw, Eye, EyeOff, Lock, Globe, UserPlus, Link2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface AdminPrivacyTabProps {
  visibility: string;
  joinMethod: string;
  inviteCode: string | null;
  /** When set, the current invite code stops working after this timestamp. */
  inviteCodeExpiresAt: string | null;
  onVisibilityChange: (visibility: string) => void;
  onJoinMethodChange: (method: string) => void;
  /** Pass the rotation duration in seconds, or null for "never expires". */
  onRegenerateCode: (expiresInSeconds: number | null) => Promise<void>;
}

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expires', seconds: null },
  { value: '24h',   label: '24 hours',     seconds: 24 * 60 * 60 },
  { value: '7d',    label: '7 days',       seconds: 7 * 24 * 60 * 60 },
  { value: '30d',   label: '30 days',      seconds: 30 * 24 * 60 * 60 },
] as const;

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
  inviteCodeExpiresAt,
  onVisibilityChange,
  onJoinMethodChange,
  onRegenerateCode,
}: AdminPrivacyTabProps) {
  const { toast } = useToast();
  const [pendingExpiry, setPendingExpiry] = useState<typeof EXPIRY_OPTIONS[number]['value']>('never');
  const [regenerating, setRegenerating] = useState(false);

  // Compute the current code's expiry display state. NULL means
  // "never expires"; past = "expired", future = "expires …".
  const expiryState = (() => {
    if (!inviteCode) return null;
    if (!inviteCodeExpiresAt) return { tone: 'neutral' as const, label: 'Never expires' };
    const at = new Date(inviteCodeExpiresAt);
    const expired = at.getTime() < Date.now();
    if (expired) return { tone: 'danger' as const, label: `Expired ${at.toLocaleString()}` };
    return { tone: 'info' as const, label: `Expires ${at.toLocaleString()}` };
  })();

  const handleRegenerate = async () => {
    const opt = EXPIRY_OPTIONS.find((o) => o.value === pendingExpiry);
    setRegenerating(true);
    try {
      await onRegenerateCode(opt?.seconds ?? null);
    } finally {
      setRegenerating(false);
    }
  };

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

          {/* Current-code expiry state line — only renders when there's
              an actual code. Color-coded by tone for at-a-glance read. */}
          {expiryState && (
            <div
              className={`flex items-center gap-2 text-xs ${
                expiryState.tone === 'danger'
                  ? 'text-destructive'
                  : expiryState.tone === 'info'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{expiryState.label}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={copyInviteLink} disabled={!inviteCode}>
              <Link2 className="h-4 w-4 mr-2" />
              Copy Invite Link
            </Button>
          </div>

          {/* Rotate row — duration picker + Regenerate together so the
              owner doesn't accidentally regenerate without a chance to
              set expiry. Defaults to "Never" so prior behavior is
              preserved unless the user opts in. */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={pendingExpiry}
              onValueChange={(v) => setPendingExpiry(v as typeof pendingExpiry)}
            >
              <SelectTrigger className="sm:max-w-[200px]">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Regenerating immediately invalidates the old code. Anyone with the old code won't be able to join.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
