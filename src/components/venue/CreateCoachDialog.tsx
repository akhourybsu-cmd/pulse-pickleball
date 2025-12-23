import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CreateCoachData } from '@/hooks/useVenueCoaches';

interface CreateCoachDialogProps {
  onCreateCoach: (data: CreateCoachData) => Promise<any>;
}

const SPECIALTY_SUGGESTIONS = [
  'Beginner Lessons',
  'Advanced Strategy',
  'Doubles Play',
  'Singles Play',
  'Tournament Prep',
  'Kids Classes',
  'Fitness & Footwork',
  'Mental Game'
];

export function CreateCoachDialog({ onCreateCoach }: CreateCoachDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    specialties: [] as string[],
    hourly_rate: ''
  });
  const [newSpecialty, setNewSpecialty] = useState('');

  const handleAddSpecialty = (specialty: string) => {
    if (specialty && !formData.specialties.includes(specialty)) {
      setFormData(prev => ({
        ...prev,
        specialties: [...prev.specialties, specialty]
      }));
    }
    setNewSpecialty('');
  };

  const handleRemoveSpecialty = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.filter(s => s !== specialty)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setLoading(true);
    const result = await onCreateCoach({
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      bio: formData.bio || undefined,
      specialties: formData.specialties.length > 0 ? formData.specialties : undefined,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : undefined
    });

    setLoading(false);
    if (result) {
      setOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        bio: '',
        specialties: [],
        hourly_rate: ''
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Coach
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Coach</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Coach Name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="coach@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
            <Input
              id="hourly_rate"
              type="number"
              step="0.01"
              min="0"
              value={formData.hourly_rate}
              onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
              placeholder="75.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Tell us about this coach..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Specialties</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {formData.specialties.map(specialty => (
                <Badge key={specialty} variant="secondary" className="gap-1">
                  {specialty}
                  <button
                    type="button"
                    onClick={() => handleRemoveSpecialty(specialty)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSpecialty(newSpecialty);
                  }
                }}
                placeholder="Add specialty..."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddSpecialty(newSpecialty)}
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {SPECIALTY_SUGGESTIONS.filter(s => !formData.specialties.includes(s)).slice(0, 4).map(suggestion => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => handleAddSpecialty(suggestion)}
                >
                  + {suggestion}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Adding...' : 'Add Coach'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
