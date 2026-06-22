import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInYears } from "date-fns";

interface TournamentInfoTabProps {
  formData: {
    phone_number: string | null;
    date_of_birth: string | null;
    gender: string | null;
    skill_level_self: string | null;
  };
  onFormChange: (updates: Partial<TournamentInfoTabProps['formData']>) => void;
}

export function TournamentInfoTab({
  formData,
  onFormChange,
}: TournamentInfoTabProps) {
  // Calculate age if date of birth is provided
  const age = formData.date_of_birth 
    ? differenceInYears(new Date(), new Date(formData.date_of_birth))
    : null;

  return (
    <div className="space-y-6">
      {/* Tournament Readiness Overview */}
      <TournamentReadinessCard completeness={completeness} />

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Required for tournament communications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number *</Label>
            <Input
              id="phone_number"
              type="tel"
              value={formData.phone_number || ""}
              onChange={(e) => onFormChange({ phone_number: e.target.value })}
              placeholder="(555) 123-4567"
            />
            <p className="text-xs text-muted-foreground">Used for tournament communications and match updates</p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Details */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>Information used for tournament division eligibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth || ""}
                onChange={(e) => onFormChange({ date_of_birth: e.target.value })}
              />
              {age !== null && (
                <p className="text-xs text-muted-foreground">
                  Age: {age} years old
                </p>
              )}
              <p className="text-xs text-amber-600 dark:text-amber-500">Required for age-restricted divisions</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender || ""}
                onValueChange={(value) => onFormChange({ gender: value })}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non_binary">Non-Binary</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer Not to Say</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-amber-600 dark:text-amber-500">Required for gender-specific divisions</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shirt_size">Shirt Size</Label>
            <Select
              value={formData.shirt_size || ""}
              onValueChange={(value) => onFormChange({ shirt_size: value })}
            >
              <SelectTrigger id="shirt_size">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="XS">XS</SelectItem>
                <SelectItem value="S">S</SelectItem>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="L">L</SelectItem>
                <SelectItem value="XL">XL</SelectItem>
                <SelectItem value="XXL">XXL</SelectItem>
                <SelectItem value="2XL">2XL</SelectItem>
                <SelectItem value="3XL">3XL</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">For tournament merchandise</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill_level_self">Self-Assessed Skill Level</Label>
            <Select
              value={formData.skill_level_self || ""}
              onValueChange={(value) => onFormChange({ skill_level_self: value })}
            >
              <SelectTrigger id="skill_level_self">
                <SelectValue placeholder="Select your skill level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner (2.0-2.5)</SelectItem>
                <SelectItem value="intermediate">Intermediate (3.0-3.5)</SelectItem>
                <SelectItem value="advanced">Advanced (4.0-4.5)</SelectItem>
                <SelectItem value="semi_pro">Semi-Pro (5.0)</SelectItem>
                <SelectItem value="pro">Pro (5.5+)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Your honest assessment helps with fair tournament matchmaking</p>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Contact</CardTitle>
          <CardDescription>Required by many tournaments for safety</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
              <Input
                id="emergency_contact_name"
                value={formData.emergency_contact_name || ""}
                onChange={(e) => onFormChange({ emergency_contact_name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
              <Input
                id="emergency_contact_phone"
                type="tel"
                value={formData.emergency_contact_phone || ""}
                onChange={(e) => onFormChange({ emergency_contact_phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500">Many tournaments require emergency contact information</p>
        </CardContent>
      </Card>
    </div>
  );
}
