import type { AssessmentItem } from '@/lib/skill/model';
import { CourtLessonPlayer } from './CourtLessonPlayer';

/** One player is shared by guest, account, review and guide surfaces. */
export function CourtScenario({ item }: { item: AssessmentItem }) {
  return <CourtLessonPlayer key={item.itemKey} item={item} />;
}
