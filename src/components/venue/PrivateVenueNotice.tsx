import { LockKeyhole } from 'lucide-react';

export function PrivateVenueNotice() {
  return <section className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 font-sans sm:p-5" aria-label="Private sample venue">
    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <div className="min-w-0">
      <p className="text-sm font-semibold">Private sample venue · Only you</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">You own this space. Court booking and facility operations are included at no cost. Sample content is editable and your changes are saved here.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Invitations, public listing and live payments are disabled. This is a sample venue, not a verified business or a paid subscription.</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Image and file uploads are disabled here to keep your files out of public storage. Text posts and chat work normally.</p>
    </div>
  </section>;
}
