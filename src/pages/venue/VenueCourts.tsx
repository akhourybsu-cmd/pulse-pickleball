import { useState } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueCourts, VenueCourt } from '@/hooks/useVenueCourts';
import { useVenueTheme } from '@/components/layout/VenueShell';
import { CreateCourtDialog } from '@/components/venue/CreateCourtDialog';
import { CourtCard } from '@/components/venue/CourtCard';
import { EditCourtDialog } from '@/components/venue/EditCourtDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';

export default function VenueCourts() {
  const { currentVenueId } = useMode();
  const { courts, loading, createCourt, updateCourt, deleteCourt } = useVenueCourts(currentVenueId);
  const venueTheme = useVenueTheme();
  const [editingCourt, setEditingCourt] = useState<VenueCourt | null>(null);

  const nextCourtNumber = courts.length > 0 
    ? Math.max(...courts.map(c => c.court_number)) + 1 
    : 1;

  if (!currentVenueId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No venue selected. Please select a venue from the mode switcher.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Courts</h1>
          <p className="text-muted-foreground">
            Manage your venue's courts and availability
          </p>
        </div>
        <CreateCourtDialog
          venueId={currentVenueId}
          nextCourtNumber={nextCourtNumber}
          onCreateCourt={createCourt}
          venueTheme={venueTheme}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : courts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">No courts yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first court to start managing bookings and events.
            </p>
            <CreateCourtDialog
              venueId={currentVenueId}
              nextCourtNumber={1}
              onCreateCourt={createCourt}
              venueTheme={venueTheme}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              onUpdate={updateCourt}
              onDelete={deleteCourt}
              onEdit={setEditingCourt}
            />
          ))}
        </div>
      )}

      <EditCourtDialog
        court={editingCourt}
        open={!!editingCourt}
        onOpenChange={(open) => !open && setEditingCourt(null)}
        onUpdateCourt={updateCourt}
      />
    </div>
  );
}
