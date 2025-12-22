import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VenueCourts() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Courts</h1>
          <p className="text-muted-foreground">Manage your pickleball courts</p>
        </div>
        <Button>
          <MapPin className="h-4 w-4 mr-2" />
          Add Court
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No Courts Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Add your first court to start accepting bookings and hosting events.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
