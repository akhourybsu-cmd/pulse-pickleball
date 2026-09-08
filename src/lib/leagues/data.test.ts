import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mock }));
import { leagueRows, leagueRowsByIds, leagueProfiles } from './data';

function database(rows: {id:string; season_id?:string}[], failAt = -1) {
  const requests: {from:number;to:number;ids?:string[];filters:Record<string,string>}[] = [];
  mock.from.mockImplementation(() => {
    const request = {from:0,to:999,ids:undefined as string[]|undefined,filters:{} as Record<string,string>};
    const q = {
      select: () => q, order: () => q, abortSignal: () => q,
      eq: (key:string,value:string) => {request.filters[key]=value;return q;},
      in: (_key:string,ids:string[]) => {request.ids=ids;return q;},
      range: (from:number,to:number) => {request.from=from;request.to=to;return q;},
      then: (resolve:(value:unknown)=>unknown) => {
        const index=requests.length;requests.push(request);
        const filtered=rows.filter(r => (!request.ids || request.ids.includes(r.id)) && Object.entries(request.filters).every(([key,v])=>r[key as keyof typeof r]===v));
        return Promise.resolve({data:index===failAt?null:filtered.slice(request.from,request.to+1),error:index===failAt?{message:'Connection interrupted'}:null}).then(resolve);
      },
    };return q;
  });
  return requests;
}
beforeEach(()=>vi.clearAllMocks());
describe('complete league datasets',()=>{
  it('pages beyond the API row cap without mixing seasons',async()=>{
    const rows=Array.from({length:1203},(_,i)=>({id:`m${i}`,season_id:'current'}));
    const requests=database([...rows,{id:'old',season_id:'old'}]);
    expect(await leagueRows('league_matches',{season_id:'current'})).toEqual(rows);
    expect(requests.map(r=>r.from)).toEqual([0,500,1000]);
  });
  it('checks the final empty page for an exact multiple',async()=>{
    const requests=database(Array.from({length:500},(_,i)=>({id:String(i)})));
    expect(await leagueRows('league_matches',{})).toHaveLength(500);
    expect(requests).toHaveLength(2);
  });
  it('rejects partial data if a later page fails',async()=>{
    database(Array.from({length:501},(_,i)=>({id:String(i)})),1);
    await expect(leagueRows('league_matches',{})).rejects.toEqual({message:'Connection interrupted'});
  });
  it('chunks and deduplicates profile requests',async()=>{
    const rows=Array.from({length:451},(_,i)=>({id:String(i)}));const requests=database(rows);
    expect(await leagueProfiles([...rows.map(r=>r.id),'0'])).toEqual(rows);
    expect(requests.map(r=>r.ids?.length)).toEqual([200,200,51]);
  });
  it('does not query for an empty ID set',async()=>{
    const requests=database([]);expect(await leagueRowsByIds('ladder_batches',[])).toEqual([]);expect(requests).toEqual([]);
  });
  it('surfaces profile lookup failures',async()=>{
    database([{id:'p'}],0);await expect(leagueProfiles(['p'])).rejects.toEqual({message:'Connection interrupted'});
  });
});
