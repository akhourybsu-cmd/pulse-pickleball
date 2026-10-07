import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlayerManagementDialog } from '@/components/round-robin/PlayerManagementDialog';

const activity=vi.hoisted(()=>({done:vi.fn(),fail:vi.fn()}));
vi.mock('@/components/ui/avatar',()=>({
  Avatar:({children}: {children:React.ReactNode})=><span>{children}</span>,
  AvatarFallback:({children}: {children:React.ReactNode})=><span>{children}</span>,
  AvatarImage:()=>null,
}));
vi.mock('@/components/ui/pulse-activity',()=>({startPulseActivity:()=>activity}));
vi.mock('@/components/round-robin/ResponsiveSettingsModal',()=>({
  ResponsiveSettingsModal:({children,footer,onOpenChange,busy}: {children:React.ReactNode;footer:React.ReactNode;onOpenChange:(open:boolean)=>void;busy:boolean})=><div><button onClick={()=>onOpenChange(false)}>Dismiss sheet</button><fieldset disabled={busy}>{children}</fieldset>{footer}</div>,
  ModalActions:({children}: {children:React.ReactNode})=><div>{children}</div>,
}));
vi.mock('@/components/round-robin/PlayerPickerSheet',()=>({
  PlayerPickerSheet:({excludePlayerIds,onPlayersChange}: {excludePlayerIds:string[];onPlayersChange:(p:unknown[])=>void})=>
    <button data-excluded={excludePlayerIds} onClick={()=>onPlayersChange([{id:'p5',isGuest:false,full_name:'John',display_name:'John'}])}>Pick John</button>,
}));
vi.mock('@/components/ui/select',()=>{
  const Box=({children}: {children:React.ReactNode})=><>{children}</>;
  return { Select:({value,onValueChange,children}: {value:string;onValueChange:(v:string)=>void;children:React.ReactNode})=><select value={value} onChange={e=>onValueChange(e.target.value)}>{children}</select>,
    SelectContent:Box,SelectTrigger:Box,SelectValue:()=>null,SelectItem:({value,children}: {value:string;children:React.ReactNode})=><option value={value}>{children}</option> };
});
let root:ReactTestRenderer;
beforeEach(()=>vi.clearAllMocks());
afterEach(()=>act(()=>root?.unmount()));
const text=(n:ReactTestInstance|string):string=>typeof n==='string'?n:n.children.map(text).join('');
const button=(label:string)=>root.root.findAllByType('button').find(b=>text(b)===label)!;
const props={open:true,onOpenChange:vi.fn(),eventStatus:'live' as const,currentRound:3,totalRounds:7,hasSchedule:true,firstAdjustableRound:4,eventFormat:'open' as const,
  players:Array.from({length:6},(_,i)=>({id:`r${i}`,player_id:`p${i}`,active:true,profiles:{id:`p${i}`,full_name:`Player ${i}`,display_name:null}})),
  onAddPlayers:vi.fn().mockResolvedValue(1),onMarkInactive:vi.fn().mockResolvedValue(true),onSubstitute:vi.fn().mockResolvedValue(undefined)};
