import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { ScoreManagementDialog } from '@/components/round-robin/ScoreManagementDialog';

vi.mock('@/components/ui/dialog',()=>{
  const Box=({children}: {children: React.ReactNode})=><div>{children}</div>;
  return { Dialog:({open,children}: {open:boolean;children:React.ReactNode})=>open?<div>{children}</div>:null,
    DialogContent:Box,DialogDescription:Box,DialogFooter:Box,DialogHeader:Box,DialogTitle:Box };
});
vi.mock('@/components/ui/select',()=>{
  const Box=({children}: {children:React.ReactNode})=><>{children}</>;
  return { Select:({value,onValueChange,children}: {value:string;onValueChange:(v:string)=>void;children:React.ReactNode})=><select value={value} onChange={e=>onValueChange(e.target.value)}>{children}</select>,
    SelectContent:Box,SelectTrigger:Box,SelectValue:()=>null,SelectItem:({value,children}: {value:string;children:React.ReactNode})=><option value={value}>{children}</option> };
});
let root: ReactTestRenderer;
afterEach(()=>{act(()=>root?.unmount());});
const match={id:'game-1',round_no:1,court_no:1,a1_player_id:'a',a2_player_id:'b',b1_player_id:'c',b2_player_id:'d',is_bye:false,team1_score:null,team2_score:null,match_id:null};
const text=(node:ReactTestInstance|string):string=>typeof node==='string'?node:node.children.map(text).join('');
const button=(label:string)=>root.root.findAllByType('button').find(b=>text(b).includes(label))!;
const props={open:true,onOpenChange:vi.fn(),isAdmin:false,ratingEligible:false,getPlayerName:(id:string|null)=>id??'Guest',onEditScore:vi.fn(),onVoidMatch:vi.fn(),onDeleteMatch:vi.fn()};
it('allows entering the first score in a completely unscored event',async()=>{
  await act(async()=>{root=create(<ScoreManagementDialog {...props} schedule={[match]} />);});
  expect(button('Enter Scores')).toBeDefined();
  await act(async()=>button('Enter Scores').props.onClick());
  await act(async()=>root.root.findAllByType('select')[1].props.onChange({target:{value:match.id}}));
  expect(root.root.findAllByType('input').map(n=>n.props.value)).toEqual([0,0]);
});
it('keeps typed scores through a roster/schedule refresh with unchanged results',async()=>{
  const save=vi.fn().mockResolvedValue(undefined);
  await act(async()=>{root=create(<ScoreManagementDialog {...props} onEditScore={save} schedule={[match]} />);});
  await act(async()=>button('Enter Scores').props.onClick());
  await act(async()=>root.root.findAllByType('select')[1].props.onChange({target:{value:match.id}}));
  await act(async()=>{
    root.root.findAllByType('input')[0].props.onChange({target:{value:'11'}});
    root.root.findAllByType('input')[1].props.onChange({target:{value:'7'}});
  });
  await act(async()=>root.update(<ScoreManagementDialog {...props} onEditScore={save} schedule={[{...match}]} />));
  expect(root.root.findAllByType('input').map(n=>n.props.value)).toEqual([11,7]);
  await act(async()=>button('Save').props.onClick());
  expect(save).toHaveBeenCalledWith('game-1',11,7);
});
vi.mock('@/components/ui/alert-dialog',()=>{
  const Box=({children}: {children:React.ReactNode})=><div>{children}</div>;
  const Btn=({children,...props}: React.ButtonHTMLAttributes<HTMLButtonElement>)=><button {...props}>{children}</button>;
  return { AlertDialog:({open,children}: {open:boolean;children:React.ReactNode})=>open?<section>{children}</section>:null,
    AlertDialogContent:Box,AlertDialogDescription:Box,AlertDialogFooter:Box,AlertDialogHeader:Box,AlertDialogTitle:Box,AlertDialogAction:Btn,AlertDialogCancel:Btn };
});
it('keeps failed saves retryable and validates the server win-by-two rule before submitting',async()=>{
  const save=vi.fn().mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue(undefined);
  await act(async()=>{root=create(<ScoreManagementDialog {...props} onEditScore={save} schedule={[match]} />);});
  await act(async()=>button('Enter Scores').props.onClick());
  await act(async()=>root.root.findAllByType('select')[1].props.onChange({target:{value:match.id}}));
  await act(async()=>{
    root.root.findAllByType('input')[0].props.onChange({target:{value:'11'}});
    root.root.findAllByType('input')[1].props.onChange({target:{value:'10'}});
  });
  expect(button('Save').props.disabled).toBe(true);
  await act(async()=>root.root.findAllByType('input')[1].props.onChange({target:{value:'7'}}));
  await act(async()=>button('Save').props.onClick());
  expect(root.root.findAllByType('input').map(n=>n.props.value)).toEqual([11,7]);
  expect(root.root.findAllByProps({role:'alert'}).some(node=>text(node).includes('Score was not saved'))).toBe(true);
  expect(button('Save').props.disabled).toBe(false);
  await act(async()=>button('Save').props.onClick());
  expect(save).toHaveBeenCalledTimes(2);
});
it('keeps failed result removal open for retry and blocks duplicate pending requests',async()=>{
  let finish!:()=>void;
  const remove=vi.fn().mockRejectedValueOnce(new Error('Could not confirm result removal'))
    .mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  await act(async()=>{root=create(<ScoreManagementDialog {...props} onVoidMatch={remove} schedule={[{...match,team1_score:11,team2_score:7,match_id:'saved'}]} />);});
  await act(async()=>button('Void Match').props.onClick());
  await act(async()=>root.root.findAllByType('select')[1].props.onChange({target:{value:match.id}}));
  await act(async()=>button('Void Match').props.onClick());
  const confirm=()=>root.root.findAllByType('button').filter(b=>text(b)==='Void Match').at(-1)!;
  await act(async()=>confirm().props.onClick({preventDefault:vi.fn()}));
  expect(root.root.findAllByProps({role:'alert'}).some(n=>text(n).includes('Could not confirm'))).toBe(true);
  await act(async()=>{const click=confirm().props.onClick; click({preventDefault:vi.fn()}); click({preventDefault:vi.fn()});});
  expect(remove).toHaveBeenCalledTimes(2);
  expect(button('Processing...').props.disabled).toBe(true);
  await act(async()=>finish());
  expect(button('Enter Scores')).toBeDefined();
});
it('starts on an available scored round after completion and hides entry for unfinished matches',async()=>{
  await act(async()=>{root=create(<ScoreManagementDialog {...props} eventStatus="completed" schedule={[{...match,id:'unplayed'}, {...match,id:'scored',round_no:2,team1_score:11,team2_score:7,match_id:'saved'}]} />);});
  expect(button('Enter Scores')).toBeUndefined();
  expect(root.root.findAllByType('select')[0].props.value).toBe('2');
  expect(button('Edit Score')).toBeDefined();
});
it('does not silently round fractional scores into a valid result',async()=>{
  await act(async()=>{root=create(<ScoreManagementDialog {...props} schedule={[match]} />);});
  await act(async()=>button('Enter Scores').props.onClick());
  await act(async()=>root.root.findAllByType('select')[1].props.onChange({target:{value:match.id}}));
  await act(async()=>root.root.findAllByType('input')[0].props.onChange({target:{value:'11.5'}}));
  expect(button('Save').props.disabled).toBe(true);
});
