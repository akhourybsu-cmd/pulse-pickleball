import { describe, it, expect } from 'vitest';
import { roundProgress } from './roundProgress';
describe('round progress', () => {
  it('does not call an empty/bye-only round complete', () => {
    expect(roundProgress([]).canClose).toBe(false);
    expect(roundProgress([{ is_bye: true }]).canClose).toBe(false);
  });
  it('waits for both scores, including a zero', () => {
    expect(roundProgress([{team1_score:11,team2_score:null}]).pending).toBe(1);
    expect(roundProgress([{team1_score:11,team2_score:0}]).canClose).toBe(true);
  });
  it('ignores history and resolves abandoned games', () => {
    expect(roundProgress([{abandoned:true},{voided_at:'now'},{superseded_by_schedule_id:'id'}])).toEqual({total:1,resolved:1,pending:0,canClose:true});
  });
});
