import { HostingSetupError, type hostingResult } from './firebase.ts';

export const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
type Result = ReturnType<typeof hostingResult> | { status: 'error'; provider_details: { issues: string[] } };
export interface AddressDependencies {
  authorize(req: Request): Promise<{ actor: string } | Response>;
  claim(venue: string, actor: string): Promise<{ slug: string; token: string } | null>;
  connect(slug: string): Promise<ReturnType<typeof hostingResult>>;
  finish(venue: string, actor: string, token: string, result: Result): Promise<void>;
}
export function createAddressHandler(deps: AddressDependencies) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    try {
      const caller = await deps.authorize(req);
      if (caller instanceof Response) return caller;
      const body = await req.json().catch(() => null);
      if (body?.action !== 'sync' || typeof body.venueId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.venueId)) return json({ error: 'Choose a venue address request to check.' }, 400);
      const connection = await deps.claim(body.venueId, caller.actor);
      if (!connection) return json({ error: 'This request is already being checked. Try again in a minute.' }, 429);
      let result: Result;
      try { result = await deps.connect(connection.slug); }
      catch (error) {
        // Provider implementations return curated messages; never store raw HTTP responses or credentials.
        result = { status: 'error', provider_details: { issues: [error instanceof HostingSetupError ? error.message : 'Hosting check failed. Try again.'] } };
      }
      await deps.finish(body.venueId, caller.actor, connection.token, result);
      return json({ status: result.status });
    } catch {
      return json({ error: 'Address setup could not be completed. Check that the venue is active and verified, then try again.' }, 400);
    }
  };
}
