import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Building2, ShieldCheck, Clock3 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { useAuthState } from '@/hooks/useAuthState';
import { actionLabel, getPlatformOverview } from '@/lib/admin/platformAdmin';

export default function AdminDashboard() {
  const { user } = useAuthState();
  const query = useQuery({ queryKey: ['platform-admin', user?.id, 'overview'], queryFn: getPlatformOverview, enabled: !!user?.id, refetchInterval: 30_000 });
  const overview = query.data;
  return <AdminLayout subtitle="Approve legitimate venues, manage platform feature access, and support the PULSE community. Venue owners remain in charge of their operations.">
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Needs your attention</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Ownership review comes before verification and upgrades.</p></div><Button variant="outline" className="min-h-11" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh</Button></div>
        {query.isPending ? <p role="status" className="mt-5 text-sm">Loading platform overview…</p> : query.isError ? <p role="alert" className="mt-5 text-sm text-destructive">The overview is unavailable. Check your connection and admin access, then retry. If this is a new release, its database migration must be applied first.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[{ href: '/admin/venue-requests', count: overview?.pending_requests, label: 'Awaiting approval', icon: ShieldCheck },
            { href: '/admin/venue-requests?view=needs_info', count: overview?.needs_info, label: 'Waiting on applicant', icon: Clock3 },
            { href: '/admin/venues?filter=unverified', count: overview?.unverified_venues, label: 'Need verification', icon: ShieldCheck },
            { href: '/admin/venues', count: overview?.venues, label: 'Venue communities', icon: Building2 }].map(item => <Link key={item.label} to={item.href} className="min-w-0 rounded-xl border bg-background p-4 transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><div className="flex items-center justify-between text-muted-foreground"><item.icon className="h-4 w-4" /><ArrowUpRight className="h-4 w-4" /></div><p className="mt-4 text-3xl font-semibold tabular-nums">{item.count ?? '—'}</p><p className="mt-1 text-sm">{item.label}</p></Link>)}
        </div>}
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Venue feature access</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Every venue starts with a free community. Grant Court Booking, Facility Tools, or both—with optional expiry and an audit trail.</p><p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm leading-6">Admin grants are included access, not a paid subscription. Paid upgrades remain $10 per feature per month through owner-approved Stripe checkout. Venue funds, staff, bookings and posts are not managed here.</p><Button asChild className="mt-5 min-h-11"><Link to="/admin/venues">Manage venue access<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button></section>
        <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Access & responsibilities</h2><p className="mt-2 break-all text-sm font-medium">{overview?.account_email ?? 'Current superadmin account'}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">One platform superadmin. Venue owners and league managers retain their scoped roles. Role promotion is not available from this portal.</p><Link to="/archive" className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Find archived tools</Link></section>
      </div>
      <section className="rounded-2xl border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recent platform activity</h2><Link to="/admin/activity" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">View all activity</Link></div><div className="divide-y">{!query.isPending && !query.isError && !overview?.recent_actions.length && <p className="py-4 text-sm text-muted-foreground">No platform decisions recorded yet.</p>}{overview?.recent_actions.map(action => <div key={action.id} className="min-w-0 py-4"><p className="text-sm font-semibold">{actionLabel(action.action)}</p><p className="mt-1 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{action.note}</p><time className="mt-1 block text-xs text-muted-foreground">{new Date(action.created_at).toLocaleString()}</time></div>)}</div></section>
    </div>
  </AdminLayout>;
}
