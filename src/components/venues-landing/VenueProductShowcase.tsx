import { VenueScreenshotFrame } from "./VenueScreenshotFrame";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Trophy,
  Clock,
  TrendingUp,
  MapPin,
  Star,
  ChevronRight
} from "lucide-react";

// Dashboard Mockup Component
const DashboardMockup = () => (
  <div className="p-4 space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="h-4 w-32 bg-foreground/80 rounded" />
          <div className="h-3 w-24 bg-muted-foreground/40 rounded mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-primary/20 rounded-md" />
        <div className="h-8 w-8 bg-muted rounded-md" />
      </div>
    </div>
    
    {/* Stats Grid */}
    <div className="grid grid-cols-4 gap-3">
      {[
        { icon: Users, label: "Players", value: "1,247" },
        { icon: Calendar, label: "Events", value: "12" },
        { icon: Trophy, label: "Tournaments", value: "3" },
        { icon: TrendingUp, label: "Growth", value: "+18%" },
      ].map((stat, i) => (
        <div key={i} className="bg-card border border-border/50 rounded-lg p-3">
          <stat.icon className="w-4 h-4 text-primary mb-2" />
          <div className="text-lg font-bold text-foreground">{stat.value}</div>
          <div className="text-xs text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
    
    {/* Activity Feed */}
    <div className="bg-card border border-border/50 rounded-lg p-3">
      <div className="text-sm font-medium text-foreground mb-3">Recent Activity</div>
      <div className="space-y-2">
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-3 w-3/4 bg-muted-foreground/30 rounded" />
              <div className="h-2 w-1/2 bg-muted-foreground/20 rounded mt-1" />
            </div>
            <div className="h-2 w-12 bg-muted-foreground/20 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Public Venue Page Mockup
const PublicPageMockup = () => (
  <div className="space-y-0">
    {/* Hero Banner */}
    <div className="h-24 bg-gradient-to-r from-orange-500/80 to-teal-500/80 relative">
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute bottom-3 left-4 flex items-end gap-3">
        <div className="w-14 h-14 rounded-xl bg-white shadow-lg flex items-center justify-center">
          <span className="text-xl font-bold text-orange-500">PP</span>
        </div>
        <div>
          <div className="text-white font-bold text-lg">Pickleball Palace</div>
          <div className="text-white/80 text-xs flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Austin, TX
          </div>
        </div>
      </div>
    </div>
    
    {/* Quick Stats */}
    <div className="p-4 grid grid-cols-3 gap-3">
      {[
        { value: "8", label: "Courts" },
        { value: "24", label: "Events/mo" },
        { value: "4.9", label: "Rating", icon: Star },
      ].map((stat, i) => (
        <div key={i} className="text-center py-2 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-center gap-1">
            <span className="text-lg font-bold text-foreground">{stat.value}</span>
            {stat.icon && <stat.icon className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
          </div>
          <div className="text-xs text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
    
    {/* Navigation Tabs */}
    <div className="px-4 flex gap-2 border-b border-border/50 pb-2">
      {["Home", "Book", "Events", "Coaching"].map((tab, i) => (
        <div 
          key={tab} 
          className={`px-3 py-1.5 text-xs rounded-md ${i === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {tab}
        </div>
      ))}
    </div>
  </div>
);

// Event Management Mockup
const EventsMockup = () => (
  <div className="p-4 space-y-3">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-foreground">Upcoming Events</div>
      <div className="h-7 w-24 bg-primary rounded-md flex items-center justify-center text-xs text-primary-foreground">
        + New Event
      </div>
    </div>
    
    {/* Event Cards */}
    <div className="space-y-2">
      {[
        { name: "Morning Round Robin", type: "Round Robin", time: "9:00 AM", players: "12/16", color: "bg-green-500" },
        { name: "Beginner Clinic", type: "Clinic", time: "2:00 PM", players: "8/12", color: "bg-blue-500" },
        { name: "Weekend Tournament", type: "Tournament", time: "Sat 8AM", players: "24/32", color: "bg-purple-500" },
      ].map((event, i) => (
        <div key={i} className="bg-card border border-border/50 rounded-lg p-3 flex items-center gap-3">
          <div className={`w-1 h-12 ${event.color} rounded-full`} />
          <div className="flex-1">
            <div className="font-medium text-sm text-foreground">{event.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{event.type}</span>
              <Clock className="w-3 h-3" />
              {event.time}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-foreground">{event.players}</div>
            <div className="text-xs text-muted-foreground">players</div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      ))}
    </div>
  </div>
);

const showcaseItems = [
  {
    title: "Your Venue Dashboard",
    description: "A complete command center for managing courts, events, staff, and analytics. See real-time activity and key metrics at a glance.",
    mockup: <DashboardMockup />,
    url: "pulsepb.com/venue/dashboard",
  },
  {
    title: "Player-Facing Venue Page",
    description: "Your branded public page where players book courts, register for events, and discover coaching — all under your brand.",
    mockup: <PublicPageMockup />,
    url: "pulsepb.com/v/your-venue",
  },
  {
    title: "Event & Tournament Management",
    description: "Create, manage, and run round robins, clinics, and tournaments with automated scheduling and registration.",
    mockup: <EventsMockup />,
    url: "pulsepb.com/venue/events",
  },
];

export const VenueProductShowcase = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            See What You'll Get
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful tools designed for modern pickleball operations, right out of the box.
          </p>
        </div>

        <div className="space-y-16 md:space-y-24 max-w-5xl mx-auto">
          {showcaseItems.map((item, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
              } items-center gap-8 lg:gap-12`}
            >
              {/* Screenshot Frame */}
              <div className="flex-1 w-full max-w-md lg:max-w-none">
                <VenueScreenshotFrame url={item.url}>
                  {item.mockup}
                </VenueScreenshotFrame>
              </div>

              {/* Text Content */}
              <div className="flex-1 text-center lg:text-left">
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
