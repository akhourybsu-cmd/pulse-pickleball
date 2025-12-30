import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Court {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
}

interface LocationStepProps {
  value: string;
  onChange: (value: string) => void;
}

export function LocationStep({ value, onChange }: LocationStepProps) {
  const [courts, setCourts] = useState<Court[]>([]);

  useEffect(() => {
    const fetchCourts = async () => {
      const { data } = await supabase.from("courts").select("*").order("name");
      if (data) setCourts(data);
    };
    fetchCourts();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Where are you playing?</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Select a court location (optional)
      </p>

      <div className="flex-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted">
            <MapPin className="h-5 w-5" />
          </div>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="flex-1 h-14">
              <SelectValue placeholder="Select a court" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific location</SelectItem>
              {courts.map((court) => (
                <SelectItem key={court.id} value={court.id}>
                  {court.name} - {court.city}, {court.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
