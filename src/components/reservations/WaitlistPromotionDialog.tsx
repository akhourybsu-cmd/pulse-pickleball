import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

interface WaitlistPromotionDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
}

export function WaitlistPromotionDialog({
  isOpen,
  onAccept,
  onDecline,
  eventTitle,
  eventDate,
  eventTime,
}: WaitlistPromotionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            You're Off the Waitlist!
          </DialogTitle>
          <DialogDescription>
            A spot has opened up for this event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">{eventTitle}</h3>
            <p className="text-sm text-muted-foreground">{eventDate}</p>
            <p className="text-sm text-muted-foreground">{eventTime}</p>
          </div>

          <p className="text-sm">
            You've been promoted from the waitlist! Would you like to confirm your spot?
          </p>

          <div className="flex gap-2">
            <Button 
              onClick={onAccept}
              className="flex-1 gap-2"
              style={{
                backgroundColor: '#B9E43B',
                color: '#0E4C58',
              }}
            >
              <CheckCircle className="w-4 h-4" />
              Accept Spot
            </Button>
            <Button 
              onClick={onDecline}
              variant="outline"
              className="flex-1 gap-2"
            >
              <XCircle className="w-4 h-4" />
              Decline
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            If you decline, the next person on the waitlist will be notified.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
