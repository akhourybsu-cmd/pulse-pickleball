import { describe, expect, it, vi } from 'vitest';
import { hostingResult, syncHostingDomain, connectFirebaseAddress, HostingSetupError } from '../../supabase/functions/venue-integrations/firebase';
import { createAddressHandler, type AddressDependencies } from '../../supabase/functions/venue-integrations/handler';

const ready = { hostState:'HOST_ACTIVE', ownershipState:'OWNERSHIP_ACTIVE', cert:{state:'CERT_ACTIVE'} };
const response = (data: unknown, status=200) => new Response(JSON.stringify(data),{status});
describe('Firebase venue address adapter', () => {
  it('signs the service-account assertion and uses the exchanged token only on Firebase', async () => {
    const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    const pem=`-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8',key.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`;
    const account=JSON.stringify({project_id:'pulse-pickleball-c60e1',client_email:'fixture@pulse-pickleball-c60e1.iam.gserviceaccount.com',private_key:pem});
    const fetcher=vi.fn().mockResolvedValueOnce(response({access_token:'exchanged-test-token'})).mockResolvedValueOnce(response(ready));
    expect((await connectFirebaseAddress('palace',account,fetcher)).status).toBe('connected');
    expect(fetcher.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    const assertion=fetcher.mock.calls[0][1].body.get('assertion') as string;
    const [header,claims,signature]=assertion.split('.');
    expect(JSON.parse(Buffer.from(claims,'base64url').toString())).toMatchObject({iss:'fixture@pulse-pickleball-c60e1.iam.gserviceaccount.com',scope:'https://www.googleapis.com/auth/firebase.hosting',aud:'https://oauth2.googleapis.com/token'});
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(`${header}.${claims}`))).toBe(true);
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer exchanged-test-token');
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('BEGIN PRIVATE KEY');
  });
  it('requires successful hosting, ownership and HTTPS; never marks partial/error/deleted/redirected domains ready', () => {
    expect(hostingResult(ready).status).toBe('connected');
    for (const domain of [{}, {...ready,hostState:'HOST_UNHOSTED'}, {...ready,ownershipState:'OWNERSHIP_PENDING'}, {...ready,cert:{state:'CERT_EXPIRED'}}, {...ready,cert:{state:'CERT_EXPIRING_SOON'}}, {...ready,issues:[{message:'Problem'}]}, {...ready,deleteTime:'2026-09-27'}, {...ready,redirectTarget:'pulsepb.com'}]) expect(hostingResult(domain).status).not.toBe('connected');
  });
  it('shows required DNS and certificate records, deduplicating and ignoring completed records', () => {
    const record={domainName:'palace.pulsepb.com',type:'TXT',rdata:'hosting-site=pulse',requiredAction:'ADD'};
    const result=hostingResult({...ready,requiredDnsUpdates:{desired:[{records:[record,{...record,requiredAction:'NONE'}]}]},cert:{state:'CERT_VALIDATING',verification:{dns:{desired:[{records:[record]}]}}}});
    expect(result.status).toBe('action_required'); expect(result.provider_details.dns).toEqual([record]);
  });
  it('reads existing domains without recreating them', async () => {
    const fetcher=vi.fn().mockResolvedValue(response(ready));
    expect((await syncHostingDomain('palace','test-token',fetcher)).status).toBe('connected');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toMatch(/projects\/pulse-pickleball-c60e1\/sites\/pulse-pickleball-c60e1\/customDomains\/palace.pulsepb.com$/);
  });
  it('does not keep an active website pending on retained certificate challenge instructions', () => {
    const record={domainName:'_acme-challenge.palace.pulsepb.com',type:'TXT',rdata:'certificate-proof',requiredAction:'ADD'};
    const cert={state:'CERT_ACTIVE',verification:{dns:{desired:[{records:[record]}]}}};
    expect(hostingResult({...ready,cert})).toMatchObject({status:'connected',provider_details:{dns:[],issues:[]}});
    // Real hosting DNS work and provider issues remain blockers even when an
    // old certificate is already active; never suppress those requirements.
    expect(hostingResult({...ready,cert,requiredDnsUpdates:{desired:[{records:[record]}]}}).status).toBe('action_required');
    expect(hostingResult({...ready,cert:{...cert,issues:[{message:'Domain issue'}]}}).status).toBe('action_required');
    expect(hostingResult({...ready,cert:{...cert,state:'CERT_VALIDATING'}}).status).toBe('action_required');
  });
  it('handles asynchronous create and duplicate-create races without claiming success', async () => {
    for (const status of [200,409]) {
      const fetcher=vi.fn().mockResolvedValueOnce(response({},404)).mockResolvedValueOnce(response({name:'operation'},status)).mockResolvedValueOnce(response({},404));
      expect((await syncHostingDomain('palace','token',fetcher)).status).toBe('provisioning');
      expect(fetcher.mock.calls[1][1]).toMatchObject({method:'POST',body:'{}'});
      expect(fetcher.mock.calls[1][0]).toContain('?customDomainId=palace.pulsepb.com');
    }
  });
  it('reports provider rejection without exposing its raw response', async () => {
    const fetcher=vi.fn().mockResolvedValueOnce(response({},404)).mockResolvedValueOnce(response({secret:'never output'},403));
    await expect(syncHostingDomain('palace','token',fetcher)).rejects.toThrow('HTTP 403');
    await expect(syncHostingDomain('../evil','token',fetcher)).rejects.toThrow('Invalid');
    await expect(connectFirebaseAddress('palace',undefined)).rejects.toThrow('Platform setup needed');
    await expect(connectFirebaseAddress('palace','secret invalid JSON')).rejects.toThrow('not valid JSON');
    await expect(connectFirebaseAddress('palace',JSON.stringify({project_id:'other-project'}))).rejects.toThrow('production PULSE');
  });
});

