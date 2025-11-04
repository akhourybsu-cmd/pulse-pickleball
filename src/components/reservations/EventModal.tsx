import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface EventModalProps {
  event: {
    id: string;
    title: string;
    event_type: "league" | "open_play" | "private" | "lesson";
    start_time: string;
    end_time: string;
    court_number: number;
    capacity?: number;
    current_registrations?: number;
    price?: number;
    instructor?: string;
    description?: string;
    skill_level?: "all" | "beginner" | "intermediate" | "advanced";
  } | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string | null;
  isAdmin?: boolean;
  onRegister?: (eventId: string) => void;
  onRequestPrivate?: (eventId: string) => void;
  onEdit?: (event: any) => void;
}

const EVENT_TYPE_LABELS = {
  league: "League",
  open_play: "Open Play",
  private: "Private Rental",
  lesson: "Lesson",
};

const EVENT_TYPE_COLORS = {
  league: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-100",
  open_play: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100",
  private: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
  lesson: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
};

const SKILL_LEVEL_FULL_LABELS = {
  all: "All Levels",
  beginner: "Beginner (2.0-2.5)",
  intermediate: "Intermediate (3.0-3.5)",
  advanced: "Advanced (4.0+)",
};

export function EventModal({ event, isOpen, onClose, currentUserId, isAdmin, onRegister, onRequestPrivate, onEdit }: EventModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  if (!event) return null;

  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);
  const isFull = event.capacity && event.current_registrations ? event.current_registrations >= event.capacity : false;

  const handleAction = () => {
    if (!currentUserId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to register for events",
      });
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (event.event_type === "private" && onRequestPrivate) {
      onRequestPrivate(event.id);
    } else if (onRegister) {
      onRegister(event.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event.title}
            <Badge className={EVENT_TYPE_COLORS[event.event_type]}>
              {EVENT_TYPE_LABELS[event.event_type]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{format(startTime, "EEEE, MMMM d, yyyy")}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>Court {event.court_number}</span>
          </div>

          {event.skill_level && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {SKILL_LEVEL_FULL_LABELS[event.skill_level]}
              </Badge>
            </div>
          )}

          {event.capacity && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>{event.current_registrations || 0} / {event.capacity} registered</span>
              {isFull && <Badge variant="destructive">Full</Badge>}
            </div>
          )}

          {event.price !== undefined && event.price > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>${event.price.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">(No payment required at this time)</span>
            </div>
          )}

          {event.instructor && (
            <div className="text-sm">
              <span className="text-muted-foreground">Instructor: </span>
              <span className="font-medium">{event.instructor}</span>
            </div>
          )}

          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}

          {/* Admin Edit Button */}
          {isAdmin && onEdit && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                onEdit(event);
                onClose();
              }}
            >
              Edit Event
            </Button>
          )}

          {/* Action buttons */}
          {!isAdmin && (
            <div className="flex gap-2 pt-4">
              {event.event_type === "open_play" && (
                <Button 
                  className="flex-1"
                  onClick={handleAction}
                  style={
                    !isFull ? {
                      backgroundColor: '#B9E43B',
                      color: '#0E4C58',
                    } : undefined
                  }
                  variant={isFull ? "outline" : "default"}
                >
                  {isFull ? "Join Waitlist" : "Register"}
                </Button>
              )}

              {event.event_type === "private" && (
                <Button 
                  className="flex-1"
                  variant="outline"
                  onClick={handleAction}
                >
                  Request Rental
                </Button>
              )}

              {event.event_type === "lesson" && (
                <Button 
                  className="flex-1"
                  onClick={handleAction}
                  style={
                    !isFull ? {
                      backgroundColor: '#B9E43B',
                      color: '#0E4C58',
                    } : undefined
                  }
                  variant={isFull ? "outline" : "default"}
                >
                  {isFull ? "Join Waitlist" : "Book Lesson"}
                </Button>
              )}

              {event.event_type === "league" && (
                <div className="flex-1 p-3 bg-muted rounded-lg text-sm text-center">
                  League registration managed separately
                </div>
              )}

              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {!isAdmin && !currentUserId && (
            <p className="text-xs text-center text-muted-foreground">
              Sign in to register for this event
            </p>
          )}

          {isAdmin && (
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
