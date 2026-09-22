import { useCallback, useEffect, useMemo, useState } from 'react';
import { QUESTION_BANK_V2 } from '@/lib/skill/questionBankV2';
import { ADAPTIVE_CONFIG_V2, selectNextV2 } from '@/lib/skill/adaptiveV2';
import { scoreAssessment } from '@/lib/skill/scoring';
import { RESPONSE_KEYS, type ResponseKey } from '@/lib/skill/model';
import { browserGuestStorage, clearGuestAssessment, createGuestAssessment, readGuestAssessment, writeGuestAssessment, GUEST_ASSESSMENT_KEY, type GuestAssessment } from '@/lib/skill/guestAssessment';
import { trackAssessmentFunnel } from '@/lib/skill/assessmentFunnel';

export function useGuestSkillAssessment() {
  const [draft, setDraft] = useState(() => readGuestAssessment(browserGuestStorage()));
  const [intro, setIntro] = useState(!draft);
  const [durable, setDurable] = useState(true);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== GUEST_ASSESSMENT_KEY && event.key !== null) return;
      const next = readGuestAssessment(browserGuestStorage());
      // An email callback can open a second tab. If it saves first and clears
      // storage, retain this tab's completed report while its own save resolves.
      // The shared idempotency ID makes both requests safe.
      setDraft(current => !next && current?.completedAt ? current : next);
      if (next) setIntro(false);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const responses = useMemo(() => draft?.responses ?? {}, [draft]);
  const nextItemKey = selectNextV2(QUESTION_BANK_V2, responses);
  const complete = nextItemKey === null;
  const runningSnapshot = useMemo(() => scoreAssessment(QUESTION_BANK_V2, responses), [responses]);
  const canFinalize = complete && !!runningSnapshot.meta.evidence?.sufficient;
  const persist = useCallback((next: GuestAssessment) => {
    const saved = writeGuestAssessment(browserGuestStorage(), next);
    setDraft(next);
    setDurable(saved);
    return saved;
  }, []);
  const start = async () => {
    if (!draft || draft.completedAt || draft.expiresAt <= Date.now()) {
      persist(createGuestAssessment());
      trackAssessmentFunnel('started');
    }
    setIntro(false);
  };
  const answer = async (key: string, value: ResponseKey) => {
    if (!draft || draft.completedAt || !QUESTION_BANK_V2.some(i => i.itemKey === key) || !RESPONSE_KEYS.includes(value)) return false;
    const stored = readGuestAssessment(browserGuestStorage());
    // Merge independent answers from another tab; never overwrite its new or
    // completed assessment while a storage event is still waiting to arrive.
    if (stored && (stored.id !== draft.id || stored.completedAt)) { setDraft(stored); return false; }
    const current = stored ?? draft;
    persist({ ...current, responses: { ...current.responses, [key]: value } });
    return true;
  };
  const finalize = async () => {
    if (!draft || !canFinalize) return;
    persist({ ...draft, completedAt: Date.now() });
    trackAssessmentFunnel('completed');
  };
  const requestSave = () => draft && canFinalize && persist({ ...draft, saveRequested: true });
  const clearSaved = (id: string) => clearGuestAssessment(browserGuestStorage(), id);
  return { draft, durable, bank: QUESTION_BANK_V2, assessmentVersion: 2, responses, nextItemKey,
    answeredCount: Object.keys(responses).length, complete, canFinalize, runningSnapshot,
    phase: intro || !draft ? 'intro' : draft.completedAt && canFinalize ? 'result' : 'in_progress',
    minItems: ADAPTIVE_CONFIG_V2.minItems, maxItems: ADAPTIVE_CONFIG_V2.maxItems, saving: false,
    start, answer, finalize, requestSave, clearSaved, showIntro: () => setIntro(true), showResult: () => setIntro(false) };
}
