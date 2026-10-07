import { planCreationSchedulePreview } from '../../../src/lib/roundRobin/creationSchedulePreview';
import { recordRead } from './performance';
// UI fixtures only: no backend, credentials, invitations or production mutations.
const params = new URLSearchParams(window.location.search);
const playerView = params.has('player');
const user = { id: params.has('spectator') ? 'spectator' : playerView ? 'player-0' : 'preview-host' };
export const useAuthState = () => ({ user, loading: false });
const profiles = ['Alex Morgan', 'Jordan Lee', 'Sam Rivera', 'Taylor Chen', 'Casey Brooks', 'Jamie Park', 'Drew Ellis', 'Riley Quinn'].map((name,i) => ({ id:`player-${i}`, full_name:name, display_name:name, current_rating:3.5+i/10, gender:i%2?'female':'male',avatar_url:null }));
const latency = Math.max(0, Math.min(2000, Number(params.get('latency')) || 0));
const delay = () => new Promise(resolve => setTimeout(resolve, latency));
const mutationDelay = () => new Promise(resolve => setTimeout(resolve, params.has('slow') ? 5000 : latency));
const status = params.has('draft') ? 'draft' : params.has('completed') ? 'completed' : params.has('voided') ? 'voided' : 'live';
const event = { schedule_version:0, id:'preview-event',name:'Golden Hour · Sunday Social',date:'2026-09-21',start_time:'17:30:00',location:'Riverside Pickleball Club',notes:'Check in at the clubhouse. Bring water, your paddle, and your best game.',organizer_id:'preview-host',num_courts:2,num_rounds:3,games_per_player:3,current_round:status==='completed'?3:status==='draft'?1:2,status,voided:status==='voided',rating_eligible:true,rating_type:'league',format:'open',allow_guests:false,registration_mode:'invite_only',invite_code:'PULSE-QA',event_mode:'immediate',max_players:16 };
if (params.has('large')) {
  for (let i = profiles.length; i < 32; i++) profiles.push({ id: `player-${i}`, full_name: `Player ${i}`, display_name: `Player ${i}`, current_rating: 3.5, gender: i % 2 ? 'female' : 'male', avatar_url: null });
  Object.assign(event, { num_courts: 8, num_rounds: 20, games_per_player: 20, format: 'mixed' });
}
const roster = profiles.map((p,i)=>({id:`roster-${i}`,event_id:event.id,player_id:p.id,guest_player_id:null,active:true,status:'confirmed',registration_status:'confirmed',profiles:p}));
const pairings = [[[0,1,2,3],[4,5,6,7]],[[0,2,4,6],[1,3,5,7]],[[0,3,5,6],[1,2,4,7]]];
const schedule = params.has('empty') ? [] : pairings.flatMap((round,r)=>round.map((seats,c)=>({id:`match-${r}-${c}`,event_id:event.id,round_no:r+1,court_no:c+1,a1_player_id:`player-${seats[0]}`,a2_player_id:`player-${seats[1]}`,b1_player_id:`player-${seats[2]}`,b2_player_id:`player-${seats[3]}`,a1_guest_id:null,a2_guest_id:null,b1_guest_id:null,b2_guest_id:null,is_bye:false,team1_score:status==='completed'||(r===0&&status!=='draft')?11:null,team2_score:status==='completed'||(r===0&&status!=='draft')?7+c:null,match_id:null,locked_at:null,abandoned:false,voided_at:null,superseded_by_schedule_id:null})));
if (params.has('large')) {
  const plan = planCreationSchedulePreview({ participants: profiles, numCourts: 8, gamesPerPlayer: 20, equalGames: true, format: 'mixed' })!;
  if (!plan.ok) throw new Error('Large fixture needs a valid schedule');
  const base = schedule[0];
  schedule.splice(0, schedule.length, ...plan.schedule.map((match, i) => ({ ...base, id: `large-${i}`, round_no: match.round_no, court_no: match.court_no, is_bye: match.is_bye, a1_player_id: match.a1?.slice(2) ?? null, a2_player_id: match.a2?.slice(2) ?? null, b1_player_id: match.b1?.slice(2) ?? null, b2_player_id: match.b2?.slice(2) ?? null, team1_score: match.round_no < event.current_round ? 11 : null, team2_score: match.round_no < event.current_round ? 7 : null })));
}
if (params.has('manycourts')) {
  event.num_courts = 12;
  const original = [...schedule];
  for (let court = 3; court <= 12; court++) {
    for (let round = 1; round <= 3; round++) {
      const base = original.find(match => match.round_no === round)!;
      schedule.push({ ...base, id: `extra-${round}-${court}`, court_no: court });
    }
  }
}
const mutationAttempts = new Set<string>();
const listeners = new Map<object, (() => void)[]>();
function createChannel() {
  const callbacks: (() => void)[] = [];
  const channel = { on: (_type: string, _filter: unknown, callback: () => void) => { callbacks.push(callback); return channel; }, subscribe: () => channel, unsubscribe: () => listeners.delete(channel) };
  listeners.set(channel, callbacks);
  return channel;
}
export function advancePreviewRound() {
  event.current_round = Math.min(event.num_rounds, event.current_round + 1);
  for (const callbacks of listeners.values()) callbacks.forEach(callback => callback());
}
if (params.has('rest') && schedule[2]) { schedule[2].is_bye = true; }
if (params.has('scored') && schedule[2]) { schedule[2].team1_score = 11; schedule[2].team2_score = 0; }
if (params.has('longnames')) {
  event.name = 'Golden Hour Community Championship · End of Summer Round Robin';
  profiles[0].full_name = profiles[0].display_name = 'Alexandra Montgomery-Richardson';
  profiles[2].full_name = profiles[2].display_name = 'Samuel Christopher Rivera';
}
export const supabase = {
  auth:{ getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>undefined}}}) },
  channel:createChannel,removeChannel:(channel:object)=>listeners.delete(channel),
  rpc:(name:string, args:Record<string,unknown> = {})=>{
    const execute=async()=>{
    recordRead(`rpc:${name}`);
    await (name === 'can_manage_round_robin' ? delay() : mutationDelay());
    if(name === "can_manage_round_robin") return {data:user.id === event.organizer_id,error:null};
    // Opt-in command-center QA only changes these in-memory fixtures.
    const controls = ['rr_start_event','rr_update_event_settings','rr_edit_schedule','rr_remove_match_result','submit_rr_match_score'];
    if (params.has('retry') && controls.includes(name) && !mutationAttempts.has(name)) {
      mutationAttempts.add(name);
      return {data:null,error:{message:'Fixture network interruption. Please retry.'}};
    }
    if (params.has('command') && name === 'rr_start_event') {
      event.status='live'; event.current_round=1; event.schedule_version++;
      return {data:{current_round:1,already_started:false},error:null};
    }
    if (params.has('command') && name === 'rr_update_event_settings') {
      Object.assign(event,args.p_updates); event.schedule_version++;
      return {data:true,error:null};
    }
    if (params.has('command') && name === 'rr_remove_match_result') {
      const match=schedule.find(row=>row.id===args.p_schedule_id);
      if (match) Object.assign(match,{abandoned:true,abandoned_reason:'Result voided by host'});
      event.schedule_version++;
      return {data:true,error:null};
    }
    if (params.has('command') && name === 'rr_edit_schedule') {
      const match=schedule.find(row=>row.id===args.p_match_id);
      if(match && args.p_action==='rotate_partners') [match.a2_player_id,match.b1_player_id]=[match.b1_player_id,match.a2_player_id];
      if(match && args.p_action==='move_court') {
        const other=schedule.find(row=>row.round_no===match.round_no&&row.court_no===args.p_new_court_no);
        if(other) other.court_no=match.court_no;
        match.court_no=Number(args.p_new_court_no);
      }
      event.schedule_version++;
      return {data:{ok:true},error:null};
    }

    if (params.has('command') && name === 'submit_rr_match_score' && !params.has('saveerror')) {
      const match = schedule.find(row => row.id === args.p_schedule_id);
      if (match) { match.team1_score = Number(args.p_team1_score); match.team2_score = Number(args.p_team2_score); }
      return {data:`history-${String(args.p_schedule_id)}`,error:null};
    }
    if (params.has('command') && name === 'rr_close_round') {
      advancePreviewRound();
      return {data:event.current_round,error:null};
    }
    if(params.has('command') && name === 'rr_complete_event') {
      event.status='completed';
      return {data:{synced_total:schedule.filter(m=>m.team1_score!==null).length},error:null};
    }
    return {data:null,error:{message:'This preview does not submit event changes.'}};
    };
    const chain={abortSignal:()=>chain,then:(resolve:(v:unknown)=>unknown,reject?:(e:unknown)=>unknown)=>execute().then(resolve,reject)};
    return chain;
  },
  functions:{invoke:async(name:string)=>{
    recordRead(`function:${name}`);
    await mutationDelay();
    if (params.has('retry') && !mutationAttempts.has(name)) {
      mutationAttempts.add(name);
      return { data:null,error:{message:'Fixture network interruption. Please retry.'} };
    }
    if (params.has('command') && name === 'generate-round-robin-schedule') {
      event.schedule_version++;
      return {data:{num_rounds:event.num_rounds,impact:{summary:'Preview schedule refreshed.'}},error:null};
    }
    return {data:null,error:{message:'This preview does not submit event changes.'}};
  }},
  from:(table:string)=>{
    let single=false;
    let rows:Record<string,unknown>[] = table==='round_robin_events'?[event]:table==='round_robin_players'?roster:table==='round_robin_schedule'?schedule:table==='profiles_public'?profiles:table==='round_robin_audit'?[{id:'audit-1',change_type:'event_create',editor_id:'player-0',changes:{after:{name:event.name}},created_at:'2026-09-21T12:00:00Z',reason:'Event created'}]:[];
    const result=()=>({data:structuredClone(single?rows[0]??null:rows),error:null});
    const chain={
      select:()=>chain,order:()=>chain,eq:()=>chain,is:(key:string,value:unknown)=>{rows=rows.filter(row=>row[key]==value);return chain;},in:()=>chain,not:()=>chain,or:()=>chain,limit:()=>chain,abortSignal:()=>chain,
      range:(start:number,end:number)=>{rows=rows.slice(start,end+1);return chain;},
      single:()=>{single=true;return chain;},maybeSingle:()=>{single=true;return chain;},
      update:()=>{throw new Error('Preview changes are disabled.');},insert:()=>{throw new Error('Preview changes are disabled.');},delete:()=>{throw new Error('Preview changes are disabled.');},
      then:(resolve:(v:ReturnType<typeof result>)=>unknown)=>{recordRead(table);return delay().then(result).then(resolve);},
    };
    return chain;
  },
};
