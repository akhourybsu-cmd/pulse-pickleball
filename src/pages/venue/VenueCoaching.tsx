import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VenueCoaching() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Coaching</h1>
          <p className="text-muted-foreground">Manage coaching programs and instructors</p>
        </div>
        <Button>
          <GraduationCap className="h-4 w-4 mr-2" />
          Add Coach
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coaching Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature is under development. Soon you'll be able to manage coaches, 
            lessons, and clinics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
