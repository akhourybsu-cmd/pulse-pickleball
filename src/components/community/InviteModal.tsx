import { useState } from 'react';
import { Copy, Check, Share2, MessageSquare, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteCode: string | null;
  groupName: string;
}

export function InviteModal({ open, onOpenChange, inviteCode, groupName }: InviteModalProps) {
  const { toast } = useToast();
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const inviteLink = inviteCode 
    ? `${window.location.origin}/player/community/join/${inviteCode}` 
    : '';

  const copyCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    toast({ title: 'Copied!', description: 'Invite code copied to clipboard' });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    toast({ title: 'Copied!', description: 'Invite link copied to clipboard' });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!inviteLink) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName}`,
          text: `Join my group "${groupName}" on Pulse!`,
          url: inviteLink,
        });
      } catch (err) {
        // User cancelled or share failed
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const inviteViaSMS = () => {
    const message = encodeURIComponent(
      `Join my group "${groupName}" on Pulse! Use code: ${inviteCode} or click: ${inviteLink}`
    );
    window.open(`sms:?body=${message}`, '_blank');
  };

  if (!inviteCode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {groupName}</DialogTitle>
          <DialogDescription>
            Share the invite code or link with others to join
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Invite Code */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Invite Code</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-center">
                <code className="text-2xl font-bold tracking-widest">{inviteCode}</code>
              </div>
              <Button variant="outline" size="icon" onClick={copyCode}>
                {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={inviteLink} size={160} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" onClick={copyLink}>
              {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy Link
            </Button>
            <Button variant="outline" className="gap-2" onClick={shareLink}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>

          <Button variant="secondary" className="w-full gap-2" onClick={inviteViaSMS}>
            <MessageSquare className="h-4 w-4" />
            Invite via Text
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
