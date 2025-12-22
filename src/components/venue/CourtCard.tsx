import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Pencil, Trash2, MapPin } from 'lucide-react';
import { VenueCourt } from '@/hooks/useVenueCourts';

interface CourtCardProps {
  court: VenueCourt;
  onUpdate: (courtId: string, updates: Partial<VenueCourt>) => Promise<any>;
  onDelete: (courtId: string) => Promise<void>;
  onEdit: (court: VenueCourt) => void;
}

export function CourtCard({ court, onUpdate, onDelete, onEdit }: CourtCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleActive = async () => {
    await onUpdate(court.id, { is_active: !court.is_active });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(court.id);
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getSurfaceColor = (surface: string) => {
    switch (surface) {
      case 'indoor': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'outdoor': return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'covered': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <Card className={!court.is_active ? 'opacity-60' : ''}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{court.name}</h3>
              <p className="text-sm text-muted-foreground">Court #{court.court_number}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(court)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary" className={getSurfaceColor(court.surface_type)}>
              {court.surface_type}
            </Badge>
            {court.hourly_rate && (
              <Badge variant="outline">
                ${court.hourly_rate}/hr
              </Badge>
            )}
          </div>
          
          {court.notes && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {court.notes}
            </p>
          )}
          
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Active</span>
            <Switch 
              checked={court.is_active} 
              onCheckedChange={handleToggleActive}
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Court</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{court.name}"? This action cannot be undone
              and will remove all associated bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
