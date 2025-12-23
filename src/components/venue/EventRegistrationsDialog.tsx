import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, CheckCircle, Clock, XCircle, Mail, Phone, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Registration {
  id: string;
  user_id: string;
  status: string;
  registered_at: string;
  notes: string | null;
  profile: {
    full_name: string;
    display_name: string | null;
    email: string;
    phone_number: string | null;
    avatar_url: string | null;
  } | null;
}

interface EventRegistrationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
}

export function EventRegistrationsDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle
}: EventRegistrationsDialogProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open && eventId) {
      fetchRegistrations();
    }
  }, [open, eventId]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      // First get registrations
      const { data: regsData, error: regsError } = await supabase
        .from('venue_event_registrations')
        .select('id, user_id, status, registered_at, notes')
        .eq('event_id', eventId)
        .order('registered_at', { ascending: true });

      if (regsError) throw regsError;

      // Then get profiles for all user_ids
      const userIds = (regsData || []).map(r => r.user_id);
      let profilesMap: Record<string, Registration['profile']> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, display_name, email, phone_number, avatar_url')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.id] = {
              full_name: p.full_name,
              display_name: p.display_name,
              email: p.email,
              phone_number: p.phone_number,
              avatar_url: p.avatar_url
            };
            return acc;
          }, {} as Record<string, Registration['profile']>);
        }
      }
      
      const formattedData = (regsData || []).map(reg => ({
        ...reg,
        profile: profilesMap[reg.user_id] || null
      }));
      
      setRegistrations(formattedData);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Registered
          </Badge>
        );
      case 'waitlisted':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Waitlisted
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch = searchQuery
      ? (reg.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         reg.profile?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         reg.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    
    const matchesStatus = filterStatus ? reg.status === filterStatus : true;
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: registrations.length,
    registered: registrations.filter(r => r.status === 'registered').length,
    waitlisted: registrations.filter(r => r.status === 'waitlisted').length,
    cancelled: registrations.filter(r => r.status === 'cancelled').length
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Registrations for {eventTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              <Button
                variant={filterStatus === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(null)}
              >
                All ({statusCounts.all})
              </Button>
              <Button
                variant={filterStatus === 'registered' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('registered')}
              >
                Registered ({statusCounts.registered})
              </Button>
              <Button
                variant={filterStatus === 'waitlisted' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('waitlisted')}
              >
                Waitlist ({statusCounts.waitlisted})
              </Button>
            </div>
          </div>

          {/* Registrations List */}
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{searchQuery || filterStatus ? 'No matching registrations' : 'No registrations yet'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRegistrations.map((reg, index) => (
                  <div
                    key={reg.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-center w-6 text-sm text-muted-foreground">
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={reg.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {reg.profile?.full_name ? getInitials(reg.profile.full_name) : '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {reg.profile?.display_name || reg.profile?.full_name || 'Unknown'}
                        </p>
                        {getStatusBadge(reg.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {reg.profile?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {reg.profile.email}
                          </span>
                        )}
                        {reg.profile?.phone_number && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {reg.profile.phone_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {format(new Date(reg.registered_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
