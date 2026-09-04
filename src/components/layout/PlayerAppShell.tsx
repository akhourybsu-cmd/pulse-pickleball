import { PlayerShell } from "@/components/layout/PlayerShell";
import { DirectMessagesProvider } from "@/hooks/useDirectMessages";

/**
 * Authenticated player chrome and its app-wide messaging state.
 *
 * Kept behind one lazy boundary so public pages never download or parse the
 * player shell, inbox queries, notification center, or presence code.
 */
export default function PlayerAppShell() {
  return (
    <DirectMessagesProvider>
      <PlayerShell />
    </DirectMessagesProvider>
  );
}
