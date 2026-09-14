import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { isTournamentsEnabled } from '@/lib/tournaments/featureFlag';
const groups = [
  { title: 'Legacy session operations', detail: 'The original single-session tools remain available for maintenance. Current events and facility operations belong in their owner workspaces.', links: [['/admin/legacy-tools','Session console, QR tools & rating maintenance'],['/admin/session','Session directory']] },
  { title: 'Specialist & diagnostic tools', detail: 'Infrequent tools, removed from primary navigation—not deleted.', links: [['/admin/biometrics','Biometrics diagnostics'],['/admin/test-accounts','Test accounts'],['/admin/password-reset','Password support'],['/admin/badges','Badge management'],['/admin/marketing','Marketing materials']] },
];
export default function AdminArchive() {
  return <AdminLayout title="Archived tools" subtitle="Retained for occasional use. No records, features or owner workspaces were deleted."><div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    {groups.map(group => <section key={group.title} className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">{group.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{group.detail}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{group.links.map(([href,label]) => <Link key={href} to={href} className="flex min-h-12 items-center rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{label}</Link>)}</div></section>)}
    {isTournamentsEnabled() && <section className="rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">Legacy tournament console</h2><Link className="mt-3 inline-flex min-h-11 items-center text-sm underline" to="/tournament-admin">Open tournament administration</Link></section>}
  </div></AdminLayout>;
}
