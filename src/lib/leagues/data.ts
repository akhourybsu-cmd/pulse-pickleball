import { supabase } from '@/integrations/supabase/client';

export function leagueErrorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message) : 'League data could not be loaded. Please try again.';
}

// Supabase caps responses. Never silently turn a long season into a partial
// schedule or incomplete standings; order every page by an immutable key.
export async function leagueRows<T>(table: string, filters: Record<string, string>, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    let query = supabase.from(table as never).select('*').order('id').range(from, from + 499);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

export interface LeagueProfile {
  id: string; display_name: string | null; full_name: string | null;
  first_name: string | null; last_name: string | null; avatar_url: string | null;
}
export async function leagueRowsByIds<T>(table: string, ids: string[], signal?: AbortSignal): Promise<T[]> {
  const unique = [...new Set(ids)];
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    let query = supabase.from(table as never).select('*').in('id', unique.slice(i, i + 200));
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []) as T[]);
  }
  return rows;
}
export async function leagueProfiles(ids: string[], signal?: AbortSignal): Promise<LeagueProfile[]> {
  const unique = [...new Set(ids)];
  const profiles: LeagueProfile[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    let query = supabase.from('profiles_public').select('id, display_name, full_name, first_name, last_name, avatar_url').in('id', unique.slice(i, i + 200));
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    profiles.push(...(data ?? []) as LeagueProfile[]);
  }
  return profiles;
}
