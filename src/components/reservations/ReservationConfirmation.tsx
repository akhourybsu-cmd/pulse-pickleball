import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";

interface ReservationConfirmationProps {
  reservation: {
    eventTitle: string;
    eventType: string;
    startTime: string;
    endTime: string;
    courtNumber: number;
    price?: number;
    status: "confirmed" | "waitlist" | "pending";
  };
}

export function ReservationConfirmation({ reservation }: ReservationConfirmationProps) {
  const startTime = new Date(reservation.startTime);
  const endTime = new Date(reservation.endTime);

  return (
    <Card className="max-w-md mx-auto overflow-hidden">
      {/* Branded Header */}
      <div 
        className="p-6 text-center"
        style={{
          background: 'linear-gradient(135deg, #0E4C58 0%, #1a6b7a 100%)',
        }}
      >
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#B9E43B' }}>
          {reservation.status === "confirmed" ? "Reservation Confirmed!" : 
           reservation.status === "waitlist" ? "Added to Waitlist" : 
           "Pending Confirmation"}
        </h2>
        <p className="text-white/90 text-sm">Pickleball Citi - Cranston</p>
        <p className="text-white/70 text-xs">Powered by PULSE</p>
      </div>

      {/* Event Details */}
      <div className="p-6 space-y-4">
        <div>
          <h3 className="font-bold text-lg mb-1">{reservation.eventTitle}</h3>
          <Badge>{reservation.eventType}</Badge>
        </div>

        <div className="space-y-2">
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
            <span>Court {reservation.courtNumber}</span>
          </div>

          {reservation.price !== undefined && reservation.price > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Price:</span>
              <span>${reservation.price.toFixed(2)}</span>
            </div>
          )}
        </div>

        {reservation.status === "waitlist" && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              You're on the waitlist. We'll notify you if a spot opens up!
            </p>
          </div>
        )}

        {reservation.status === "pending" && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Your request has been submitted. An admin will confirm your reservation soon.
            </p>
          </div>
        )}

        <div className="pt-4 border-t text-xs text-muted-foreground">
          <p>Questions? Contact Pickleball Citi</p>
          <p className="mt-1">This confirmation was sent via PULSE</p>
        </div>
      </div>
    </Card>
  );
}
