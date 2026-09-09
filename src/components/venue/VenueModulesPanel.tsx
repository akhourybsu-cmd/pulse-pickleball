import { Link } from 'react-router-dom';
import { BadgeCheck, CalendarDays, Check, LayoutGrid, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVenueModules } from '@/hooks/useVenueModules';

export function VenueModulesPanel({ venueId, verified, canVerify = false }: { venueId: string; verified: boolean; canVerify?: boolean }) {
  const access = useVenueModules(venueId);
  return <div className="space-y-5 font-sans">
    <section className="rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-sans text-2xl font-semibold tracking-tight">Your venue essentials</h2><span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">Free community</span></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">The same community features your players already know, with your venue’s identity. Keep these whether or not you add facility tools.</p>
      <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">{['Posts and photos','Community messaging','Members and invitations','Community events and RSVPs','Shared files','Branding and moderation'].map(label => <li key={label} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{label}</li>)}</ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 p-4"><div className="flex min-w-0 items-start gap-3">{verified ? <BadgeCheck className="h-5 w-5 shrink-0 text-primary" /> : <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />}<div><p className="text-sm font-semibold">{verified ? 'Ownership verified' : 'Ownership review needed'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{verified ? 'Verified status is separate from paid access.' : 'Existing tools remain available. The verified badge requires a recorded PULSE review.'}</p></div></div>{!verified && canVerify && <Button variant="outline" asChild className="h-11 rounded-xl"><Link to={`/player/venue-requests?new=1&venue=${venueId}`}>Verify ownership</Link></Button>}</div>
    </section>
    <div><h2 className="font-sans text-lg font-semibold">Optional facility tools</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Separate add-ons, based on what your venue needs. Community events and their calendar stay free.</p></div>
    {access.isError ? <div role="alert" className="rounded-2xl border p-4">Couldn’t load feature access. <Button variant="link" onClick={() => access.refetch()}>Retry</Button></div> : <div className="grid gap-4 sm:grid-cols-2">{[
      { title: 'Court booking', icon: LayoutGrid, enabled: access.booking, description: 'Court inventory, player reservations, and court availability.' },
      { title: 'Facility operations', icon: CalendarDays, enabled: access.facility, description: 'A facility calendar, court assignments, program holds, and day-of-play operations.' },
    ].map(module => <section key={module.title} className="min-w-0 rounded-2xl border bg-card p-5"><module.icon className="h-5 w-5 text-primary" /><h3 className="mt-4 font-sans text-base font-semibold">{module.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p><p className="mt-4 text-sm font-semibold">{access.loading ? 'Checking access…' : module.enabled ? 'Enabled' : 'Optional paid add-on'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{module.enabled ? access.existingAccess ? 'Existing venue access preserved during rollout.' : 'Available for this venue.' : 'Pricing and activation are not available yet. No payment is taken.'}</p></section>)}</div>}
  </div>;
}
