export interface ReconciliableDirectMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  client_id?: string | null;
  _clientId?: string;
  _status?: 'sending' | 'sent' | 'failed';
}

function asDelivered<T extends ReconciliableDirectMessage>(message: T): T {
  const { _clientId: _discardedClientId, ...serverMessage } = message;
  return { ...serverMessage, _status: 'sent' } as T;
}

function chronological<T extends ReconciliableDirectMessage>(messages: T[]): T[] {
  return messages.sort((a, b) => {
    const byTime = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return byTime || a.id.localeCompare(b.id);
  });
}

/**
 * Merge the row returned by the HTTP INSERT with its exact optimistic row.
 * This is the authoritative delivery acknowledgement; realtime may arrive
 * before it, after it, or not at all.
 */
export function reconcileDirectMessageAck<T extends ReconciliableDirectMessage>(
  current: T[],
  incoming: T,
  clientId: string,
): T[] {
  const delivered = asDelivered(incoming);
  const withoutDuplicates = current.filter(
    (message) => message.id !== incoming.id && message._clientId !== clientId,
  );
  return chronological([...withoutDuplicates, delivered]);
}

/**
 * Merge a realtime INSERT. Matching sender + content is a best-effort bridge
 * for an optimistic row until its exact HTTP acknowledgement arrives.
 */
export function mergeDirectMessageRealtime<T extends ReconciliableDirectMessage>(
  current: T[],
  incoming: T,
): T[] {
  const delivered = asDelivered(incoming);

  // A reconnect snapshot can occasionally surface the server row before the
  // realtime event. Even when the row id is already present, remove the exact
  // optimistic counterpart so a late event cannot leave two bubbles behind.
  if (incoming.client_id) {
    const hasServerRow = current.some((message) => message.id === incoming.id);
    const hasOptimisticRow = current.some(
      (message) => message._clientId === incoming.client_id,
    );
    if (hasServerRow && !hasOptimisticRow) return current;
    const withoutDuplicates = current.filter(
      (message) =>
        message.id !== incoming.id && message._clientId !== incoming.client_id,
    );
    return chronological([...withoutDuplicates, delivered]);
  }

  if (current.some((message) => message.id === incoming.id)) return current;

  const optimisticIndex = current.findIndex(
    (message) =>
      message._status === 'sending' &&
      // Legacy/server-created messages may not carry a client id. Keep the
      // old best-effort bridge for those rows only.
      message.sender_id === incoming.sender_id &&
      message.content === incoming.content,
  );

  if (optimisticIndex < 0) return chronological([...current, delivered]);

  const next = [...current];
  next[optimisticIndex] = delivered;
  return chronological(next);
}

/**
 * Merge a current server snapshot without dropping optimistic rows created
 * while the request was in flight. Exact client ids eliminate the temporary
 * bubble when the snapshot itself is the first delivery acknowledgement.
 */
export function mergeDirectMessageSnapshot<T extends ReconciliableDirectMessage>(
  current: T[],
  incoming: T[],
): T[] {
  const incomingIds = new Set(incoming.map((message) => message.id));
  const incomingClientIds = new Set(
    incoming.flatMap((message) => message.client_id ? [message.client_id] : []),
  );
  const extras = current.filter(
    (message) =>
      !incomingIds.has(message.id) &&
      !(message._clientId && incomingClientIds.has(message._clientId)),
  );
  return chronological([
    ...incoming.map((message) => asDelivered(message)),
    ...extras,
  ]);
}
