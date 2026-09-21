// UI fixtures only: no backend, credentials, invitations or production mutations.
const params = new URLSearchParams(window.location.search);
const playerView = params.has('player');
const user = { id: playerView ? 'player-0' : 'preview-host' };
export const useAuthState = () => ({ user, loading: false });
const profiles = ['Alex Morgan', 'Jordan Lee', 'Sam Rivera', 'Taylor Chen', 'Casey Brooks', 'Jamie Park', 'Drew Ellis', 'Riley Quinn'].map((name,i) => ({ id:`player-${i}`, full_name:name, display_name:name, current_rating:3.5+i/10, gender:i%2?'female':'male',avatar_url:null }));
const status = params.has('draft') ? 'draft' : params.has('completed') ? 'completed' : params.has('voided') ? 'voided' : 'live';
const event = { id:'preview-event',name:'Golden Hour · Sunday Social',date:'2026-09-21',start_time:'17:30:00',location:'Riverside Pickleball Club',notes:'Check in at the clubhouse. Bring water, your paddle, and your best game.',organizer_id:'preview-host',num_courts:2,num_rounds:3,games_per_player:3,current_round:status==='completed'?3:status==='draft'?1:2,status,voided:status==='voided',rating_eligible:true,rating_type:'league',format:'open',allow_guests:false,registration_mode:'invite_only',invite_code:'PULSE-QA',event_mode:'immediate',max_players:16 };
const roster = profiles.map((p,i)=>({id:`roster-${i}`,event_id:event.id,player_id:p.id,guest_player_id:null,active:true,status:'confirmed',registration_status:'confirmed',profiles:p}));
const pairings = [[[0,1,2,3],[4,5,6,7]],[[0,2,4,6],[1,3,5,7]],[[0,3,5,6],[1,2,4,7]]];
const schedule = params.has('empty') ? [] : pairings.flatMap((round,r)=>round.map((seats,c)=>({id:`match-${r}-${c}`,event_id:event.id,round_no:r+1,court_no:c+1,a1_player_id:`player-${seats[0]}`,a2_player_id:`player-${seats[1]}`,b1_player_id:`player-${seats[2]}`,b2_player_id:`player-${seats[3]}`,a1_guest_id:null,a2_guest_id:null,b1_guest_id:null,b2_guest_id:null,is_bye:false,team1_score:status==='completed'||r===0?11:null,team2_score:status==='completed'||r===0?7+c:null,match_id:null,locked_at:null,abandoned:false,voided_at:null,superseded_by_schedule_id:null})));
const channel = {on:()=>channel,subscribe:()=>channel,unsubscribe:()=>undefined};
export const supabase = {
  auth:{ getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>undefined}}}) },
  channel:()=>channel,removeChannel:()=>undefined,
  rpc:async()=>({data:null,error:{message:'This preview does not submit event changes.'}}),
  functions:{invoke:async()=>({data:null,error:{message:'This preview does not submit event changes.'}})},
  from:(table:string)=>{
    let single=false;
    let rows:Record<string,unknown>[] = table==='round_robin_events'?[event]:table==='round_robin_players'?roster:table==='round_robin_schedule'?schedule:table==='profiles_public'?profiles:table==='round_robin_audit'?[{id:'audit-1',change_type:'event_create',editor_id:'player-0',changes:{after:{name:event.name}},created_at:'2026-09-21T12:00:00Z',reason:'Event created'}]:[];
    const result=()=>({data:single?rows[0]??null:rows,error:null});
    const chain={
      select:()=>chain,order:()=>chain,eq:()=>chain,is:()=>chain,in:()=>chain,not:()=>chain,or:()=>chain,limit:()=>chain,abortSignal:()=>chain,
      range:(start:number,end:number)=>{rows=rows.slice(start,end+1);return chain;},
      single:()=>{single=true;return chain;},maybeSingle:()=>{single=true;return chain;},
      update:()=>{throw new Error('Preview changes are disabled.');},insert:()=>{throw new Error('Preview changes are disabled.');},delete:()=>{throw new Error('Preview changes are disabled.');},
      then:(resolve:(v:ReturnType<typeof result>)=>unknown)=>Promise.resolve(result()).then(resolve),
    };
    return chain;
  },
};
