import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { VenueCourt } from '@/hooks/useVenueCourts';

interface EditCourtDialogProps {
  court: VenueCourt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateCourt: (courtId: string, updates: Partial<VenueCourt>) => Promise<any>;
}

export function EditCourtDialog({ court, open, onOpenChange, onUpdateCourt }: EditCourtDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    court_number: 1,
    surface_type: 'indoor',
    hourly_rate: '',
    notes: '',
  });

  useEffect(() => {
    if (court) {
      setFormData({
        name: court.name,
        court_number: court.court_number,
        surface_type: court.surface_type,
        hourly_rate: court.hourly_rate?.toString() || '',
        notes: court.notes || '',
      });
    }
  }, [court]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!court) return;
    
    setLoading(true);

    try {
      await onUpdateCourt(court.id, {
        name: formData.name,
        court_number: formData.court_number,
        surface_type: formData.surface_type,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        notes: formData.notes || null,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Court</DialogTitle>
            <DialogDescription>
              Update the details for this court.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Court Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-court_number">Court Number</Label>
                <Input
                  id="edit-court_number"
                  type="number"
                  min={1}
                  value={formData.court_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, court_number: parseInt(e.target.value) || 1 }))}
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-surface_type">Surface Type</Label>
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
              <Label htmlFor="edit-hourly_rate">Hourly Rate ($)</Label>
              <Input
                id="edit-hourly_rate"
                type="number"
                min={0}
                step={0.01}
                placeholder="Optional"
                value={formData.hourly_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Any additional details about this court..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
