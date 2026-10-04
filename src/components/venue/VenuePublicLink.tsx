import { copyText } from "@/lib/share";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { venuePublicPath, venuePublicUrl } from '@/lib/communityAccess';

export function VenuePublicLink({ slug, groupId }: { slug: string; groupId?: string }) {
  const [copyStatus, setCopyStatus] = useState('');
  return <section className="space-y-3 rounded-2xl border bg-card p-5">
    <h2 className="font-semibold">Your venue’s PULSE address</h2>
    <p className="text-sm leading-6 text-muted-foreground">Share this link with players. They can look around before creating an account. Your venue must be published with a public community for guests to see it. For an unlisted or private community, share an invitation instead.</p>
    <p className="break-all rounded-lg bg-muted p-3 text-sm font-medium">{venuePublicUrl(slug)}</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={async () => { try { await copyText(venuePublicUrl(slug)); setCopyStatus('Link copied'); } catch { setCopyStatus('Select and copy the address above.'); } }}>Copy venue link</Button><Button asChild variant="ghost" className="min-h-11"><Link to={venuePublicPath(slug)}>Open venue page</Link></Button></div>
    {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
    {groupId && <div className="space-y-2 border-t pt-3"><p className="text-sm text-muted-foreground">Want a memorable address like your-venue.pulsepb.com?</p><Button asChild variant="outline" className="min-h-11"><Link to={`/player/community/group/${groupId}/manage?tab=integrations`}>Set up your PULSE address</Link></Button></div>}
  </section>;
}
