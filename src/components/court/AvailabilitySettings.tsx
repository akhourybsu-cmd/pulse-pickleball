import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM to 8 PM

export function AvailabilitySettings() {
  const { toast } = useToast();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [newDay, setNewDay] = useState("1");
  const [newStart, setNewStart] = useState("18");
  const [newEnd, setNewEnd] = useState("20");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await (supabase as any)
      .from("user_availability")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (data) {
      setSlots(data);
    }
    setLoading(false);
  };

  const addSlot = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startTime = `${newStart.padStart(2, '0')}:00:00`;
    const endTime = `${newEnd.padStart(2, '0')}:00:00`;

    const { error } = await (supabase as any)
      .from("user_availability")
      .insert({
        user_id: user.id,
        day_of_week: parseInt(newDay),
        start_time: startTime,
        end_time: endTime,
      });

    if (error) {
      if (error.code === '23505') {
        toast({
          title: "Duplicate Slot",
          description: "This availability slot already exists",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add availability",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Added",
        description: "Availability slot added",
      });
      fetchAvailability();
    }
  };

  const removeSlot = async (id: string) => {
    const { error } = await (supabase as any)
      .from("user_availability")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove availability",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Removed",
        description: "Availability slot removed",
      });
      fetchAvailability();
    }
  };

  const formatTime = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${ampm}`;
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Availability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {slots.length > 0 ? (
            <div className="space-y-2">
              {slots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div>
                    <span className="font-medium">{DAYS[slot.day_of_week]}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSlot(slot.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No availability set. Add your typical playing times to get better recommendations.
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <Label className="mb-2 block">Add Availability</Label>
          <div className="grid grid-cols-4 gap-2">
            <Select value={newDay} onValueChange={setNewDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newStart} onValueChange={setNewStart}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {hour % 12 || 12}{hour >= 12 ? 'pm' : 'am'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newEnd} onValueChange={setNewEnd}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {hour % 12 || 12}{hour >= 12 ? 'pm' : 'am'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={addSlot} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
