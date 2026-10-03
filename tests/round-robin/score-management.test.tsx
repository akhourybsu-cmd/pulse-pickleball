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
