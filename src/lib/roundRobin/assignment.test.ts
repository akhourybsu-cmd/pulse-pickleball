import { expect, it } from 'vitest';
import { minimumCostAssignment, SeededRandom } from './scheduleCore';

function exhaustive(costs:number[][], row=0, used=0):number {
  if(row===costs.length) return 0;
  let best=Infinity;
  for(let column=0;column<costs.length;column++) if(!(used&(1<<column))) {
    best=Math.min(best,costs[row][column]+exhaustive(costs,row+1,used|(1<<column)));
  }
  return best;
}
it('matches an independent exhaustive optimum for 112 seeded assignment problems',()=>{
  const rng=new SeededRandom('assignment-oracle');
  for(let n=1;n<=7;n++) for(let seed=0;seed<16;seed++) {
    const costs=Array.from({length:n},()=>Array.from({length:n},()=>Math.floor(rng.next()*20)-5));
    const selected=minimumCostAssignment(costs);
    expect(new Set(selected).size).toBe(n);
    expect(selected.reduce((total,column,row)=>total+costs[row][column],0)).toBe(exhaustive(costs));
    expect(minimumCostAssignment(costs)).toEqual(selected);
  }
});
it('keeps exact assignments above the old 16-player-per-gender cutoff',()=>{
  const costs=Array.from({length:40},(_,row)=>Array.from({length:40},(_,column)=>column===(row+1)%40?0:100));
  expect(minimumCostAssignment(costs)).toEqual(Array.from({length:40},(_,row)=>(row+1)%40));
  expect(minimumCostAssignment([])).toEqual([]);
});
