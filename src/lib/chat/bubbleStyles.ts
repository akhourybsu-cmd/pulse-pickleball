/**
 * Shared chat-bubble surface styling for direct messages and group chats,
 * so both panes read as one system.
 *
 * Surface-only (fill + shadow) — no extra vertical padding, so they don't
 * cost headroom. Solid fills (not gradients/borders) so the iMessage-style
 * pseudo tails in index.css (.chat-tail-left / .chat-tail-right) match the
 * bubble colour seamlessly:
 *   • outgoing — solid gold + a gentle shadow;
 *   • incoming — solid muted fill + a gentle shadow, so it separates from
 *     the pane in both themes.
 *
 * Callers keep their own padding / max-width / rounding (`rounded-2xl`) and,
 * on the last bubble of a sender's run, add `chat-tail-right` (own) or
 * `chat-tail-left` (incoming) for the tail.
 */
export const outgoingBubble = 'bg-primary text-primary-foreground shadow-sm';

export const incomingBubble = 'bg-muted text-foreground shadow-sm';
