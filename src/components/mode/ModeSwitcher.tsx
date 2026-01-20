import { useState } from 'react';
import { Building2, User, ChevronDown, Check, Plus, Settings, Search } from 'lucide-react';
import { useMode, VenueRole } from '@/contexts/ModeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { canManageVenue } from '@/lib/permissions';
import { motion, AnimatePresence } from 'framer-motion';
import { getVenueLogoSrc, getVenueLogoFallback } from '@/lib/venueBranding';

// Role badge colors
const roleBadgeStyles: Record<VenueRole, string> = {
  owner: 'bg-primary/20 text-primary border-primary/30',
  manager: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  organizer: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
  staff: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

export function ModeSwitcher() {
  const { 
    mode, 
    setMode, 
    hasVenueAccess, 
    venueAccess, 
    currentVenueId, 
    setCurrentVenueId,
    currentVenue,
    activeVenueRole 
  } = useMode();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleModeSwitch = (newMode: 'player' | 'venue') => {
    setMode(newMode);
    setIsOpen(false);
    if (newMode === 'player') {
      navigate('/player/dashboard');
    } else {
      navigate('/venue');
    }
  };

  const handleVenueSelect = (venueId: string) => {
    setCurrentVenueId(venueId);
    setMode('venue');
    setIsOpen(false);
    navigate('/venue');
  };

  const filteredVenues = venueAccess.filter(venue =>
    venue.venue_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showSearch = venueAccess.length > 5;

  // Trigger button content
  const TriggerContent = () => (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2"
        >
          {mode === 'player' ? (
            <>
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="hidden sm:inline font-medium text-sm">Player</span>
            </>
          ) : (
            <>
              <Avatar className="h-6 w-6">
                <AvatarImage 
                  src={getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name, currentVenue?.slug)} 
                  alt={currentVenue?.venue_name} 
                />
                <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                  {currentVenue?.venue_name?.slice(0, 2).toUpperCase() || 'V'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline font-medium text-sm truncate max-w-[100px]">
                {currentVenue?.venue_name || 'Venue'}
              </span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );

  // Shared menu content
  const MenuContent = () => (
    <div className="py-2">
      {/* Mode Toggle Section */}
      <div className="px-2 pb-2">
        <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Switch Mode</p>
        <button
          onClick={() => handleModeSwitch('player')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            mode === 'player' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-foreground'
          )}
        >
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center',
            mode === 'player' ? 'bg-primary/20' : 'bg-muted'
          )}>
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-sm">Player Mode</p>
            <p className="text-xs text-muted-foreground">Your personal profile</p>
          </div>
          {mode === 'player' && <Check className="h-4 w-4 text-primary" />}
        </button>
      </div>

      <div className="h-px bg-border my-2" />

      {/* Venue Section */}
      <div className="px-2">
        <p className="text-xs font-medium text-muted-foreground px-2 mb-2">
          {hasVenueAccess ? 'Your Venues' : 'Venue Mode'}
        </p>
        
        {hasVenueAccess ? (
          <>
            {showSearch && (
              <div className="px-2 mb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search venues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
            )}
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {filteredVenues.map((venue) => {
                const isSelected = mode === 'venue' && currentVenueId === venue.venue_id;
                return (
                  <button
                    key={venue.venue_id}
                    onClick={() => handleVenueSelect(venue.venue_id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isSelected 
                        ? 'bg-secondary/80 text-secondary-foreground' 
                        : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={getVenueLogoSrc(venue.logo_url, venue.venue_name, venue.slug)} 
                        alt={venue.venue_name} 
                      />
                      <AvatarFallback className="text-[10px] bg-muted">
                        {venue.venue_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-sm truncate">{venue.venue_name}</p>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'text-[10px] px-1.5 py-0 h-4 font-medium capitalize',
                          roleBadgeStyles[venue.role]
                        )}
                      >
                        {venue.role}
                      </Badge>
                    </div>
                    {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/venue/interest');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm text-foreground">Register a Venue</p>
              <p className="text-xs">Become a venue operator</p>
            </div>
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="h-px bg-border my-2" />
      <div className="px-2 space-y-1">
        <button
          onClick={() => {
            setIsOpen(false);
            navigate('/venue/interest');
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Venue</span>
        </button>
        {mode === 'venue' && canManageVenue(activeVenueRole) && (
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/venue/settings');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm text-muted-foreground"
          >
            <Settings className="h-4 w-4" />
            <span>Venue Settings</span>
          </button>
        )}
      </div>
    </div>
  );

  // Mobile: Bottom sheet
  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-1 h-9 px-2 sm:px-3 border-border/50"
        >
          <TriggerContent />
        </Button>
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="border-b pb-4">
              <DrawerTitle className="text-center">Switch Context</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto">
              <MenuContent />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: Dropdown
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1 h-9 px-3 border-border/50"
        >
          <TriggerContent />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-72 p-0"
        sideOffset={8}
      >
        <MenuContent />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
