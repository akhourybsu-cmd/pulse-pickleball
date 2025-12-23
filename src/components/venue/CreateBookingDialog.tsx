import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { CreateBookingData } from '@/hooks/useVenueBookings';
import { VenueCourt } from '@/hooks/useVenueCourts';

interface CreateBookingDialogProps {
  courts: VenueCourt[];
  onCreateBooking: (data: CreateBookingData) => Promise<any>;
}

export function CreateBookingDialog({ courts, onCreateBooking }: CreateBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    court_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    start_time: '',
    end_time: '',
    notes: '',
    total_price: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.court_id || !formData.customer_name || !formData.start_time || !formData.end_time) return;

    setLoading(true);
    const result = await onCreateBooking({
      court_id: formData.court_id,
      customer_name: formData.customer_name,
      customer_email: formData.customer_email || undefined,
      customer_phone: formData.customer_phone || undefined,
      start_time: formData.start_time,
      end_time: formData.end_time,
      notes: formData.notes || undefined,
      total_price: formData.total_price ? parseFloat(formData.total_price) : undefined
    });

    setLoading(false);
    if (result) {
      setOpen(false);
      setFormData({
        court_id: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        start_time: '',
        end_time: '',
        notes: '',
        total_price: ''
      });
    }
  };

  const activeCourts = courts.filter(c => c.is_active);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Booking</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="court">Court *</Label>
            <Select
              value={formData.court_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, court_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a court" />
              </SelectTrigger>
              <SelectContent>
                {activeCourts.map(court => (
                  <SelectItem key={court.id} value={court.id}>
                    {court.name} (Court {court.court_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              placeholder="John Smith"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_email">Email</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                placeholder="john@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input
                id="customer_phone"
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total_price">Total Price ($)</Label>
            <Input
              id="total_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.total_price}
              onChange={(e) => setFormData(prev => ({ ...prev, total_price: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special requests..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.court_id || !formData.customer_name}>
              {loading ? 'Creating...' : 'Create Booking'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
