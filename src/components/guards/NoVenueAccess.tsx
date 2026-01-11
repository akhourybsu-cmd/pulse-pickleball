import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface NoVenueAccessProps {
  venueId?: string;
  venueName?: string;
}

/**
 * NoVenueAccess - Clear "No Access" state for venue routes
 * when user lacks permission to manage the venue.
 */
export function NoVenueAccess({ venueId, venueName }: NoVenueAccessProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <ShieldAlert className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Access Required</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        You don't have permission to manage {venueName ? `"${venueName}"` : 'this venue'}. 
        Contact the venue owner to request access.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          variant="outline" 
          onClick={() => navigate('/player/dashboard')}
        >
          Go to Dashboard
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => navigate('/player/find')}
        >
          Browse Events
        </Button>
      </div>
    </div>
  );
}
