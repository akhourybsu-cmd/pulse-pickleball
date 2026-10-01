import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rows: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {getUser:async()=>({data:{user:{id:'me'}}})},
  from:mocks.from,
} }));
import { useGroupPosts } from '@/hooks/useGroupPosts';
let view: ReactTestRenderer;
let client: QueryClient;
let result: ReturnType<typeof useGroupPosts>;
function Harness({enabled}:{enabled:boolean}) {result=useGroupPosts('club',{enabled});return null;}
beforeEach(()=>{
  client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  mocks.rows=[{id:'older-post',user_id:'friend',type:'feed',content:'An existing update'}];
  mocks.from.mockReset().mockImplementation((table:string)=>{
    const query={select:()=>query,eq:()=>query,order:()=>query,in:()=>query,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:table==='group_posts'?mocks.rows:[],error:null}).then(resolve)};
    return query;
  });
});
afterEach(()=>{act(()=>view.unmount());client.clear();});
it('does not load the feed for a parent that only needs the composer mutation',async()=>{
  await act(async()=>{view=create(<QueryClientProvider client={client}><Harness enabled={false}/></QueryClientProvider>);});
  expect(mocks.from).not.toHaveBeenCalled();
});
it('reconciles a partial realtime cache when the feed first becomes visible',async()=>{
  client.setQueryData(['group-posts','club'],[{id:'new-post',type:'feed',content:'A realtime update'}]);
  mocks.rows.push({id:'new-post',user_id:'me',type:'feed',content:'A realtime update'});
  await act(async()=>{view=create(<QueryClientProvider client={client}><Harness enabled/></QueryClientProvider>);});
  await vi.waitFor(()=>expect(result.posts).toHaveLength(2));
  expect(result.posts.map(post=>post.id)).toEqual(['older-post','new-post']);
  expect(mocks.from).toHaveBeenCalledWith('group_posts');
});
