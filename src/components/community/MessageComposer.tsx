import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface MessageComposerHandle {
  focus: () => void;
  clear: () => void;
}

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Placeholder for the textarea. */
  placeholder?: string;
  /** Disables typing + sending. */
  disabled?: boolean;
  /** Shows the spinner on the send button and disables the action. */
  sending?: boolean;
  /** When provided, renders a "Replying to X" pill above the textarea. */
  replyToLabel?: string | null;
  /** Called when the user dismisses the reply pill (X or Escape). */
  onCancelReply?: () => void;
  /** Aria label for the send button. */
  sendLabel?: string;
  /** Extra content rendered to the LEFT of the textarea (e.g. attach button). */
  leadingAddon?: React.ReactNode;
  /** Extra content rendered ABOVE the textarea (e.g. attachment preview). */
  topAddon?: React.ReactNode;
  /** Optional extra classes on the outer container. */
  className?: string;
  /** When true (default), submits on Enter / new line on Shift+Enter. */
  submitOnEnter?: boolean;
  /** When true (default false), focuses the textarea on mount. */
  autoFocus?: boolean;
}

/**
 * Shared composer used by post comments, DMs, and anywhere PULSE needs a
 * stable, anchored message input.
 *
 * Behavior:
 * - Sticks to the bottom of its parent (use inside a flex column).
 * - Safe-area padding so the iOS home indicator never overlaps the input.
 * - Auto-growing textarea, max 5 lines.
 * - Enter submits, Shift+Enter newlines, Escape cancels a pending reply.
 * - Reply pill renders above the input without shifting layout.
 */
export const MessageComposer = forwardRef<MessageComposerHandle, MessageComposerProps>(
  function MessageComposer(
    {
      value,
      onChange,
      onSubmit,
      placeholder = 'Write a message…',
      disabled = false,
      sending = false,
      replyToLabel = null,
      onCancelReply,
      sendLabel = 'Send',
      leadingAddon,
      topAddon,
      className,
      submitOnEnter = true,
      autoFocus = false,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => requestAnimationFrame(() => textareaRef.current?.focus()),
      clear: () => onChange(''),
    }));

    // Autofocus when the reply target changes so the user can type immediately.
    useEffect(() => {
      if (replyToLabel) {
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    }, [replyToLabel]);

    useEffect(() => {
      if (autoFocus) {
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    }, [autoFocus]);

    const canSubmit = value.trim().length > 0 && !sending && !disabled;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (submitOnEnter && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSubmit) onSubmit();
      } else if (e.key === 'Escape' && replyToLabel && onCancelReply) {
        e.preventDefault();
        onCancelReply();
      }
    };

    return (
      <div
        className={cn(
          'border-t bg-background shrink-0 px-3 pt-2',
          // Safe-area aware bottom padding (iOS home indicator).
          '[padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]',
          className,
        )}
      >
        {topAddon ? <div className="mb-2">{topAddon}</div> : null}

        {replyToLabel ? (
          <div className="flex items-center justify-between gap-2 mb-2 px-2 py-1.5 rounded-md bg-primary/10 text-xs">
            <span className="truncate text-foreground/80">
              Replying to <span className="font-medium">{replyToLabel}</span>
            </span>
            {onCancelReply ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={onCancelReply}
                aria-label="Cancel reply"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          {leadingAddon}
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="min-h-[40px] max-h-32 resize-none py-2"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={onSubmit}
            disabled={!canSubmit}
            aria-label={sendLabel}
            type="button"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  },
);