describe('venue integration Edge Function boundary', () => {
  const venue='10000000-0000-4000-8000-000000000001';
  const request=(body:unknown={action:'sync',venueId:venue})=>new Request('https://example.test',{method:'POST',body:JSON.stringify(body)});
  const deps=():AddressDependencies=>({authorize:vi.fn().mockResolvedValue({actor:'admin'}),claim:vi.fn().mockResolvedValue({slug:'palace',token:'lease'}),connect:vi.fn().mockResolvedValue(hostingResult(ready)),finish:vi.fn().mockResolvedValue(undefined)});
  it('denies unauthenticated and unauthorized callers before privileged work', async () => {
    for (const status of [401,403]) { const d=deps(); d.authorize=vi.fn().mockResolvedValue(response({},status)); expect((await createAddressHandler(d)(request())).status).toBe(status); expect(d.claim).not.toHaveBeenCalled(); expect(d.connect).not.toHaveBeenCalled(); }
  });
  it('accepts only the supported operation and a venue id, not a provider domain', async () => {
    const d=deps(); expect((await createAddressHandler(d)(request({action:'delete',venueId:venue}))).status).toBe(400);
    expect((await createAddressHandler(d)(request({action:'sync',venueId:'https://evil'}))).status).toBe(400); expect(d.claim).not.toHaveBeenCalled();
  });
  it('rejects duplicate checks before calling the provider', async () => {
    const d=deps(); d.claim=vi.fn().mockResolvedValue(null); expect((await createAddressHandler(d)(request())).status).toBe(429); expect(d.connect).not.toHaveBeenCalled();
  });
  it('uses the reserved domain from storage and persists provider failures for admin follow-up', async () => {
    const d=deps(); d.connect=vi.fn().mockRejectedValue(new HostingSetupError('Review hosting limits.'));
    const result=await createAddressHandler(d)(request({action:'sync',venueId:venue,slug:'untrusted'}));
    expect(d.connect).toHaveBeenCalledWith('palace'); expect(await result.json()).toEqual({status:'error'});
    expect(d.finish).toHaveBeenCalledWith(venue,'admin','lease',{status:'error',provider_details:{issues:['Review hosting limits.']}});
  });
  it('does not report success when persistence fails', async () => {
    const d=deps(); d.finish=vi.fn().mockRejectedValue(new Error('db down')); expect((await createAddressHandler(d)(request())).status).toBe(400);
  });
  it('does not persist raw parsing or transport errors that may contain credentials', async () => {
    const d=deps(); d.connect=vi.fn().mockRejectedValue(new SyntaxError('private-provider-response'));
    await createAddressHandler(d)(request());
    expect(d.finish).toHaveBeenCalledWith(venue,'admin','lease',{status:'error',provider_details:{issues:['Hosting check failed. Try again.']}});
  });
});
