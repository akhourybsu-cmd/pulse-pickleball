/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components -- Isolated, deliberately generic Supabase test double. */
import React, {createContext,useContext} from 'react';

type Row=Record<string,any>;
let currentUser='owner';
const UserContext=createContext('owner');
export function QaAuth({user,children}:{user:string;children:React.ReactNode}) {currentUser=user;return <UserContext.Provider value={user}>{children}</UserContext.Provider>}
export function useAuthState(){const id=useContext(UserContext);return {user:{id},loading:false,profile:null};}
export const isSkillAssessmentEnabled=()=>false;
const stamp='2026-09-01T12:00:00Z';
const base={created_at:stamp,updated_at:stamp};
const league={...base,id:'league',name:'ELEVENO Community Doubles League',description:'Weekly play, welcoming competition, and an organized season.',created_by:'owner',status:'active',visibility:'private',league_type:'doubles',location:'ELEVENO • Main courts',rating_eligible:false,guests_allowed:true,invite_code:'ELEVENO26',skill_min:null,skill_max:null};
const seasons=[{...base,id:'season',league_id:'league',name:'Autumn 2026 • Community season',status:'active',start_date:'2026-09-01',end_date:'2026-12-01',registration_deadline:'2026-10-01'},
  {...base,id:'old',league_id:'league',name:'Summer 2026 • Previous season',status:'completed',start_date:'2026-05-01',end_date:'2026-08-01',registration_deadline:null}];
const profiles=['Alex Organizer','Charlotte A Very Long Player Name','Mateo Rivera','Jordan Lee','Sam Substitute','Taylor Assistant'].map((name,i)=>({id:['owner','player','p3','p4','sub','assistant'][i],display_name:name,full_name:name,avatar_url:null,first_name:name.split(' ')[0],last_name:name.split(' ').slice(1).join(' ')}));
export const tables:Record<string,Row[]>={
  leagues:[league],league_seasons:seasons,profiles_public:profiles,
  league_members:profiles.filter(p=>p.id!=='sub').map((p,i)=>({...base,id:`mem${i}`,league_id:'league',season_id:'season',user_id:p.id,role:p.id==='assistant'?'manager':'player',status:p.id==='p4'?'pending':'active',joined_at:stamp})),
  league_teams:[{...base,id:'team-a',league_id:'league',season_id:'season',name:'The Long-Named Cross-Court Crew',status:'active',captain_user_id:'owner'}, {...base,id:'team-b',league_id:'league',season_id:'season',name:'Kitchen Collective',status:'active',captain_user_id:'p3'}],
  league_team_members:['owner','player','p3','p4'].map((id,i)=>({...base,id:`tm${i}`,team_id:i<2?'team-a':'team-b',user_id:id,status:'active',role:'player'})),
  league_sessions:[{...base,id:'session',league_id:'league',season_id:'season',name:'Week 1 • Thursday evening',scheduled_date:'2026-09-10',start_time:'18:00',end_time:'20:00',court_count:4,location:'ELEVENO — Courts 1–4',status:'published'}],
  league_matches:['scheduled','score_submitted','verified','disputed'].map((status,i)=>({...base,id:`match${i}`,league_id:'league',season_id:'season',session_id:'session',court_number:i+1,scheduled_time:`2026-09-10T${18+i}:00:00Z`,team_a_id:'team-a',team_b_id:'team-b',player_a_id:'owner',player_b_id:'player',player_c_id:'p3',player_d_id:'p4',status,team_a_score:i?11:null,team_b_score:i?7:null,verified_by:i?['p3']:[],score_submitted_by:i?'p3':null,score_submitted_at:i?stamp:null,dispute_reason:status==='disputed'?'Please check the score.':null,forfeit_winner_team_id:null,ladder_batch_group_id:null,linked_match_id:null})),
  league_substitutes:[{...base,id:'subrow',league_id:'league',season_id:'season',user_id:'sub',notes:'Available for evening play',status:'active'}],
  league_audit_log:[],
};
const ladderPreview = new URLSearchParams(window.location.search);
if (ladderPreview.has('ladder')) {
  league.league_type='ladder'; league.status=ladderPreview.has('active')?'active':'draft';
  seasons[0].status=ladderPreview.has('active')?'active':'draft';
  tables.ladder_settings=[{...base,id:'settings',league_id:'league',season_id:'season',status:'active',batches_per_week:2,total_weeks:5,court_count:1,movement_rule:'one_up_one_down',initial_order_source:'manual',auto_advance:false}];
  tables.ladder_batches=[{...base,id:'batch1',league_id:'league',season_id:'season',session_id:'session',week_number:1,batch_number:1,status:'finalized',start_snapshot_id:'initial',result_snapshot_id:'result'}];
  tables.ladder_snapshots=[{id:'result',season_id:'season',player_ids:['owner','player','p3','p4']}];
  tables.league_sessions[0].week_number=1;
}
function from(table:string) {
  const filters:((r:Row)=>boolean)[]=[];let single=false;let range:[number,number]=[0,999999];let op='read';let payload:Row|Row[]={};let opts:Row={};
  const q:Row={
    select:(_cols?:string, options:Row={})=>{opts=options;return q},eq:(key:string,val:unknown)=>{filters.push(r=>r[key]===val);return q},
    neq:(key:string,val:unknown)=>{filters.push(r=>r[key]!==val);return q},in:(key:string,val:unknown[])=>{filters.push(r=>val.includes(r[key]));return q},
    not:(key:string,_op:string,val:unknown)=>{filters.push(r=>r[key]!==val);return q},or:()=>q,ilike:()=>q,
    order:()=>q,limit:(n:number)=>{range=[0,n-1];return q},range:(a:number,b:number)=>{range=[a,b];return q},
    abortSignal:()=>q,throwOnError:()=>q,
    maybeSingle:()=>{single=true;return q},single:()=>{single=true;return q},
    insert:(p:Row|Row[])=>{op='insert';payload=p;return q},update:(p:Row)=>{op='update';payload=p;return q},
    upsert:(p:Row)=>{op='insert';payload=p;return q},delete:()=>{op='delete';return q},
    then:(resolve:(result:Row)=>unknown,reject:(e:unknown)=>unknown)=>Promise.resolve().then(()=>{
      const all=tables[table]??[];let rows=all.filter(r=>filters.every(test=>test(r)));
      if(op==='insert'){rows=(Array.isArray(payload)?payload:[payload]).map(p=>({...base,id:crypto.randomUUID(),...p}));tables[table]=[...all,...rows]}
      if(op==='update'){rows.forEach(r=>Object.assign(r,payload,{updated_at:new Date().toISOString()}))}
      const count=rows.length;rows=rows.slice(range[0],range[1]+1).map(r=>({...r}));
      return {data:opts.head?null:single?rows[0]??null:rows,error:null,count};
    }).then(resolve,reject),
  };return q;
}
export const supabase={from,auth:{getUser:async()=>({data:{user:{id:currentUser}},error:null}),getSession:async()=>({data:{session:{user:{id:currentUser}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:async(name:string)=>({data:name==='is_league_admin'?currentUser==='owner'||currentUser==='assistant':[],error:null}),
  functions:{invoke:async()=>({data:null,error:Object.assign(new Error('Edge Function returned a non-2xx status code'),{
    context:Response.json({error:'Activate the league and season before starting or advancing its ladder'},{status:400}),
  })})},channel:()=>{const c={on:()=>c,subscribe:()=>c};return c},removeChannel:async()=>{},
};
