// Isolated preview storage. No backend, auth tokens, network calls or live data.
import { QUESTION_BANK_V2 } from '../../../src/lib/skill/questionBankV2';
import { selectNextV2 } from '../../../src/lib/skill/adaptiveV2';
import { computeAuthoritativeResult } from '../../../supabase/functions/_shared/skill/complete';
import type { Responses } from '../../../src/lib/skill/scoring';
import type { ResponseKey } from '../../../src/lib/skill/model';
type Row = Record<string, unknown>;
const storageKey = 'pulse-assessment-v2-preview';
const read = (): Record<string, Row[]> => JSON.parse(localStorage.getItem(storageKey) ?? '{"skill_assessment_attempts":[],"skill_assessment_responses":[]}');
const write = (data: Record<string, Row[]>) => localStorage.setItem(storageKey, JSON.stringify(data));
let failSave = false;
export function failNextSave() { failSave = true; }
export function resetPreview() { localStorage.removeItem(storageKey); location.reload(); }
export function seedReady() { seedResponses('usually'); }
export function seedUnknown() { seedResponses('not_sure'); }
function seedResponses(answer: ResponseKey) {
  const responses: Responses = {};
  for (let n = 0; n < 64; n++) {
    const next = selectNextV2(QUESTION_BANK_V2, responses);
    if (!next) break;
    responses[next] = answer;
  }
  write({ skill_assessment_attempts: [{ id: 'preview-draft', player_id: 'preview-player', assessment_version: 2, status: 'in_progress' }],
    skill_assessment_responses: Object.entries(responses).map(([item_key, response_key]) => ({ attempt_id: 'preview-draft', item_key, response_key })) });
  location.reload();
}
export const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'preview-player' } }, error: null }) },
  from(table: string) {
    const filters: [string, unknown][] = [];
    let operation = 'select'; let payload: Row | Row[] = {}; let single = false;
    const execute = async () => {
      const data = read();
      const rows = data[table] ?? [];
      const matches = (r: Row) => filters.every(([key, value]) => r[key] === value);
      let result = rows.filter(matches);
      if (operation === 'upsert' && failSave) { failSave = false; return { data: null, error: new Error('Preview save failure') }; }
      if (operation === 'insert') {
        const added = { id: `preview-${Date.now()}`, ...payload };
        rows.push(added); result = [added];
      }
      if (operation === 'upsert') {
        for (const row of Array.isArray(payload) ? payload : [payload]) {
          const index = rows.findIndex(r => r.attempt_id === row.attempt_id && r.item_key === row.item_key);
          if (index >= 0) rows[index] = { ...rows[index], ...row }; else rows.push(row);
        }
      }
      if (operation === 'update') for (const row of rows.filter(matches)) Object.assign(row, payload);
      data[table] = operation === 'delete' ? rows.filter(r => !matches(r)) : rows;
      if (operation !== 'select') write(data);
      return { data: single ? result[0] ?? null : result, error: null };
    };
    const query = {
      select() { return query; }, eq(key: string, value: unknown) { filters.push([key, value]); return query; },
      order() { return query; }, maybeSingle() { single = true; return query; }, single() { single = true; return query; },
      insert(row: Row) { operation = 'insert'; payload = row; return query; },
      upsert(row: Row | Row[]) { operation = 'upsert'; payload = row; return query; },
      update(row: Row) { operation = 'update'; payload = row; return query; }, delete() { operation = 'delete'; return query; },
      then(resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) { return execute().then(resolve, reject); },
    };
    return query;
  },
  functions: { async invoke(_name: string, options: { body: { attemptId: string } }) {
    const data = read();
    const rows = data.skill_assessment_responses.filter(r => r.attempt_id === options.body.attemptId);
    const result = computeAuthoritativeResult({ assessmentVersion: 2, responses: rows.map(r => ({ item_key: String(r.item_key), response_key: String(r.response_key) })) });
    if (!result.ok) return { data: result, error: new Error('Insufficient evidence') };
    const attempt = data.skill_assessment_attempts.find(r => r.id === options.body.attemptId)!;
    Object.assign(attempt, { status: 'completed', scoring_snapshot: result.snapshot, completed_at: new Date().toISOString(), estimated_level_display: result.snapshot.estimatedLevelDisplay, display_band: result.snapshot.displayBand });
    write(data);
    return { data: { snapshot: result.snapshot }, error: null };
  } },
};
