import { describe, expect, it, vi } from 'vitest';
import { applyVenueDns, managedRecord } from '../../scripts/venue-address-dns.mjs';
import { addressDatabase, processAddressJobs } from '../../scripts/process-venue-addresses.mjs';

const record = { domainName: 'palace.pulsepb.com', type: 'A', rdata: '199.36.158.100', requiredAction: 'ADD' };
const response = (data: unknown, status=200) => new Response(JSON.stringify(data),{status});
const job = { venue_id:'10000000-0000-4000-8000-000000000001', token:'10000000-0000-4000-8000-000000000002', slug:'palace' };
const pending = () => ({status:'action_required',provider_details:{dns:[record],issues:[]}});

describe('venue DNS automation', () => {
  it('limits writes to additions at the reserved venue or its certificate challenge', () => {
    expect(managedRecord('palace',record)).toEqual({name:'palace',type:'A',data:'199.36.158.100',ttl:600});
    expect(managedRecord('palace',{...record,domainName:'_acme-challenge.palace.pulsepb.com.',type:'TXT',rdata:'"token"'})).toMatchObject({name:'_acme-challenge.palace',data:'token'});
    for (const domainName of ['pulsepb.com','www.pulsepb.com','other.pulsepb.com','palace.pulsepb.com.evil','*.palace.pulsepb.com','arbitrary.palace.pulsepb.com']) expect(managedRecord('palace',{...record,domainName})).toBeNull();
    for (const patch of [{requiredAction:'REMOVE'},{type:'MX'},{type:'NS'}]) expect(managedRecord('palace',{...record,...patch})).toBeNull();
  });
  it('does not call DNS without credentials and provides a concrete setup step', async () => {
    const fetcher=vi.fn();
    const result=await applyVenueDns('palace',[record],undefined,fetcher);
    expect(result.state).toBe('needs_credentials'); expect(result.issues[0]).toContain('GODADDY_DNS_TOKEN'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('adds individual records without replacing or deleting existing data and is idempotent on retry', async () => {
    const fetcher=vi.fn().mockResolvedValueOnce(response({items:[{name:'palace',type:'TXT',data:'existing-proof'}]})).mockResolvedValueOnce(response({},201));
    expect((await applyVenueDns('palace',[record],'secret',fetcher)).state).toBe('awaiting_propagation');
    const [url,options]=fetcher.mock.calls[1];
    expect(url).toBe('https://api.godaddy.com/v3/domains/zones/pulsepb.com/dns-records');
    expect(options.method).toBe('POST'); expect(JSON.parse(options.body)).toEqual({name:'palace',type:'A',data:'199.36.158.100',ttl:600});
    fetcher.mockReset().mockResolvedValue(response({items:[{name:'palace',type:'A',data:record.rdata}]}));
    await applyVenueDns('palace',[record],'secret',fetcher); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not alter conflicting hosts, CNAMEs, or shared parent records', async () => {
    for (const type of ['A','AAAA','CNAME']) {
      const fetcher=vi.fn().mockResolvedValue(response({items:[{name:'palace',type,data:'other-target'}]}));
      expect((await applyVenueDns('palace',[record],'secret',fetcher)).state).toBe('needs_review');
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    const fetcher=vi.fn();
    expect((await applyVenueDns('palace',[{...record,domainName:'pulsepb.com'}],'secret',fetcher)).state).toBe('needs_review');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fails closed on pagination, unexpected host data, and unavailable or expired API access', async () => {
    for (const data of [{items:[],totalPages:2},{items:[{name:'@',type:'A',data:'1.2.3.4'}]},{}]) {
      const fetcher=vi.fn().mockResolvedValue(response(data));
      await expect(applyVenueDns('palace',[record],'secret',fetcher)).rejects.toThrow(/incomplete/); expect(fetcher).toHaveBeenCalledTimes(1);
    }
    await expect(applyVenueDns('palace',[record],'secret',vi.fn().mockResolvedValue(response({message:'private raw response'},403)))).rejects.toThrow('HTTP 403');
  });
});

describe('automatic address worker', () => {
  const deps=()=>({claim:vi.fn().mockResolvedValue([job]),connect:vi.fn().mockImplementation(async()=>pending()),dns:vi.fn().mockResolvedValue({state:'awaiting_propagation',issues:[]}),finish:vi.fn().mockResolvedValue(undefined)});
  it('keeps DNS propagation pending until a later Firebase HTTPS check succeeds', async () => {
    const d=deps(); const counts=await processAddressJobs(d);
    expect(counts).toMatchObject({processed:1,provisioning:1,connected:0});
    expect(d.finish.mock.calls[0][1]).toMatchObject({status:'provisioning',provider_details:{dns:[record],dns_automation:'awaiting_propagation'}});
    d.connect.mockResolvedValue({status:'connected',provider_details:{host:'HOST_ACTIVE',ownership:'OWNERSHIP_ACTIVE',certificate:'CERT_ACTIVE',dns:[],issues:[]}});
    expect((await processAddressJobs(d)).connected).toBe(1);
    expect(d.dns).toHaveBeenCalledTimes(1);
  });
  it('retains actionable DNS instructions and does not hide provider blockers after adding records', async () => {
    const d=deps(); d.dns.mockResolvedValue({state:'needs_credentials',issues:['Connect DNS']});
    expect((await processAddressJobs(d)).action_required).toBe(1);
    expect(d.finish.mock.calls[0][1].provider_details.dns).toEqual([record]);
    d.connect.mockResolvedValue({status:'action_required',provider_details:{dns:[record],issues:['Hosting conflict']}});
    d.dns.mockResolvedValue({state:'awaiting_propagation',issues:[]});
    expect((await processAddressJobs(d)).action_required).toBe(1);
  });
  it('sanitizes unexpected failures, preserves pending records and continues the batch', async () => {
    const d=deps(); d.claim.mockResolvedValue([job,{...job,slug:'other'}]);
    d.dns.mockRejectedValueOnce(new Error('private transport data'));
    const result=await processAddressJobs(d);
    expect(result).toMatchObject({processed:2,error:1,provisioning:1});
    expect(d.finish.mock.calls[0][1].provider_details.dns).toEqual([record]);
    expect(JSON.stringify(d.finish.mock.calls)).not.toContain('private transport data');
  });
  it('does not count unpersisted results as completed', async () => {
    const d=deps(); d.finish.mockRejectedValue(new Error('offline'));
    expect(await processAddressJobs(d)).toMatchObject({processed:0,persistence_errors:1});
  });
  it('restricts the database destination, validates leases, and escapes provider data', async () => {
    const fetcher=vi.fn().mockResolvedValue(response([]));
    expect(()=>addressDatabase('sbp_fixture','wrong-project',fetcher)).toThrow(/Production/);
    const d=addressDatabase('sbp_fixture','rqfqwavhtfwwtmfjnxkx',fetcher);
    await expect(async()=>d.finish({...job,token:"'); SELECT secret; --"},pending())).rejects.toThrow(/Invalid/);
    expect(fetcher).not.toHaveBeenCalled();
    await d.finish(job,{status:'error',provider_details:{issues:["it's not SQL; '); SELECT secret; --"]}});
    const body=JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.query).not.toContain("SELECT secret");
    expect(body.query).toContain(Buffer.from(JSON.stringify({issues:["it's not SQL; '); SELECT secret; --"]})).toString('hex'));
    expect(body.query).toContain('public.finish_venue_address_job');
  });
});
