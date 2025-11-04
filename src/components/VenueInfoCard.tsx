import { MapPin, Phone } from "lucide-react";

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
    <div className="bg-white rounded-lg shadow-sm border p-4 w-full max-w-sm" style={{ borderColor: '#e5f3d9' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#0E4C58' }}>{venue.name}</h3>
        </div>
        <span
          aria-label="Facility status"
          className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
            isOpen ? "text-white" : "text-white"
          }`}
          style={{
            backgroundColor: isOpen ? '#B9E43B' : '#ef4444'
          }}
        >
          {isOpen ? "Open now" : "Closed"}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <address className="not-italic text-xs flex gap-2 items-start" style={{ color: '#0E4C58', opacity: 0.8 }}>
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#B9E43B' }} />
          <span>{venue.address}</span>
        </address>
        <a 
          href={`tel:${venue.phone.replace(/\D/g, "")}`} 
          className="text-xs font-medium flex gap-2 items-center hover:underline"
          style={{ color: '#B9E43B' }}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>{venue.phone}</span>
        </a>
        <p className="text-xs flex gap-2 items-center" style={{ color: '#0E4C58', opacity: 0.8 }}>
          <span className="text-base">🎾</span>
          <span>{venue.courts.indoor} indoor courts</span>
        </p>
      </div>

      <div className="border-t pt-2" style={{ borderColor: '#e5f3d9' }}>
        <p className="text-[11px]" style={{ color: '#0E4C58', opacity: 0.7 }}>
          Today's Hours: {formatTime(todayHours.open)} – {formatTime(todayHours.close)}
        </p>
        {isOpen && (
          <p className="text-[11px] mt-0.5" style={{ color: '#0E4C58', opacity: 0.6 }}>
            Closes at {formatTime(todayHours.close)}
          </p>
        )}
        {!isOpen && (
          <p className="text-[11px] mt-0.5" style={{ color: '#0E4C58', opacity: 0.6 }}>
            Opens at {formatTime(todayHours.open)}
          </p>
        )}
      </div>
    </div>
  );
};

export default VenueInfoCard;
