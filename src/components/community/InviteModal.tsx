import { useState } from 'react';
import { Copy, Check, Share2, MessageSquare } from 'lucide-react';
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
    ? `${window.location.origin}/player/community/join/${encodeURIComponent(inviteCode)}`
    : '';

  const shareMessage = inviteCode
    ? `Join "${groupName}" on Pulse 🎾\n\nTap to join: ${inviteLink}\n(or enter code ${inviteCode} in the app)`
    : '';

  const safeCopy = async (text: string, label: string, setFlag: (v: boolean) => void) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older WebViews
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setFlag(true);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
      setTimeout(() => setFlag(false), 2000);
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Long-press the text to copy it manually.',
        variant: 'destructive',
      });
    }
  };

  const copyCode = () => inviteCode && safeCopy(inviteCode, 'Invite code', setCodeCopied);
  const copyLink = () => inviteLink && safeCopy(inviteLink, 'Invite link', setLinkCopied);

  const shareLink = async () => {
    if (!inviteLink) return;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: `Join ${groupName}`,
          text: shareMessage,
          url: inviteLink,
        });
        return;
      } catch (err: any) {
        // AbortError = user cancelled; don't fallback
        if (err?.name === 'AbortError') return;
      }
    }
    copyLink();
  };

  const inviteViaSMS = () => {
    if (!inviteCode) return;
    // sms: URIs must be navigated to directly — window.open() is blocked
    // by iOS Safari. Use location.href so the OS hands off to Messages.
    const body = encodeURIComponent(shareMessage);
    window.location.href = `sms:?&body=${body}`;
  };

  if (!inviteCode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {groupName}</DialogTitle>
          <DialogDescription>
            Anyone with this code or link can join — even private crews.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Invite Code */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Invite Code</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyCode}
                className="flex-1 bg-muted rounded-lg px-4 py-3 text-center hover:bg-muted/80 transition-colors"
                aria-label="Copy invite code"
              >
                <code className="text-2xl font-bold tracking-widest select-all">{inviteCode}</code>
              </button>
              <Button variant="outline" size="icon" onClick={copyCode} aria-label="Copy code">
                {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-2">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={inviteLink} size={160} level="M" includeMargin={false} />
            </div>
            <p className="text-xs text-muted-foreground">Scan to join</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" onClick={copyLink}>
              {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
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
