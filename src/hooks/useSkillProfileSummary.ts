import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withAuthDeadline } from '@/lib/authDeadline';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';

interface SkillSummary {
  self_assessed_level: number | null;
  self_assessed_band: string | null;
  self_assessment_confidence: number | null;
  provisional_status: boolean | null;
}

export function useSkillProfileSummary(userId?: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ owner?: string; row: SkillSummary | null; loaded: boolean; error: boolean }>({ row: null, loaded: false, error: false });
  useEffect(() => {
    if (!userId || !isSkillAssessmentEnabled()) return;
    let cancelled = false;
    setState({ owner: userId, row: null, loaded: false, error: false });
    void withAuthDeadline(async signal => {
      const { data, error } = await supabase.from('player_skill_profiles' as never)
        .select('self_assessed_level, self_assessed_band, self_assessment_confidence, provisional_status')
        .eq('player_id', userId).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data as unknown as SkillSummary | null;
    }).then(row => { if (!cancelled) setState({ owner: userId, row, loaded: true, error: false }); })
      .catch(() => { if (!cancelled) setState({ owner: userId, row: null, loaded: true, error: true }); });
    return () => { cancelled = true; };
  }, [userId, attempt]);
  return { ...(state.owner === userId ? state : { row: null, loaded: false, error: false }), retry: () => setAttempt(n => n + 1) };
}
