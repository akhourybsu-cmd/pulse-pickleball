import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
              'absolute z-10 flex items-center gap-0.5 p-1 bg-background/95 backdrop-blur-sm rounded-full shadow-lg border border-border/30',
              isOwn ? 'right-0' : 'left-0',
              '-top-10'
            )}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleReaction(emoji)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted/50 text-base"
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
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleReaction(reaction.emoji)}
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs',
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
          className="fixed inset-0 z-0" 
          onClick={onPickerClose}
        />
      )}
    </>
  );
}
