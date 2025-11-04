import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { addDays, addWeeks, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: Date;
  defaultHour?: number;
  defaultCourt?: number;
  onSubmit: (eventData: any) => void;
  facilityId: string;
}

export function CreateEventDialog({ 
  isOpen, 
  onClose, 
  defaultDate, 
  defaultHour = 8, 
  defaultCourt = 1,
  onSubmit,
  facilityId 
}: CreateEventDialogProps) {
  const [eventType, setEventType] = useState<"league" | "open_play" | "private" | "lesson">("open_play");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [price, setPrice] = useState("0");
  const [instructor, setInstructor] = useState("");
  const [skillLevel, setSkillLevel] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");
  const [selectedCourts, setSelectedCourts] = useState<"1" | "2" | "all">("1");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  
  // League recurring options
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [recurringWeeks, setRecurringWeeks] = useState("8");
  
  // Private rental status
  const [rentalStatus, setRentalStatus] = useState<"available" | "reserved">("available");

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setCapacity("8");
      setPrice("0");
      setInstructor("");
      setSkillLevel("all");
      setIsRecurring(false);
      setSelectedDates([]);
      setRecurringWeeks("8");
      setRentalStatus("available");
      
      if (defaultDate) {
        setSelectedDate(defaultDate);
      }
      if (defaultHour !== undefined) {
        setStartTime(format(new Date().setHours(defaultHour, 0), "HH:mm"));
        setEndTime(format(new Date().setHours(defaultHour + 1, 0), "HH:mm"));
      }
      if (defaultCourt !== undefined) {
        setSelectedCourts(defaultCourt.toString() as "1" | "2");
      }
    }
  }, [isOpen, defaultDate, defaultHour, defaultCourt]);

  const handleSubmit = () => {
    if (!startTime || !endTime) {
      return;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Determine which dates to create events for
    let datesToCreate: Date[] = [];
    
    if (eventType === "league" && isRecurring && selectedDate) {
      // Generate recurring dates
      const weeks = parseInt(recurringWeeks);
      for (let i = 0; i < weeks; i++) {
        datesToCreate.push(addWeeks(selectedDate, i));
      }
    } else if (eventType === "league" && selectedDates.length > 0) {
      // Use manually selected dates
      datesToCreate = [...selectedDates];
    } else if (selectedDate) {
      // Single date
      datesToCreate = [selectedDate];
    } else {
      return;
    }

    // Create events for each date
    datesToCreate.forEach(date => {
      const startDateTime = new Date(date);
      startDateTime.setHours(startHour, startMinute, 0, 0);
      
      const endDateTime = new Date(date);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      const baseEventData = {
        facility_id: facilityId,
        event_type: eventType,
        title,
        description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        capacity: eventType === "private" ? null : parseInt(capacity),
        price: parseFloat(price),
        instructor: eventType === "lesson" ? instructor : null,
        skill_level: skillLevel,
        current_registrations: 0,
        rental_status: eventType === "private" ? rentalStatus : null,
      };

      // If "all courts" is selected, create events for both courts
      if (selectedCourts === "all") {
        const eventsToCreate = [
          { ...baseEventData, court_number: 1 },
          { ...baseEventData, court_number: 2 },
        ];
        eventsToCreate.forEach(eventData => onSubmit(eventData));
      } else {
        onSubmit({ ...baseEventData, court_number: parseInt(selectedCourts) });
      }
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={(v: any) => setEventType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_play">Open Play</SelectItem>
                <SelectItem value="private">Private Rental</SelectItem>
                <SelectItem value="lesson">Lesson</SelectItem>
                <SelectItem value="league">League</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Title</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning Open Play"
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event details..."
              rows={3}
            />
          </div>

          {eventType === "league" && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <Label>Recurring League</Label>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>
              
              {isRecurring ? (
                <>
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : <span>Pick start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Number of Weeks</Label>
                    <Input 
                      type="number" 
                      value={recurringWeeks} 
                      onChange={(e) => setRecurringWeeks(e.target.value)}
                      min="1"
                      max="52"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <Label>Select Dates</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          selectedDates.length === 0 && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDates.length > 0 
                          ? `${selectedDates.length} dates selected` 
                          : <span>Pick dates</span>
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={(dates) => setSelectedDates(dates || [])}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}

          {eventType !== "league" && (
            <div>
              <Label>Event Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time</Label>
              <Input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>End Time</Label>
              <Input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Court</Label>
            <Select value={selectedCourts} onValueChange={(v: any) => setSelectedCourts(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Court 1</SelectItem>
                <SelectItem value="2">Court 2</SelectItem>
                <SelectItem value="all">All Courts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {eventType !== "private" && (
            <>
              <div>
                <Label>Capacity</Label>
                <Input 
                  type="number" 
                  value={capacity} 
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>

              <div>
                <Label>Skill Level</Label>
                <Select value={skillLevel} onValueChange={(v: any) => setSkillLevel(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label>Price ($)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={price} 
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {eventType === "lesson" && (
            <div>
              <Label>Instructor Name</Label>
              <Input 
                value={instructor} 
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="e.g., Coach Sarah"
              />
            </div>
          )}

          {eventType === "private" && (
            <div>
              <Label>Rental Status</Label>
              <Select value={rentalStatus} onValueChange={(v: any) => setRentalStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available for Rent</SelectItem>
                  <SelectItem value="reserved">Reserved/Booked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSubmit} className="flex-1">
              Create Event
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
