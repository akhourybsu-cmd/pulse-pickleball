/**
 * Shared chat-bubble surface styling for direct messages and group chats,
 * so both panes read as one system.
 *
 * These add depth WITHOUT changing bubble height — purely surface (fill,
 * border, shadow, radius). No extra vertical padding, so they don't cost
 * headroom:
 *   • outgoing — a soft top→bottom gold gradient + a gentle shadow so the
 *     bubble reads as lifted rather than a flat swatch;
 *   • incoming — a raised bordered card (lighter than the pane in both
 *     themes) with a soft shadow, so it separates cleanly from the
 *     background instead of blending in.
 *
 * Callers keep their own padding / max-width / text-size classes and just
 * layer these on for the surface.
 */
export const outgoingBubble =
  'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground rounded-br-md shadow-sm';

export const incomingBubble =
  'bg-card text-foreground border border-border/60 rounded-bl-md shadow-sm';
