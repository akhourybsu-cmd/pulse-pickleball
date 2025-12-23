import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMode } from '@/contexts/ModeContext';
import { useVenueBookings } from '@/hooks/useVenueBookings';
import { useVenueEvents } from '@/hooks/useVenueEvents';
import { useVenueCourts } from '@/hooks/useVenueCourts';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart3,
  Clock,
  Percent
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function VenueAnalytics() {
  const { currentVenueId } = useMode();
  const { bookings, loading: bookingsLoading } = useVenueBookings(currentVenueId);
  const { events, loading: eventsLoading } = useVenueEvents(currentVenueId);
  const { courts, loading: courtsLoading } = useVenueCourts(currentVenueId);
  
  const loading = bookingsLoading || eventsLoading || courtsLoading;
  const today = new Date();

  const metrics = useMemo(() => {
    const confirmedBookings = bookings.filter(b => b.status !== 'cancelled');
    
    // Revenue calculations
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
    
    const thisWeekStart = startOfWeek(today);
    const thisWeekEnd = endOfWeek(today);
    const weeklyRevenue = confirmedBookings
      .filter(b => isWithinInterval(new Date(b.start_time), { start: thisWeekStart, end: thisWeekEnd }))
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const monthlyRevenue = confirmedBookings
      .filter(b => isWithinInterval(new Date(b.start_time), { start: thisMonthStart, end: thisMonthEnd }))
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    // Booking counts
    const totalBookings = confirmedBookings.length;
    const weeklyBookings = confirmedBookings.filter(b => 
      isWithinInterval(new Date(b.start_time), { start: thisWeekStart, end: thisWeekEnd })
    ).length;
    const monthlyBookings = confirmedBookings.filter(b => 
      isWithinInterval(new Date(b.start_time), { start: thisMonthStart, end: thisMonthEnd })
    ).length;

    // Event metrics
    const publishedEvents = events.filter(e => e.is_published).length;
    const totalEventParticipants = events.reduce((sum, e) => sum + e.current_participants, 0);

    // Utilization - simplified calculation
    const activeCourts = courts.filter(c => c.is_active).length;
    // Assume 12 hours of availability per court per day
    const potentialHoursPerDay = activeCourts * 12;
    const last7Days = subDays(today, 7);
    const last7DaysBookings = confirmedBookings.filter(b => 
      new Date(b.start_time) >= last7Days
    );
    const bookedHours = last7DaysBookings.reduce((sum, b) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
    const utilization = potentialHoursPerDay > 0 
      ? Math.round((bookedHours / (potentialHoursPerDay * 7)) * 100)
      : 0;

    return {
      totalRevenue,
      weeklyRevenue,
      monthlyRevenue,
      totalBookings,
      weeklyBookings,
      monthlyBookings,
      publishedEvents,
      totalEventParticipants,
      utilization,
      activeCourts
    };
  }, [bookings, events, courts, today]);

  // Chart data - last 7 days bookings
  const dailyBookingsData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      const dayBookings = bookings.filter(b => 
        format(new Date(b.start_time), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
        b.status !== 'cancelled'
      );
      return {
        date: format(date, 'EEE'),
        bookings: dayBookings.length,
        revenue: dayBookings.reduce((sum, b) => sum + (b.total_price || 0), 0)
      };
    });
    return last7Days;
  }, [bookings, today]);

  // Court usage breakdown
  const courtUsageData = useMemo(() => {
    return courts.map(court => {
      const courtBookings = bookings.filter(b => b.court_id === court.id && b.status !== 'cancelled');
      return {
        name: court.name,
        bookings: courtBookings.length
      };
    }).filter(c => c.bookings > 0);
  }, [courts, bookings]);

  // Event type breakdown
  const eventTypeData = useMemo(() => {
    const typeCount: Record<string, number> = {};
    events.forEach(e => {
      typeCount[e.event_type] = (typeCount[e.event_type] || 0) + 1;
    });
    return Object.entries(typeCount).map(([name, value]) => ({ name, value }));
  }, [events]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Analytics
        </h1>
        <p className="text-muted-foreground">Track your venue performance</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.monthlyRevenue.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.weeklyRevenue.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">This week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.monthlyBookings}</div>
                <p className="text-xs text-muted-foreground">Reservations this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Court Utilization</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.utilization}%</div>
                <p className="text-xs text-muted-foreground">Last 7 days average</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.totalRevenue.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Courts</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.activeCourts}</div>
                <p className="text-xs text-muted-foreground">Available for booking</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Published Events</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.publishedEvents}</div>
                <p className="text-xs text-muted-foreground">Active events</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Event Participants</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalEventParticipants}</div>
                <p className="text-xs text-muted-foreground">Total registrations</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Bookings (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyBookingsData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))'
                      }}
                    />
                    <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Revenue (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailyBookingsData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(0)}`, 'Revenue']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {courtUsageData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Court Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={courtUsageData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={80} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                      />
                      <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {eventTypeData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Events by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={eventTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {eventTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
