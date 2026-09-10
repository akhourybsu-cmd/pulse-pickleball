import { LockKeyhole } from 'lucide-react';

export function PrivateVenueNotice() {
  return <section className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 font-sans sm:p-5" aria-label="Private sample venue">
    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <div className="min-w-0">
      <p className="text-sm font-semibold">Private sample venue · Only you</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">Booking and operations are included. Your edits stay here. Real payments, invitations and uploads are off.</p>
      <details className="mt-2 text-xs leading-5 text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-3 font-medium text-foreground/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">About this sample</summary>
        <p>This is not a verified business or a paid subscription. PULSE may separately approve owner-only Stripe test payments; real charges remain blocked. Public listing and invitations are disabled. Images and files cannot be uploaded because normal venue storage uses public links. Text posts and chat work normally.</p>
      </details>
    </div>
  </section>;
}
