interface SenderStampedMessage {
  user_id: string;
  created_at: string;
}

const DEFAULT_RUN_GAP_MS = 5 * 60 * 1000;

/** Whether two adjacent messages should visually read as one sender run. */
export function isSameSenderRun(
  a: SenderStampedMessage | undefined,
  b: SenderStampedMessage | undefined,
  maxGapMs = DEFAULT_RUN_GAP_MS,
): boolean {
  if (!a || !b || a.user_id !== b.user_id) return false;
  const aDate = new Date(a.created_at);
  const bDate = new Date(b.created_at);
  return (
    aDate.toDateString() === bDate.toDateString() &&
    Math.abs(aDate.getTime() - bDate.getTime()) <= maxGapMs
  );
}
