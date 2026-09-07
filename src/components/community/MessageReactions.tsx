import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MessageReactionsProps {
  messageId: string;
  isOwn: boolean;
  showPicker: boolean;
  onPickerClose: () => void;
  onReactionAdd?: (messageId: string, emoji: string) => void;
  reactions?: { emoji: string; count: number; hasReacted: boolean }[];
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👏'];

export function MessageReactions({
  messageId,
  isOwn,
  showPicker,
  onPickerClose,
  onReactionAdd,
  reactions = [],
}: MessageReactionsProps) {
  const firstReactionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    firstReactionRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onPickerClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onPickerClose, showPicker]);

  const handleReaction = (emoji: string) => {
    onReactionAdd?.(messageId, emoji);
    onPickerClose();
  };

  return (
    <>
      {/* Quick Emoji Picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 5 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-10 flex items-center gap-0.5 rounded-full border border-border/50 bg-background/95 p-1 shadow-lg backdrop-blur-sm',
              isOwn ? 'right-0' : 'left-0',
              '-top-14 sm:-top-10'
            )}
            role="menu"
            aria-label="Choose a reaction"
          >
            {QUICK_EMOJIS.map((emoji, index) => (
              <motion.button
                key={emoji}
                ref={index === 0 ? firstReactionRef : undefined}
                type="button"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleReaction(emoji)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg hover:bg-muted/50 sm:h-8 sm:w-8 sm:text-base"
                aria-label={`React with ${emoji}`}
                role="menuitem"
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reaction Pills */}
      {reactions.length > 0 && (
        <div className={cn('flex flex-wrap gap-1 mt-1', isOwn && 'justify-end')}>
          {reactions.map((reaction) => (
            <motion.button
              key={reaction.emoji}
              type="button"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleReaction(reaction.emoji)}
              aria-label={`${reaction.hasReacted ? 'Remove' : 'Add'} ${reaction.emoji} reaction, ${reaction.count} total`}
              className={cn(
                'inline-flex min-h-8 items-center gap-1 rounded-full px-2 py-1 text-xs',
                'bg-muted/50 hover:bg-muted transition-colors',
                reaction.hasReacted && 'ring-1 ring-primary/30 bg-primary/10'
              )}
            >
              <span>{reaction.emoji}</span>
              <span className="text-muted-foreground">{reaction.count}</span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {showPicker && (
        <div 
          className="fixed inset-0 z-[9]"
          onClick={onPickerClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}
