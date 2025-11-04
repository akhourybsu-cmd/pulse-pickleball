import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";

interface CalendarViewProps {
  facilityId: string;
  currentUserId: string | null;
}

export function CalendarView({ facilityId, currentUserId }: CalendarViewProps) {
  const [view, setView] = useState<"week" | "day">("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setView(view === "week" ? "day" : "week")}
          >
            <Calendar className="w-4 h-4" />
          </Button>
          <Select value={view} onValueChange={(v) => setView(v as "week" | "day")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="day">Day</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(view === "week" ? subWeeks(currentDate, 1) : addDays(currentDate, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {view === "week" 
              ? `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d, yyyy")}`
              : format(currentDate, "MMMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(view === "week" ? addWeeks(currentDate, 1) : addDays(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-6">
        <div className="text-center text-muted-foreground py-12">
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Calendar Coming Soon</p>
          <p className="text-sm mt-2">
            Week view showing time slots from 8 AM - 8 PM across Court 1 and Court 2
          </p>
        </div>
      </Card>
    </div>
  );
}
