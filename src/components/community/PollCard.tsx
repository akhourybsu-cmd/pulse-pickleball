import { useMemo } from 'react';
import { Check, CircleDot } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PollCardProps {
  options: { idx: number; text: string }[];
  counts: number[];
  myVote: number | null;
  onVote: (optionIdx: number) => void;
  /** When true the bars + winner highlight render but tap is disabled. */
  disabled?: boolean;
}

/**
 * Inline poll voting card rendered inside a feed PostCard when post.type='poll'.
 *
 * Two visual modes:
 *  - **Pre-vote**: each option is a plain tap-target row. No bars.
 *  - **Post-vote (myVote != null)**: each row turns into a horizontal
 *    progress bar with percentage; the winner has a subtle primary tint
 *    and the current viewer's pick is marked with a check.
 *
 * Tapping the row you already picked toggles the vote off (matches the
 * RPC's toggle behavior). Tapping a different row migrates your vote.
 */
export function PollCard({ options, counts, myVote, onVote, disabled }: PollCardProps) {
  const totalVotes = useMemo(() => counts.reduce((a, b) => a + b, 0), [counts]);
  const hasVoted = myVote != null;
  const maxCount = useMemo(() => Math.max(0, ...counts), [counts]);

  return (
    <div className="mt-3 space-y-1.5">
      {options.map((opt) => {
        const c = counts[opt.idx] ?? 0;
        const pct = totalVotes > 0 ? (c / totalVotes) * 100 : 0;
        const isMine = myVote === opt.idx;
        const isLeader = hasVoted && c > 0 && c === maxCount;

        return (
          <button
            key={opt.idx}
            type="button"
            disabled={disabled}
            onClick={() => onVote(opt.idx)}
            className={cn(
              'group relative w-full text-left rounded-lg border overflow-hidden',
              'transition-all duration-150',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              isMine
                ? 'border-primary/60 bg-primary/5'
                : 'border-border/60 hover:border-border bg-card hover:bg-muted/40',
              !disabled && 'active:scale-[0.99]',
            )}
          >
            {/* Filled bar — only after the viewer has voted */}
            {hasVoted && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={cn(
                  'absolute inset-y-0 left-0',
                  isMine
                    ? 'bg-primary/15'
                    : isLeader
                      ? 'bg-muted/60'
                      : 'bg-muted/30',
                )}
              />
            )}

            <div className="relative flex items-center gap-3 px-3 py-2.5">
              {/* Indicator (selected check or empty circle) */}
              <div
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border flex-shrink-0',
                  isMine
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/40 bg-transparent',
                )}
                aria-hidden
              >
                {isMine ? <Check className="h-3 w-3" strokeWidth={3} /> : <CircleDot className="h-2.5 w-2.5 opacity-0" />}
              </div>

              <span
                className={cn(
                  'flex-1 text-sm font-medium truncate',
                  isMine ? 'text-foreground' : 'text-foreground/90',
                )}
              >
                {opt.text}
              </span>

              {hasVoted && (
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums flex-shrink-0',
                    isMine ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          </button>
        );
      })}

      <div className="text-[11px] text-muted-foreground/70 pt-0.5 flex items-center gap-1.5">
        <span className="tabular-nums">{totalVotes}</span>
        <span>{totalVotes === 1 ? 'vote' : 'votes'}</span>
        {!hasVoted && (
          <span className="text-muted-foreground/50">· Tap an option to vote</span>
        )}
      </div>
    </div>
  );
}
