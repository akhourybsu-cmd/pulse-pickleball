import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VenueEvents() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">Create and manage venue events</p>
        </div>
        <Button>
          <CalendarDays className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Events Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Create your first event to start attracting players to your venue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
