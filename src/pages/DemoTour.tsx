import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import logo from "@/assets/pulse-logo-premium.svg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

// Demo components
import { DemoProfileHero } from "@/components/demo/DemoProfileHero";
import { DemoQuickActions } from "@/components/demo/DemoQuickActions";
import { DemoSpacesPreview } from "@/components/demo/DemoSpacesPreview";
import { DemoStatsByCourt } from "@/components/demo/DemoStatsByCourt";
import { DemoPerformanceModule } from "@/components/demo/DemoPerformanceModule";
import { DemoActivityModule } from "@/components/demo/DemoActivityModule";
import { DemoSignUpCTA } from "@/components/demo/DemoSignUpCTA";

const DemoTour = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-4 flex items-center justify-between">
          <Link to="/">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-[50px] sm:h-[60px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Demo Mode Banner */}
      <div className="bg-primary/10 border-b border-primary/20">
        <div className="max-w-[1280px] mx-auto px-4 py-2 flex items-center justify-center gap-2">
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Demo Mode
          </Badge>
          <span className="text-sm text-muted-foreground">
            Explore Pulse with sample data
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto px-4 py-6 space-y-6">
          {/* Profile Hero */}
          <DemoProfileHero />

          {/* Quick Actions */}
          <DemoQuickActions />

          {/* Spaces Preview */}
          <DemoSpacesPreview />

          {/* Inline CTA */}
          <DemoSignUpCTA variant="inline" />

          {/* Two Column Layout (Desktop) / Stacked (Mobile) */}
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Left Column - Performance (3/5 width on desktop) */}
            <div className="lg:col-span-3 space-y-6">
              <DemoStatsByCourt />
              <DemoPerformanceModule />
            </div>

            {/* Right Column - Activity (2/5 width on desktop) */}
            <div className="lg:col-span-2">
              <DemoActivityModule />
            </div>
          </div>

          {/* Final CTA */}
          <DemoSignUpCTA />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DemoTour;
