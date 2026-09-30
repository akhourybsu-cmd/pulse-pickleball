import { useState } from "react";
import { Copy, Share2, MessageSquare } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  communityShareTarget,
  communityShareData,
  copyCommunityText,
  shareCommunity,
} from "@/lib/communityShare";

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteCode: string | null;
  groupName: string;
  shareUrl?: string;
}

export function InviteModal({
  open,
  onOpenChange,
  inviteCode,
  groupName,
  shareUrl,
}: InviteModalProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  // Public shares open the overview. Private communities still use an invitation.
  const url = communityShareTarget(shareUrl, inviteCode);
  if (!url) return null;
  const data = communityShareData(groupName, url);
  const copy = async (text: string, label: string) => {
    try {
      await copyCommunityText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({
        title: "Could not copy",
        description: "Select the link below to copy it.",
        variant: "destructive",
      });
    }
  };
  const share = async () => {
    setBusy(true);
    try {
      if ((await shareCommunity(data)) === "copied")
        toast({
          title: "Invitation copied",
          description: "Paste it into a message to invite your friends.",
        });
    } catch {
      toast({
        title: "Could not share",
        description: "Select the link below to copy it.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-md sm:p-6">
        <DialogHeader className="min-w-0 pr-5 text-left">
          <DialogTitle className="text-xl leading-tight [overflow-wrap:anywhere]">
            Join {groupName}
          </DialogTitle>
          <DialogDescription>
            Send an invitation. Friends can see the community before creating an
            account.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-sm leading-6 [overflow-wrap:anywhere]">
              {data.text}
            </p>
            <a
              className="mt-2 block break-all text-xs leading-5 text-muted-foreground underline"
              href={url}
            >
              {url}
            </a>
          </div>
          <Button
            className="min-h-12 w-full gap-2"
            onClick={() => void share()}
            disabled={busy}
          >
            <Share2 className="h-4 w-4" />
            {busy ? "Opening share…" : "Share invitation"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="min-h-11 gap-2 px-2"
              onClick={() => void copy(url, "Link")}
            >
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
            <Button variant="outline" className="min-h-11 gap-2 px-2" asChild>
              <a
                href={`sms:?&body=${encodeURIComponent(
                  `${data.text}\n${url}`
                )}`}
              >
                <MessageSquare className="h-4 w-4" />
                Text invite
              </a>
            </Button>
          </div>
          <div className="flex flex-col items-center gap-3 border-t pt-4">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG
                value={url}
                size={136}
                level="M"
                title={`Join ${groupName}`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Scan to open the community
            </p>
            {inviteCode && (
              <Button
                variant="ghost"
                className="h-auto min-h-11 max-w-full gap-2 whitespace-normal text-xs"
                onClick={() => void copy(inviteCode, "Invite code")}
              >
                <Copy className="h-4 w-4 shrink-0" />
                <span className="break-all">Code: {inviteCode}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
