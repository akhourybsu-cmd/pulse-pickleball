import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Calendar, CalendarDays, Award, Info, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PublicVenue, VenueCourt, VenueEvent, VenueCoach } from '@/hooks/usePublicVenue';
import { supabase } from '@/integrations/supabase/client';

export type TabId = 'home' | 'schedule' | 'events' | 'coaching' | 'info';

interface PublicVenueShellProps {
  venue: PublicVenue;
  courts: VenueCourt[];
  events: VenueEvent[];
  coaches: VenueCoach[];
  initialTab?: TabId;
  children: (activeTab: TabId, setActiveTab: (tab: TabId) => void) => React.ReactNode;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'schedule', label: 'Book Court', icon: Calendar },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'coaching', label: 'Coaching', icon: Award },
  { id: 'info', label: 'Info', icon: Info },
];

// Helper to determine if a hex color is dark
function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export function PublicVenueShell({ venue, courts, events, coaches, initialTab = 'home', children }: PublicVenueShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [isVenueAdmin, setIsVenueAdmin] = useState(false);
  const navigate = useNavigate();
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';

  // Check if current user is venue owner or staff
  useEffect(() => {
    const checkVenueAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check venue_staff for this venue
      const { data: staffData } = await supabase
        .from('venue_staff')
        .select('id')
        .eq('venue_id', venue.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (staffData) {
        setIsVenueAdmin(true);
      }
    };

    checkVenueAccess();
  }, [venue.id]);

  // Hide coaches tab if no coaches
  const visibleTabs = tabs.filter(tab => {
    if (tab.id === 'coaching' && coaches.length === 0) return false;
    return true;
  });

  // Get active tab index for indicator animation
  const activeTabIndex = visibleTabs.findIndex(tab => tab.id === activeTab);

  return (
    <div 
      className="min-h-screen flex flex-col bg-background"
      style={{
        '--venue-primary': primaryColor,
        '--venue-secondary': secondaryColor,
      } as React.CSSProperties}
    >
      {/* Main Content with AnimatePresence for tab transitions */}
      <main className="flex-1 pb-20 md:pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {children(activeTab, setActiveTab)}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation with sliding indicator */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden safe-area-inset-bottom">
        <div className="relative flex justify-around items-center h-16">
          {/* Sliding indicator */}
          <motion.div
            className="absolute bottom-0 h-0.5 rounded-full"
            style={{ 
              backgroundColor: primaryColor,
              width: `${100 / visibleTabs.length}%`
            }}
            animate={{ 
              left: `${(activeTabIndex / visibleTabs.length) * 100}%` 
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
          
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full transition-colors relative",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={isActive ? { color: primaryColor } : undefined}
              >
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Icon className="h-5 w-5 mb-1" />
                </motion.div>
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Tab Navigation (horizontal) with sliding indicator */}
      <nav className="hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="container mx-auto px-4">
          <div className="relative flex justify-center items-center gap-2 h-14">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200",
                    isActive 
                      ? "font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  style={isActive ? { 
                    color: primaryColor, 
                    backgroundColor: `${primaryColor}15` 
                  } : undefined}
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.05 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.div>
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Powered by Pulse (only on home tab) */}
      {activeTab === 'home' && venue.show_pulse_branding !== false && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="fixed bottom-16 md:bottom-14 left-0 right-0 bg-background/95 border-t border-border py-2"
        >
          <div className="text-center">
            <Link 
              to="/" 
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Zap className="w-3 h-3" />
              Powered by Pulse
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
