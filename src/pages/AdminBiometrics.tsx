import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Fingerprint, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface AnalyticsData {
  totalUsers: number;
  enabledUsers: number;
  adoptionRate: number;
  totalAttempts: number;
  successfulLogins: number;
  failedLogins: number;
  successRate: number;
  errorBreakdown: { type: string; count: number }[];
  dailyActivity: { date: string; attempts: number; successes: number; failures: number }[];
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4'];

export default function AdminBiometrics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      if (!(await isPlatformAdmin(user.id))) {
        navigate('/player/dashboard');
        return;
      }

      setIsAdmin(true);
      await fetchAnalytics();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/player/dashboard');
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Get total users and enabled users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: enabledUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('biometric_enabled', true);

      // Get all analytics events
      const { data: events } = await supabase
        .from('biometric_analytics')
        .select('*')
        .order('created_at', { ascending: false });

      if (!events) {
        setAnalytics(null);
        return;
      }

      // Calculate metrics
      const loginAttempts = events.filter(e => e.event_type === 'login_attempt').length;
      const successfulLogins = events.filter(e => e.event_type === 'login_success').length;
      const failedLogins = events.filter(e => e.event_type === 'login_failed').length;

      // Error breakdown
      const errorCounts: Record<string, number> = {};
      events
        .filter(e => e.error_type)
        .forEach(e => {
          const type = e.error_type || 'unknown';
          errorCounts[type] = (errorCounts[type] || 0) + 1;
        });

      const errorBreakdown = Object.entries(errorCounts).map(([type, count]) => ({
        type: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count,
      }));

      // Daily activity (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const dailyActivity = last7Days.map(date => {
        const dayEvents = events.filter(e => e.created_at.startsWith(date));
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          attempts: dayEvents.filter(e => e.event_type === 'login_attempt').length,
          successes: dayEvents.filter(e => e.event_type === 'login_success').length,
          failures: dayEvents.filter(e => e.event_type === 'login_failed').length,
        };
      });

      setAnalytics({
        totalUsers: totalUsers || 0,
        enabledUsers: enabledUsers || 0,
        adoptionRate: totalUsers ? ((enabledUsers || 0) / totalUsers) * 100 : 0,
        totalAttempts: loginAttempts,
        successfulLogins,
        failedLogins,
        successRate: loginAttempts ? (successfulLogins / loginAttempts) * 100 : 0,
        errorBreakdown,
        dailyActivity,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="border-b bg-secondary p-6">
          <div className="container mx-auto">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">Biometric Analytics</h1>
                <p className="text-sm text-muted-foreground">Track biometric authentication usage and performance</p>
              </div>
            </div>
          </div>
        </nav>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary p-6">
        <div className="container mx-auto">
          <div className="flex items-center gap-3">
            <Fingerprint className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Biometric Analytics</h1>
              <p className="text-sm text-muted-foreground">Track biometric authentication usage and performance</p>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto p-6 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin Dashboard
        </Button>

        {!analytics && (
          <Alert>
            <AlertDescription>
              No biometric analytics data available yet.
            </AlertDescription>
          </Alert>
        )}

        {analytics && (
          <>
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Adoption Rate</CardTitle>
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.adoptionRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.enabledUsers} of {analytics.totalUsers} users
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.successRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.successfulLogins} of {analytics.totalAttempts} attempts
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalAttempts}</div>
                  <p className="text-xs text-muted-foreground">
                    All login attempts
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.failedLogins}</div>
                  <p className="text-xs text-muted-foreground">
                    Unsuccessful attempts
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Daily Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity (Last 7 Days)</CardTitle>
                <CardDescription>
                  Track biometric login attempts, successes, and failures over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="attempts" fill="hsl(var(--primary))" name="Attempts" />
                    <Bar dataKey="successes" fill="hsl(var(--chart-2))" name="Successes" />
                    <Bar dataKey="failures" fill="hsl(var(--destructive))" name="Failures" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Error Breakdown */}
            {analytics.errorBreakdown.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Error Distribution</CardTitle>
                    <CardDescription>
                      Most common error types encountered
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.errorBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {analytics.errorBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Error Details</CardTitle>
                    <CardDescription>
                      Breakdown of error occurrences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.errorBreakdown.map((error, index) => (
                        <div key={error.type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm font-medium">{error.type}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{error.count} occurrences</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
