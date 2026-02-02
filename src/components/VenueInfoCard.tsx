import { MapPin, Phone, Trophy } from "lucide-react";

interface VenueHours {
  open: string;
  close: string;
}

interface VenueData {
  name: string;
  address: string;
  phone: string;
  courts: {
    indoor: number;
  };
  hours: {
    monday: VenueHours;
    tuesday: VenueHours;
    wednesday: VenueHours;
    thursday: VenueHours;
    friday: VenueHours;
    saturday: VenueHours;
    sunday: VenueHours;
  };
}

const VenueInfoCard = () => {
  const venue: VenueData = {
    name: "Cranston Facility",
    address: "60 Walnut Grove Ave, Cranston, RI 02920",
    phone: "(401) 999-9065",
    courts: {
      indoor: 2
    },
    hours: {
      monday: { open: "08:00", close: "20:00" },
      tuesday: { open: "08:00", close: "20:00" },
      wednesday: { open: "08:00", close: "20:00" },
      thursday: { open: "08:00", close: "20:00" },
      friday: { open: "08:00", close: "20:00" },
      saturday: { open: "08:00", close: "20:00" },
      sunday: { open: "08:00", close: "20:00" },
    }
  };

  const now = new Date();
  const dayIndex = now.getDay(); // 0 = Sunday
  const dayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayKey = dayMap[dayIndex] as keyof typeof venue.hours;
  const todayHours = venue.hours[todayKey];

  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = toMinutes(todayHours.open);
  const closeMinutes = toMinutes(todayHours.close);

  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="bg-card rounded-xl shadow-md hover:shadow-lg transition-shadow border border-border p-4 w-full max-w-sm">
      <div className="mb-3">
        <h3 className="text-[15px] font-semibold mb-2 text-foreground">{venue.name}</h3>
      </div>

      <div className="space-y-2 mb-3">
        <address className="not-italic text-xs flex gap-2 items-start text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary" />
          <span>{venue.address}</span>
        </address>
        <a 
          href={`tel:${venue.phone.replace(/\D/g, "")}`} 
          className="text-xs font-medium flex gap-2 items-center text-primary hover:underline"
        >
          <Phone className="w-3.5 h-3.5" />
          <span>{venue.phone}</span>
        </a>
        <p className="text-xs flex gap-2 items-center text-muted-foreground">
          <Trophy className="w-3.5 h-3.5 text-primary" />
          <span>{venue.courts.indoor} indoor courts</span>
        </p>
      </div>

      <div className="border-t border-border pt-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground">
            Today's Hours: {formatTime(todayHours.open)} – {formatTime(todayHours.close)}
          </p>
          {isOpen && (
            <p className="text-[11px] mt-0.5 text-muted-foreground/70">
              Closes at {formatTime(todayHours.close)}
            </p>
          )}
          {!isOpen && (
            <p className="text-[11px] mt-0.5 text-muted-foreground/70">
              Opens at {formatTime(todayHours.open)}
            </p>
          )}
        </div>
        <span
          aria-label="Facility status"
          className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
            isOpen 
              ? "bg-primary text-primary-foreground" 
              : "bg-destructive text-destructive-foreground"
          }`}
        >
          {isOpen ? "Open" : "Closed"}
        </span>
      </div>
    </div>
  );
};

export default VenueInfoCard;
