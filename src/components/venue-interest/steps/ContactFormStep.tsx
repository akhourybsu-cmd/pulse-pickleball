import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContactFormStepProps {
  venueName: string;
  contactName: string;
  email: string;
  city: string;
  state: string;
  additionalNotes: string;
  onChange: (field: string, value: string) => void;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export function ContactFormStep({
  venueName,
  contactName,
  email,
  city,
  state,
  additionalNotes,
  onChange,
}: ContactFormStepProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">You're almost there</h2>
        <p className="text-muted-foreground">Just a few details so we can get you set up</p>
      </div>

      <div className="flex-1 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="venueName">Venue / Organization Name</Label>
          <Input
            id="venueName"
            value={venueName}
            onChange={(e) => onChange("venueName", e.target.value)}
            placeholder="e.g., Sunset Recreation Center"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => onChange("contactName", e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => onChange("city", e.target.value)}
              placeholder="City"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select value={state} onValueChange={(v) => onChange("state", v)}>
              <SelectTrigger id="state">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Anything you'd like us to know? (optional)</Label>
          <Textarea
            id="notes"
            value={additionalNotes}
            onChange={(e) => onChange("additionalNotes", e.target.value)}
            placeholder="Tell us more about your venue or goals..."
            className="min-h-[80px]"
          />
        </div>
      </div>
    </div>
  );
}
