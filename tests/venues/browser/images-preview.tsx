import { useEffect, useState } from 'react';
import { AdminVenueTab } from '../../../src/components/community/admin/AdminVenueTab';
import { Toaster } from '../../../src/components/ui/toaster';

export function ImagesPreview() {
  const [status, setStatus] = useState('Ready. Uploads stay in local browser memory; no network writes.');
  useEffect(() => {
    const listener = (event: Event) => setStatus((event as CustomEvent<string>).detail);
    window.addEventListener('venue-image-qa', listener);
    return () => window.removeEventListener('venue-image-qa', listener);
  }, []);
  return <main className="mx-auto w-full min-w-0 max-w-5xl space-y-4 p-3 sm:p-6">
    <p className="break-words text-xs text-muted-foreground" role="status" data-testid="image-qa-status">LOCAL IMAGE FIXTURE · {status}</p>
    <AdminVenueTab groupId="local-group" venueId="local-sample" isVerified mode="profile" />
    <Toaster />
  </main>;
}
