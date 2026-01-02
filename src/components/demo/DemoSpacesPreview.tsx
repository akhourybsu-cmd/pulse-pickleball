import { Home, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { demoHomeCourt, demoGroups } from "@/data/demoData";

export const DemoSpacesPreview = () => {
  const handleClick = () => {
    toast.info("Sign up to use this feature!", {
      action: {
        label: "Sign Up",
        onClick: () => window.location.href = "/auth",
      },
    });
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Your Spaces
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* Home Court */}
        <button
          onClick={handleClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium whitespace-nowrap hover:bg-primary/15 transition-colors"
        >
          <Home className="w-4 h-4 text-primary" />
          <span>{demoHomeCourt.name}</span>
        </button>
        
        {/* Groups */}
        {demoGroups.map((group) => (
          <button
            key={group.id}
            onClick={handleClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border border-border/50 rounded-full text-sm font-medium whitespace-nowrap hover:bg-muted/70 transition-colors"
          >
            {group.type === "venue_official" ? (
              <MapPin className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Users className="w-4 h-4 text-muted-foreground" />
            )}
            <span>{group.name}</span>
            {group.verified && (
              <span className="w-2 h-2 bg-blue-500 rounded-full" title="Verified" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
