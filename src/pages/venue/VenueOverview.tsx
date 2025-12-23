import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMode } from '@/contexts/ModeContext';
import { useVenueCourts } from '@/hooks/useVenueCourts';
import { useVenueStaff } from '@/hooks/useVenueStaff';
import { useVenueBookings } from '@/hooks/useVenueBookings';
import { useVenueEvents } from '@/hooks/useVenueEvents';
import { MapPin, Calendar, Users, TrendingUp, Plus, Settings, CalendarPlus, UserPlus, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { isToday, isFuture } from 'date-fns';

export default function VenueOverview() {
  const { venueAccess, currentVenueId } = useMode();
  const currentVenue = venueAccess.find(v => v.venue_id === currentVenueId);
  const { courts, loading: courtsLoading } = useVenueCourts(currentVenueId);
  const { staff, loading: staffLoading } = useVenueStaff(currentVenueId);
  const { bookings, loading: bookingsLoading } = useVenueBookings(currentVenueId);
  const { events, loading: eventsLoading } = useVenueEvents(currentVenueId);
  const navigate = useNavigate();

  const activeCourts = courts.filter(c => c.is_active).length;
  const todayBookings = bookings.filter(b => isToday(new Date(b.start_time)) && b.status !== 'cancelled').length;
  const upcomingEvents = events.filter(e => isFuture(new Date(e.start_time)) && e.is_published).length;
  const loading = courtsLoading || staffLoading || bookingsLoading || eventsLoading;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{currentVenue?.venue_name || 'Venue Dashboard'}</h1>
        <p className="text-muted-foreground">Manage your venue operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/courts')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courts</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{activeCourts}</div>
            )}
            <p className="text-xs text-muted-foreground">Active courts</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/bookings')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bookings Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{todayBookings}</div>
            )}
            <p className="text-xs text-muted-foreground">Reservations</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/staff')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{staff.length}</div>
            )}
            <p className="text-xs text-muted-foreground">Team members</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/events')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{upcomingEvents}</div>
            )}
            <p className="text-xs text-muted-foreground">Published events</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/courts')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Court
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/events')}>
              <CalendarPlus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/staff')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Staff
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Venue Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${activeCourts > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {activeCourts > 0 ? '✓' : '1'}
              </div>
              <div>
                <p className={`font-medium ${activeCourts > 0 ? 'text-muted-foreground line-through' : ''}`}>Set up your courts</p>
                <p className="text-sm text-muted-foreground">Add courts with details and availability</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">2</div>
              <div>
                <p className="font-medium">Configure booking settings</p>
                <p className="text-sm text-muted-foreground">Set hours, pricing, and rules</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">3</div>
              <div>
                <p className="font-medium">Invite your team</p>
                <p className="text-sm text-muted-foreground">Add staff members to help manage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