const openMode=async(label:string)=>{
  await act(async()=>{root=create(<PlayerManagementDialog {...props} />)});
  await act(async()=>root.root.findAllByType('button').find(b=>text(b).includes(label))!.props.onClick());
};
it('allows a resting roster member and sends current-plus-future scope',async()=>{
  await openMode('Substitute player');
  await act(async()=>root.root.findAllByType('select')[0].props.onChange({target:{value:'r0'}}));
  expect(button('Pick John').props['data-excluded']).toEqual(['p0']);
  await act(async()=>button('Pick John').props.onClick());
  await act(async()=>root.root.findAllByType('select')[1].props.onChange({target:{value:'current_future'}}));
  expect(root.root.findAllByType('select')[1].props.value).toBe('current_future');
  await act(async()=>button('Substitute Player').props.onClick());
  expect(props.onSubstitute).toHaveBeenCalledWith('r0',{playerId:'p5',guestPlayerId:null,guestName:undefined},'current_future',false);
});
it('does not report removal before confirmation or after cancellation',async()=>{
  let resolve!:(v:boolean)=>void;
  props.onMarkInactive.mockImplementationOnce(()=>new Promise<boolean>(r=>{resolve=r}));
  await openMode('Remove from roster');
  await act(async()=>button('Remove from roster').props.onClick());
  let pending:Promise<void>;
  await act(async()=>{pending=button('Remove').props.onClick()});
  expect(activity.done).not.toHaveBeenCalled();
  await act(async()=>{resolve(false);await pending});
  expect(activity.done).not.toHaveBeenCalledWith('Roster updated');
  expect(activity.done).toHaveBeenCalledWith('Removal cancelled');
});
it('leaves failed substitutions ready to retry without a success animation',async()=>{
  props.onSubstitute.mockRejectedValueOnce(new Error('Schedule changed'));
  await openMode('Substitute player');
  await act(async()=>root.root.findAllByType('select')[0].props.onChange({target:{value:'r0'}}));
  await act(async()=>button('Pick John').props.onClick());
  await act(async()=>button('Substitute Player').props.onClick());
  expect(activity.fail).toHaveBeenCalled();
  expect(activity.done).not.toHaveBeenCalled();
  expect(button('Substitute Player').props.disabled).toBe(false);
});
it('keeps the balanced fallback opt-in and sends it only when checked',async()=>{
  await act(async()=>{root=create(<PlayerManagementDialog {...props} equalGames />)});
  await act(async()=>root.root.findAllByType('button').find(b=>text(b).includes('Substitute player'))!.props.onClick());
  const checkbox=()=>root.root.findAllByType('input').find(i=>i.props.type==='checkbox')!;
  expect(checkbox().props.checked).toBe(false);
  await act(async()=>checkbox().props.onChange({target:{checked:true}}));
  await act(async()=>root.root.findAllByType('select')[0].props.onChange({target:{value:'r0'}}));
  await act(async()=>button('Pick John').props.onClick());
  await act(async()=>button('Substitute Player').props.onClick());
  expect(props.onSubstitute).toHaveBeenCalledWith('r0',{playerId:'p5',guestPlayerId:null,guestName:undefined},'global',true);
});

it.each(['add', 'substitute'] as const)('locks %s inputs and dismissal, suppresses double taps, and unlocks for retry', async mode => {
  let fail!: (error: Error) => void;
  const mutation = mode === 'add' ? props.onAddPlayers : props.onSubstitute;
  mutation.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  await openMode(mode === 'add' ? 'Add player' : 'Substitute player');
  if (mode === 'substitute') await act(async () => root.root.findAllByType('select')[0].props.onChange({target:{value:'r0'}}));
  await act(async () => button('Pick John').props.onClick());
  const label = mode === 'add' ? 'Add Player' : 'Substitute Player';
  const submit = button(label).props.onClick;
  let pending!: Promise<void>;
  await act(async () => { pending = submit(); void submit(); });
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(button('Back').props.disabled).toBe(true);
  expect(button('Cancel').props.disabled).toBe(true);
  expect(root.root.findByType('fieldset').props.disabled).toBe(true);
  await act(async () => { button('Dismiss sheet').props.onClick(); button('Back').props.onClick(); });
  expect(props.onOpenChange).not.toHaveBeenCalled();
  await act(async () => { fail(new Error('Connection interrupted')); await pending; });
  expect(activity.done).not.toHaveBeenCalled();
  expect(button(label).props.disabled).toBe(false);
  expect(root.root.findByType('fieldset').props.disabled).toBe(false);
  await act(async () => button(label).props.onClick());
  expect(mutation).toHaveBeenCalledTimes(2);
});

it('does not send another removal or dismiss the roster while a live-match decision is pending', async () => {
  let cancel!: (value: boolean) => void;
  props.onMarkInactive.mockImplementationOnce(() => new Promise<boolean>(resolve => { cancel = resolve; }));
  await openMode('Remove from roster');
  await act(async () => button('Remove from roster').props.onClick());
  const submit = button('Remove').props.onClick;
  let pending!: Promise<void>;
  await act(async () => { pending = submit(); void submit(); button('Dismiss sheet').props.onClick(); });
  expect(props.onMarkInactive).toHaveBeenCalledTimes(1);
  expect(props.onOpenChange).not.toHaveBeenCalled();
  await act(async () => { cancel(false); await pending; });
  expect(button('Remove').props.disabled).toBe(false);
  expect(activity.done).toHaveBeenCalledWith('Removal cancelled');
});
