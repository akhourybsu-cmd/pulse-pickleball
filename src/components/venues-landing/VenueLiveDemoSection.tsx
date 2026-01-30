import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, MapPin, Calendar, Users } from "lucide-react";
import { VenueScreenshotFrame } from "./VenueScreenshotFrame";

export const VenueLiveDemoSection = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              See Pulse in Action
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore our fully-functional demo venue to see exactly what your facility could look like on Pulse.
            </p>
          </div>

          {/* Browser Frame with Demo Preview */}
          <VenueScreenshotFrame 
            url="pulse-pickleball.lovable.app/v/pickleball-palace"
            className="mb-8"
          >
            {/* Demo Venue Preview */}
            <div className="relative">
              {/* Hero Banner */}
              <div className="h-32 md:h-48 bg-gradient-to-r from-orange-500 to-teal-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                
                {/* Venue Info Overlay */}
                <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 flex items-end gap-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center">
                    <span className="text-2xl md:text-3xl font-bold bg-gradient-to-br from-orange-500 to-teal-500 bg-clip-text text-transparent">PP</span>
                  </div>
                  <div>
                    <h3 className="text-white text-xl md:text-2xl font-bold">Pickleball Palace</h3>
                    <p className="text-white/80 text-sm flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Austin, Texas
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Quick Features */}
              <div className="p-4 md:p-6 grid grid-cols-3 gap-4">
                {[
                  { icon: Calendar, value: "8", label: "Indoor Courts" },
                  { icon: Users, value: "1,200+", label: "Active Players" },
                  { icon: Calendar, value: "24", label: "Monthly Events" },
                ].map((stat, i) => (
                  <div key={i} className="text-center py-3 bg-muted/30 rounded-xl border border-border/30">
                    <stat.icon className="w-5 h-5 text-primary mx-auto mb-1" />
                    <div className="text-lg md:text-xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
              
              {/* Mobile Nav Preview */}
              <div className="border-t border-border/30 px-4 py-3 flex justify-around">
                {["Home", "Book Court", "Events", "Coaching", "Info"].map((tab, i) => (
                  <div 
                    key={tab} 
                    className={`text-xs ${i === 0 ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                  >
                    {tab}
                  </div>
                ))}
              </div>
            </div>
          </VenueScreenshotFrame>

          {/* CTA */}
          <div className="text-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link to="/v/pickleball-palace">
                <Play className="w-5 h-5 mr-2" />
                Explore Demo Venue
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Browse courts, events, and coaching — no login required
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
