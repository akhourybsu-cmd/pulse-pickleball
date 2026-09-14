import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { useAuthState } from '@/hooks/useAuthState';
import { actionLabel, getPlatformActivity } from '@/lib/admin/platformAdmin';
export default function AdminPlatformActivity() {
  const { user } = useAuthState(); const [page, setPage] = useState(0); const [params] = useSearchParams(); const venue = params.get('venue') || undefined;
  const query = useQuery({ queryKey: ['platform-admin', user?.id, 'activity', venue, page], queryFn: () => getPlatformActivity(page, venue), enabled: !!user?.id });
  return <AdminLayout title="Platform activity" subtitle="A read-only record of approvals and feature-access changes. Financial transactions remain in their separate payment records."><div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
    {query.isPending ? <p role="status">Loading activity…</p> : query.isError ? <div role="alert"><p>Activity couldn’t be loaded.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => void query.refetch()}>Retry</Button></div> : <>
      {!query.data?.length && <p className="rounded-2xl border p-6 text-sm text-muted-foreground">No activity in this view.</p>}
      {query.data?.map(action => <article key={action.id} className="min-w-0 rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{actionLabel(action.action)}</h2><time className="text-xs text-muted-foreground">{new Date(action.created_at).toLocaleString()}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{action.note}</p><details className="mt-3 text-sm"><summary className="cursor-pointer py-2 text-muted-foreground">Decision details</summary><div className="mt-2 grid min-w-0 gap-3 md:grid-cols-2">{[['Before', action.before_state], ['After', action.after_state]].map(([title, value]) => <div key={String(title)} className="min-w-0"><p className="mb-1 font-medium">{String(title)}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 text-xs [overflow-wrap:anywhere]">{JSON.stringify(value, null, 2)}</pre></div>)}</div></details></article>)}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Page {page + 1}</p><div className="flex gap-2"><Button variant="outline" className="min-h-11" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" className="min-h-11" disabled={query.data?.length !== 25} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
    </>}
  </div></AdminLayout>;
}

