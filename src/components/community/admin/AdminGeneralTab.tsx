import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type GroupType = 'crew' | 'league' | 'open_play' | 'tournament' | 'venue_official';

interface AdminGeneralTabProps {
  name: string;
  description: string;
  type: GroupType;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onTypeChange: (type: GroupType) => void;
}

const GROUP_TYPES: { value: GroupType; label: string; description: string }[] = [
  { value: 'crew', label: 'Crew', description: 'A tight-knit group of regular players' },
  { value: 'league', label: 'League', description: 'Organized competitive play' },
  { value: 'open_play', label: 'Open Play', description: 'Drop-in sessions open to all' },
  { value: 'tournament', label: 'Tournament', description: 'Tournament teams and brackets' },
  { value: 'venue_official', label: 'Venue Official', description: 'Official venue community' },
];

export function AdminGeneralTab({
  name,
  description,
  type,
  onNameChange,
  onDescriptionChange,
  onTypeChange,
}: AdminGeneralTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Update your group's name, description, and type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter group name"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">{name.length}/50 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What is this group about?"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{description.length}/500 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-type">Group Type</Label>
            <Select value={type} onValueChange={onTypeChange}>
              <SelectTrigger id="group-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex flex-col">
                      <span>{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
