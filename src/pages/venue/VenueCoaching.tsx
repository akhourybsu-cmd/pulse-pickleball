import { useMode } from '@/contexts/ModeContext';
import { useVenueCoaches } from '@/hooks/useVenueCoaches';
import { CreateCoachDialog } from '@/components/venue/CreateCoachDialog';
import { CoachCard } from '@/components/venue/CoachCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

export default function VenueCoaching() {
  const { currentVenueId } = useMode();
  const { coaches, loading, createCoach, deleteCoach, toggleActive } = useVenueCoaches(currentVenueId);

  if (!currentVenueId) {
    return <div className="p-6 text-center text-muted-foreground">No venue selected</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Coaching</h1>
          <p className="text-muted-foreground">Manage coaches and lessons</p>
        </div>
        <CreateCoachDialog onCreateCoach={createCoach} />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : coaches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No coaches yet</h3>
            <p className="text-muted-foreground text-sm">Add coaches to offer lessons at your venue</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coaches.map(coach => (
            <CoachCard
              key={coach.id}
              coach={coach}
              onToggleActive={toggleActive}
              onDelete={deleteCoach}
            />
          ))}
        </div>
      )}
    </div>
  );
}
