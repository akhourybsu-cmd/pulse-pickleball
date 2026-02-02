import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Shield,
  Search,
  Calendar,
  User,
  FileText,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  admin_profile?: {
    full_name: string;
    email: string;
  };
}

export default function AdminAuditLog() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("7d");

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, actionFilter, resourceFilter, dateFilter]);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("Please sign in to access admin features");
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      toast.error("Access denied: Admin privileges required");
      navigate("/player/dashboard");
      return;
    }

    setIsAdmin(true);
    await fetchLogs();
    setLoading(false);
  };

  const fetchLogs = async () => {
    const { data: logsData, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
      return;
    }

    if (!logsData || logsData.length === 0) {
      setLogs([]);
      return;
    }

    // Get unique admin user IDs
    const adminIds = Array.from(new Set(logsData.map(log => log.admin_user_id)));
    
    // Fetch profiles for these admins
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', adminIds);

    // Map profiles to logs
    const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    
    const enrichedLogs = logsData.map(log => ({
      ...log,
      admin_profile: profileMap.get(log.admin_user_id) || {
        full_name: 'Unknown Admin',
        email: ''
      }
    }));

    setLogs(enrichedLogs as any);
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      if (dateFilter === 'today') {
        filterDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === '7d') {
        filterDate.setDate(now.getDate() - 7);
      } else if (dateFilter === '30d') {
        filterDate.setDate(now.getDate() - 30);
      }

      filtered = filtered.filter(log => new Date(log.created_at) >= filterDate);
    }

    // Action filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Resource filter
    if (resourceFilter !== 'all') {
      filtered = filtered.filter(log => log.resource_type === resourceFilter);
    }

    // Search filter
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(term) ||
        log.resource_type.toLowerCase().includes(term) ||
        log.resource_id?.toLowerCase().includes(term) ||
        JSON.stringify(log.details).toLowerCase().includes(term) ||
        log.admin_profile?.full_name.toLowerCase().includes(term) ||
        log.admin_profile?.email.toLowerCase().includes(term)
      );
    }

    setFilteredLogs(filtered);
  };

  const getActionColor = (action: string): string => {
    if (action.includes('delete') || action.includes('void')) return 'destructive';
    if (action.includes('create') || action.includes('award')) return 'default';
    if (action.includes('update') || action.includes('edit')) return 'secondary';
    return 'outline';
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action))).sort();
  const uniqueResources = Array.from(new Set(logs.map(log => log.resource_type))).sort();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading audit logs...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Audit Log</h1>
          </div>
          <p className="text-muted-foreground">
            Complete history of all administrative actions in the system
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Resource type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  {uniqueResources.map(resource => (
                    <SelectItem key={resource} value={resource}>{resource}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} audit log entries
        </p>

        {/* Audit logs list */}
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getActionColor(log.action) as any}>
                        {log.action}
                      </Badge>
                      <Badge variant="outline">
                        <FileText className="w-3 h-3 mr-1" />
                        {log.resource_type}
                      </Badge>
                      {log.resource_id && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {log.resource_id.slice(0, 8)}...
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.admin_profile?.full_name || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </span>
                    </div>

                    {Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                        <pre className="whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No audit logs found matching your filters
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}