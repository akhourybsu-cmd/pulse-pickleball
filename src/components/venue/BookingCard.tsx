import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Clock, User, Phone, Mail, MoreVertical, MapPin, DollarSign, X, Check } from 'lucide-react';
import { VenueBooking } from '@/hooks/useVenueBookings';
import { format } from 'date-fns';

interface BookingCardProps {
  booking: VenueBooking;
  onUpdateStatus: (id: string, status: VenueBooking['status']) => void;
  onCancel: (id: string) => void;
}

export function BookingCard({ booking, onUpdateStatus, onCancel }: BookingCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const startTime = new Date(booking.start_time);
  const endTime = new Date(booking.end_time);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold truncate">{booking.customer_name}</h3>
              <Badge variant="outline" className={getStatusColor(booking.status)}>
                {booking.status}
              </Badge>
            </div>

            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {format(startTime, 'MMM d, yyyy')} • {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                </span>
              </div>

              {booking.court && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{booking.court.name} (Court {booking.court.court_number})</span>
                </div>
              )}

              {booking.customer_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{booking.customer_email}</span>
                </div>
              )}

              {booking.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{booking.customer_phone}</span>
                </div>
              )}

              {booking.total_price && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>${booking.total_price.toFixed(2)}</span>
                </div>
              )}
            </div>

            {booking.notes && (
              <p className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                {booking.notes}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {booking.status === 'pending' && (
                <DropdownMenuItem onClick={() => onUpdateStatus(booking.id, 'confirmed')}>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm
                </DropdownMenuItem>
              )}
              {booking.status === 'confirmed' && (
                <DropdownMenuItem onClick={() => onUpdateStatus(booking.id, 'completed')}>
                  <Check className="h-4 w-4 mr-2" />
                  Mark Completed
                </DropdownMenuItem>
              )}
              {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                <DropdownMenuItem 
                  onClick={() => onCancel(booking.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Booking
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
