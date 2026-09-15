import { createContext, useContext, type ReactNode } from 'react';
import { ArrowLeft, Gauge, MoreHorizontal, Settings, Ticket, FolderOpen } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useVisualViewportPane } from '@/hooks/useVisualViewportPane';
import { cn } from '@/lib/utils';
import { VenueBrandMark, type VenueIdentity } from './VenueBrandMark';
import { VenueMobileTabs, type VenuePageTab } from './VenuePageChrome';

const ShellContext = createContext<{ mobile: boolean; activeTab: VenuePageTab; visited: Set<string> }>({ mobile: false, activeTab: 'home', visited: new Set() });

/** One viewport owner: the venue bar and tabs never participate in page scrolling. */
export function VenueMobileShell({ mobile, activeTab, visited, identity, hasBooking, onCommunity, onExit, onBookings, onTools, onSettings, onOperations, children, footer }: {
  mobile: boolean; activeTab: VenuePageTab; visited: Set<string>; identity: VenueIdentity; hasBooking: boolean;
  onCommunity: () => void; onExit: () => void; onBookings: () => void; onTools: () => void;
  onSettings?: () => void; onOperations?: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const viewport = useVisualViewportPane();
  return <ShellContext.Provider value={{ mobile, activeTab, visited }}>
    {mobile ? <div data-venue-mobile-shell className="venue-mobile-shell" style={viewport}>
      <header className="venue-app-bar">
        <button type="button" className="venue-app-icon" aria-label="Back to PULSE" onClick={onExit}><ArrowLeft className="h-[18px] w-[18px]" /></button>
        <VenueBrandMark {...identity} className="h-8 w-8 text-[32px] ring-1 ring-white/15" />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight" title={identity.name}>{identity.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="venue-app-icon" aria-label="Venue menu"><MoreHorizontal className="h-5 w-5" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
            <DropdownMenuItem className="min-h-11" onSelect={onBookings}><Ticket className="mr-2 h-4 w-4" />My bookings</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={onTools}><FolderOpen className="mr-2 h-4 w-4" />Community tools</DropdownMenuItem>
            {(onSettings || onOperations) && <DropdownMenuSeparator />}
            {onSettings && <DropdownMenuItem className="min-h-11" onSelect={onSettings}><Settings className="mr-2 h-4 w-4" />Manage venue</DropdownMenuItem>}
            {onOperations && <DropdownMenuItem className="min-h-11" onSelect={onOperations}><Gauge className="mr-2 h-4 w-4" />Venue operations</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <VenueMobileTabs activeTab={activeTab} hasCourts={hasBooking} onOpenCommunity={onCommunity} />
      <div className="venue-app-body">{children}</div>
      {footer}
    </div> : children}
  </ShellContext.Provider>;
}

/** Visited mobile pages remain mounted, preserving their own scroll and local UI state. */
export function VenuePanel({ value, className, forceMount, children }: { value: VenuePageTab; className?: string; forceMount?: true; children: ReactNode }) {
  const { mobile, activeTab, visited } = useContext(ShellContext);
  return <TabsContent value={value} forceMount={mobile ? visited.has(value) ? true : undefined : forceMount}
    className={cn(className, mobile && 'venue-app-panel', mobile && value === 'chat' && 'venue-app-chat-panel', activeTab !== value && 'hidden')}>
    {children}
  </TabsContent>;
}
