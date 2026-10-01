import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoundRobinRegistration } from "./RoundRobinRegistration";
import { useRoundRobinEntry } from "@/hooks/useRoundRobinEntry";

interface Props {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onJoinSuccess?: () => void;
}

export function RoundRobinEventDetailDialog({ eventId, isOpen, onClose, onJoinSuccess }: Props) {
  const entry = useRoundRobinEntry(eventId);
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader className="sr-only"><DialogTitle>Round Robin Event</DialogTitle><DialogDescription>Event details and registration</DialogDescription></DialogHeader>
      <RoundRobinRegistration entry={entry} eventId={eventId} onJoined={() => { onJoinSuccess?.(); onClose(); }} />
    </DialogContent>
  </Dialog>;
}
