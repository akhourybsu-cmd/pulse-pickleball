import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, Gauge, MoreHorizontal, Settings, Ticket, FolderOpen } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useVisualViewportPane } from '@/hooks/useVisualViewportPane';
import { cn } from '@/lib/utils';
import { VenueBrandMark, type VenueIdentity } from './VenueBrandMark';
import { VenueMobileTabs, type VenuePageTab } from './VenuePageChrome';

const ShellContext = createContext<{ mobile: boolean; activeTab: VenuePageTab; visited: Set<string>; memoryKey?: string }>({ mobile: false, activeTab: 'home', visited: new Set() });
const scrollPositions = new Map<string, number>();
const usePanelLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** One viewport owner: the venue bar and tabs never participate in page scrolling. */
export function VenueMobileShell({ mobile, activeTab, visited, identity, hasBooking, onCommunity, onPlay, onExit, onBookings, onTools, onSettings, onOperations, children, footer, memoryKey }: {
  mobile: boolean; activeTab: VenuePageTab; visited: Set<string>; identity: VenueIdentity; hasBooking: boolean;
  onPlay?: () => void; onCommunity: () => void; onExit: () => void; onBookings: () => void; onTools: () => void;
  onSettings?: () => void; onOperations?: () => void; children: ReactNode; footer?: ReactNode; memoryKey?: string;
}) {
  const viewport = useVisualViewportPane();
  return <ShellContext.Provider value={{ mobile, activeTab, visited, memoryKey }}>
    {mobile ? <div data-venue-mobile-shell className="venue-mobile-shell" style={viewport}>
      <header className="venue-app-bar">
        <button type="button" className="venue-app-icon" aria-label="Back to PULSE" onClick={onExit}><ArrowLeft className="h-[18px] w-[18px]" /></button>
        <VenueBrandMark {...identity} className="h-9 w-9 text-[36px] ring-1 ring-white/15" />
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight" title={identity.name}>{identity.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="venue-app-icon" aria-label="Venue menu"><MoreHorizontal className="h-5 w-5" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
            <DropdownMenuItem className="min-h-11" onSelect={onBookings}><Ticket className="mr-2 h-4 w-4" />My bookings</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={onTools}><FolderOpen className="mr-2 h-4 w-4" />Files & policies</DropdownMenuItem>
            {(onSettings || onOperations) && <DropdownMenuSeparator />}
            {onSettings && <DropdownMenuItem className="min-h-11" onSelect={onSettings}><Settings className="mr-2 h-4 w-4" />Manage venue</DropdownMenuItem>}
            {onOperations && <DropdownMenuItem className="min-h-11" onSelect={onOperations}><Gauge className="mr-2 h-4 w-4" />Venue operations</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <VenueMobileTabs activeTab={activeTab} hasCourts={hasBooking} onOpenCommunity={onCommunity} onOpenPlay={onPlay} />
      <div className="venue-app-body">{children}</div>
      {footer}
    </div> : <>{children}{footer && <div className="sticky bottom-0 z-20">{footer}</div>}</>}
  </ShellContext.Provider>;
}

/** Visited mobile pages remain mounted, preserving their own scroll and local UI state. */
export function VenuePanel({ value, className, forceMount, children, section = '' }: { value: VenuePageTab; className?: string; forceMount?: true; children: ReactNode; section?: string }) {
  const { mobile, activeTab, visited, memoryKey } = useContext(ShellContext);
  const panel = useRef<HTMLDivElement>(null);
  const restoring = useRef(false);
  const key = memoryKey ? memoryKey + ':' + value + ':' + section : null;
  usePanelLayoutEffect(() => {
    const element = panel.current;
    if (!mobile || !element || activeTab !== value || !key) return;
    const target = scrollPositions.get(key) ?? 0;
    restoring.current = true;
    const restore = () => {
      if (!restoring.current) return;
      element.scrollTop = target;
      if (Math.abs(element.scrollTop - target) < 1) restoring.current = false;
    };
    restore();
    const observer = new MutationObserver(restore);
    observer.observe(element, { childList: true, subtree: true });
    const resized = new ResizeObserver(restore);
    if (element.firstElementChild) resized.observe(element.firstElementChild);
    return () => {
      observer.disconnect(); resized.disconnect();
    };
  }, [mobile, activeTab, value, key]);
  return <TabsContent ref={panel} value={value} forceMount={mobile ? visited.has(value) ? true : undefined : forceMount}
    onWheel={() => { restoring.current = false; }} onTouchStart={() => { restoring.current = false; }}
    onScroll={event => {
      if (key && !restoring.current && activeTab === value) {
        scrollPositions.set(key, event.currentTarget.scrollTop);
        if (scrollPositions.size > 100) scrollPositions.delete(scrollPositions.keys().next().value!);
      }
    }}
    className={cn(className, mobile && 'venue-app-panel', mobile && value === 'chat' && 'venue-app-chat-panel', activeTab !== value && 'hidden')}>
    {children}
  </TabsContent>;
}
