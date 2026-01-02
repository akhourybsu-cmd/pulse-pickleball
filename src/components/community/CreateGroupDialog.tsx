import { useState, useEffect } from 'react';
import { Users, Trophy, Calendar, Building, Medal, Lock, Globe, Eye, UserPlus, ShieldCheck, Mail, MapPin, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useUserVenues, type UserVenue } from '@/hooks/useUserVenues';
import type { Group } from '@/hooks/useGroups';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    type: Group['type'];
    visibility: Group['visibility'];
    join_method: Group['join_method'];
    venue_id?: string;
  }) => Promise<Group | null>;
}

const groupTypes = [
  { value: 'crew', label: 'Crew', description: 'Friends & recurring group', icon: Users },
  { value: 'league', label: 'League', description: 'Competitive play', icon: Trophy },
  { value: 'open_play', label: 'Open Play', description: 'Casual sessions', icon: Calendar },
  { value: 'venue_official', label: 'Venue Official', description: 'Official venue group', icon: Building },
  { value: 'tournament', label: 'Tournament', description: 'Event series', icon: Medal },
] as const;

const visibilityOptions = [
  { value: 'public', label: 'Public', description: 'Anyone can find and view', icon: Globe },
  { value: 'unlisted', label: 'Unlisted', description: 'Only join via code/link', icon: Eye },
  { value: 'private', label: 'Private', description: 'Hidden, invite only', icon: Lock },
] as const;

const joinOptions = [
  { value: 'open', label: 'Open', description: 'Anyone can join instantly', icon: UserPlus },
  { value: 'request_to_join', label: 'Request to Join', description: 'Requires admin approval', icon: ShieldCheck },
  { value: 'invite_only', label: 'Invite Only', description: 'Manual invitations only', icon: Mail },
] as const;

export function CreateGroupDialog({ open, onOpenChange, onSubmit }: CreateGroupDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { venues, loading: venuesLoading } = useUserVenues();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'crew' as Group['type'],
    visibility: 'unlisted' as Group['visibility'],
    join_method: 'open' as Group['join_method'],
    venue_id: undefined as string | undefined,
  });

  // Reset venue_id when type changes away from venue_official
  useEffect(() => {
    if (formData.type !== 'venue_official' && formData.venue_id) {
      setFormData(prev => ({ ...prev, venue_id: undefined }));
    }
  }, [formData.type]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    setLoading(true);
    const result = await onSubmit(formData);
    setLoading(false);
    
    if (result) {
      onOpenChange(false);
      // Reset form
      setStep(1);
      setFormData({
        name: '',
        description: '',
        type: 'crew',
        visibility: 'unlisted',
        join_method: 'open',
        venue_id: undefined,
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
  };

  const handleTypeSelect = (type: Group['type']) => {
    setFormData({ ...formData, type });
  };

  const handleContinueFromType = () => {
    if (formData.type === 'venue_official') {
      setStep(1.5); // Venue selection step
    } else {
      setStep(2);
    }
  };

  const handleVenueSelect = (venue: UserVenue) => {
    setFormData({
      ...formData,
      venue_id: venue.id,
      name: formData.name || `${venue.name} Official`,
    });
    setStep(2);
  };

  const getStepDescription = () => {
    if (step === 1) return 'Choose what type of group you want to create';
    if (step === 1.5) return 'Select a venue you manage';
    if (step === 2) return 'Set up your group details';
    if (step === 3) return 'Configure privacy and access';
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Group Type */}
        {step === 1 && (
          <div className="space-y-4">
            <RadioGroup
              value={formData.type}
              onValueChange={(value) => handleTypeSelect(value as Group['type'])}
              className="grid gap-3"
            >
              {groupTypes.map((type) => (
                <Label
                  key={type.value}
                  htmlFor={type.value}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors',
                    formData.type === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <RadioGroupItem value={type.value} id={type.value} className="sr-only" />
                  <type.icon className={cn(
                    'h-6 w-6',
                    formData.type === type.value ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <div className="flex-1">
                    <div className="font-medium">{type.label}</div>
                    <div className="text-sm text-muted-foreground">{type.description}</div>
                  </div>
                </Label>
              ))}
            </RadioGroup>

            <div className="flex justify-end pt-4">
              <Button onClick={handleContinueFromType}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 1.5: Venue Selection (only for venue_official) */}
        {step === 1.5 && (
          <div className="space-y-4">
            {venuesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : venues.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <Building className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium text-foreground">No Venues Available</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You need to be a venue owner or manager to create an official venue group.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select a venue to create an official group for:
                </p>
                {venues.map((venue) => (
                  <button
                    key={venue.id}
                    type="button"
                    onClick={() => handleVenueSelect(venue)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-colors',
                      'border-border hover:bg-muted/50 hover:border-primary/50'
                    )}
                  >
                    {venue.logo_url ? (
                      <img
                        src={venue.logo_url}
                        alt={venue.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{venue.name}</div>
                      {(venue.city || venue.state) && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {[venue.city, venue.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{venue.role}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              {venues.length === 0 && (
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Group Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                placeholder="Friday Night Crew"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Tell people what this group is about..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(formData.type === 'venue_official' ? 1.5 : 1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!formData.name.trim()}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Privacy & Access */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Visibility</Label>
              <RadioGroup
                value={formData.visibility}
                onValueChange={(value) => {
                  const visibility = value as Group['visibility'];
                  // Auto-adjust join method based on visibility
                  let join_method = formData.join_method;
                  if (visibility === 'private' && join_method === 'open') {
                    join_method = 'request_to_join';
                  }
                  setFormData({ ...formData, visibility, join_method });
                }}
                className="grid gap-2"
              >
                {visibilityOptions.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`visibility-${option.value}`}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      formData.visibility === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={option.value} id={`visibility-${option.value}`} className="sr-only" />
                    <option.icon className={cn(
                      'h-5 w-5',
                      formData.visibility === option.value ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Join Method</Label>
              <RadioGroup
                value={formData.join_method}
                onValueChange={(value) => setFormData({ ...formData, join_method: value as Group['join_method'] })}
                className="grid gap-2"
              >
                {joinOptions.map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`join-${option.value}`}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      formData.join_method === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={option.value} id={`join-${option.value}`} className="sr-only" />
                    <option.icon className={cn(
                      'h-5 w-5',
                      formData.join_method === option.value ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading || !formData.name.trim()}>
                {loading ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
