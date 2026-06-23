import { useState } from 'react';
import { Users, Trophy, Calendar, Lock, Globe, Eye, UserPlus, ShieldCheck, Mail } from 'lucide-react';
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'crew' as Group['type'],
    visibility: 'unlisted' as Group['visibility'],
    join_method: 'open' as Group['join_method'],
  });

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

  const getStepDescription = () => {
    if (step === 1) return 'Choose what type of group you want to create';
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
              <Button onClick={() => setStep(2)}>Continue</Button>
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
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
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
                onValueChange={(value) => setFormData({ ...formData, join_method: value as Group['join_method'])}
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
