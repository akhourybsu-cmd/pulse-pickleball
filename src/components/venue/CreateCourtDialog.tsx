import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { CreateCourtData } from '@/hooks/useVenueCourts';

interface VenueTheme {
  primary: string;
  primaryForeground: string;
  secondary: string;
}

interface CreateCourtDialogProps {
  venueId: string;
  nextCourtNumber: number;
  onCreateCourt: (data: CreateCourtData) => Promise<any>;
  venueTheme?: VenueTheme;
}

export function CreateCourtDialog({ venueId, nextCourtNumber, onCreateCourt, venueTheme }: CreateCourtDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    court_number: nextCourtNumber,
    surface_type: 'indoor',
    hourly_rate: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onCreateCourt({
        venue_id: venueId,
        name: formData.name || `Court ${formData.court_number}`,
        court_number: formData.court_number,
        surface_type: formData.surface_type,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        notes: formData.notes || null,
      });
      setOpen(false);
      setFormData({
        name: '',
        court_number: nextCourtNumber + 1,
        surface_type: 'indoor',
        hourly_rate: '',
        notes: '',
      });
    } catch (error) {
      // Error handled in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          style={venueTheme ? { backgroundColor: venueTheme.primary } : undefined}
          className={venueTheme ? "hover:opacity-90" : ""}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Court
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Court</DialogTitle>
            <DialogDescription>
              Create a new court for your venue. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Court Name</Label>
              <Input
                id="name"
                placeholder={`Court ${formData.court_number}`}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="court_number">Court Number</Label>
                <Input
                  id="court_number"
                  type="number"
                  min={1}
                  value={formData.court_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, court_number: parseInt(e.target.value) || 1 }))}
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="surface_type">Surface Type</Label>
                <Select
                  value={formData.surface_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, surface_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="covered">Covered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
              <Input
                id="hourly_rate"
                type="number"
                min={0}
                step={0.01}
                placeholder="Optional"
                value={formData.hourly_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details about this court..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              style={venueTheme ? { backgroundColor: venueTheme.primary } : undefined}
              className={venueTheme ? "hover:opacity-90" : ""}
            >
              {loading ? 'Creating...' : 'Create Court'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
