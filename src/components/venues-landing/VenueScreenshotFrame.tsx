import { ReactNode } from "react";

interface VenueScreenshotFrameProps {
  url?: string;
  children: ReactNode;
  className?: string;
}

export const VenueScreenshotFrame = ({ 
  url = "pulsepb.com", 
  children,
  className = ""
}: VenueScreenshotFrameProps) => {
  return (
    <div className={`rounded-xl border border-border/50 shadow-2xl overflow-hidden bg-card ${className}`}>
      {/* Browser Chrome */}
      <div className="bg-muted/50 px-4 py-2.5 flex items-center gap-3 border-b border-border/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
          <div className="w-3 h-3 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-background/50 rounded-md px-4 py-1 text-xs text-muted-foreground border border-border/30">
            {url}
          </div>
        </div>
        <div className="w-12" /> {/* Spacer for symmetry */}
      </div>
      
      {/* Content Area */}
      <div className="bg-gradient-to-br from-background to-muted/20">
        {children}
      </div>
    </div>
  );
};
