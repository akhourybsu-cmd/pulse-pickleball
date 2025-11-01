import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface RegistrationFormData {
  shirtSizeCaptain: string;
  shirtSizePartner: string;
  emergencyContact: string;
  emergencyPhone: string;
  waiverAccepted: boolean;
  hasPartner: boolean;
}

interface RegistrationStepAdditionalInfoProps {
  formData: RegistrationFormData;
  onUpdate: (updates: Partial<RegistrationFormData>) => void;
}

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function RegistrationStepAdditionalInfo({
  formData,
  onUpdate,
}: RegistrationStepAdditionalInfoProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Additional Information</h3>
        <p className="text-sm text-muted-foreground">
          Provide some additional details for the tournament
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="shirtSizeCaptain">Your Shirt Size</Label>
            <Select
              value={formData.shirtSizeCaptain}
              onValueChange={(value) => onUpdate({ shirtSizeCaptain: value })}
            >
              <SelectTrigger id="shirtSizeCaptain" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIRT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.hasPartner && (
            <div>
              <Label htmlFor="shirtSizePartner">Partner's Shirt Size</Label>
              <Select
                value={formData.shirtSizePartner}
                onValueChange={(value) => onUpdate({ shirtSizePartner: value })}
              >
                <SelectTrigger id="shirtSizePartner" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIRT_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
          <Input
            id="emergencyContact"
            placeholder="Full name"
            value={formData.emergencyContact}
            onChange={(e) => onUpdate({ emergencyContact: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
          <Input
            id="emergencyPhone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.emergencyPhone}
            onChange={(e) => onUpdate({ emergencyPhone: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="waiver"
              checked={formData.waiverAccepted}
              onCheckedChange={(checked) => 
                onUpdate({ waiverAccepted: checked as boolean })
              }
              className="mt-1"
            />
            <div className="space-y-1">
              <Label htmlFor="waiver" className="cursor-pointer font-medium">
                I accept the waiver and terms
              </Label>
              <p className="text-sm text-muted-foreground">
                By checking this box, I acknowledge that I have read and agree to the tournament
                waiver, rules, and code of conduct. I understand that pickleball involves physical
                activity and I participate at my own risk.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
