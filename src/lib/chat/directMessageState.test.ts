import { describe, expect, it } from 'vitest';
import {
  mergeDirectMessageRealtime,
  mergeDirectMessageSnapshot,
  reconcileDirectMessageAck,
  type ReconciliableDirectMessage,
} from './directMessageState';

const optimistic = (
  clientId: string,
  content = 'On my way',
): ReconciliableDirectMessage => ({
  id: `temp-${clientId}`,
  sender_id: 'me',
  content,
  created_at: '2026-09-07T12:00:00.000Z',
  client_id: clientId,
  _clientId: clientId,
  _status: 'sending',
});

const server = (
  id: string,
  content = 'On my way',
  createdAt = '2026-09-07T12:00:00.100Z',
  clientId: string | null = null,
): ReconciliableDirectMessage => ({
  id,
  sender_id: 'me',
  content,
  created_at: createdAt,
  client_id: clientId,
});

describe('direct-message optimistic delivery reconciliation', () => {
  it('uses the HTTP response as an acknowledgement when realtime never arrives', () => {
    const result = reconcileDirectMessageAck([optimistic('a')], server('server-a'), 'a');

    expect(result).toEqual([{ ...server('server-a'), _status: 'sent' }]);
  });

  it('deduplicates when realtime arrives before the HTTP acknowledgement', () => {
    const realtimeFirst = mergeDirectMessageRealtime(
      [optimistic('a')],
      server('server-a', 'On my way', '2026-09-07T12:00:00.100Z', 'a'),
    );
    const acknowledged = reconcileDirectMessageAck(
      realtimeFirst,
      server('server-a', 'On my way', '2026-09-07T12:00:00.100Z', 'a'),
      'a',
    );

    expect(acknowledged).toHaveLength(1);
    expect(acknowledged[0]).toMatchObject({ id: 'server-a', _status: 'sent' });
    expect(acknowledged[0]._clientId).toBeUndefined();
  });

  it('does not duplicate a repeated realtime payload', () => {
    const delivered = mergeDirectMessageRealtime([], server('server-a'));
    expect(mergeDirectMessageRealtime(delivered, server('server-a'))).toBe(delivered);
  });

  it('keeps two rapid identical messages when acknowledgements arrive out of order', () => {
    let state = [optimistic('a'), optimistic('b')];
    state = mergeDirectMessageRealtime(
      state,
      server('server-b', 'On my way', '2026-09-07T12:00:00.200Z', 'b'),
    );
    state = reconcileDirectMessageAck(
      state,
      server('server-b', 'On my way', '2026-09-07T12:00:00.200Z', 'b'),
      'b',
    );
    state = reconcileDirectMessageAck(
      state,
      server('server-a', 'On my way', '2026-09-07T12:00:00.100Z', 'a'),
      'a',
    );

    expect(state.map((message) => message.id)).toEqual(['server-a', 'server-b']);
    expect(state.every((message) => message._status === 'sent')).toBe(true);
  });

  it('matches identical optimistic messages by client id, not content', () => {
    const state = [optimistic('a'), optimistic('b')];
    const result = mergeDirectMessageRealtime(
      state,
      server('server-b', 'On my way', '2026-09-07T12:00:00.200Z', 'b'),
    );

    expect(result.some((message) => message._clientId === 'a')).toBe(true);
    expect(result.some((message) => message._clientId === 'b')).toBe(false);
    expect(result.some((message) => message.id === 'server-b')).toBe(true);
  });

  it('reconciles an exact client id even if the optimistic row was marked failed', () => {
    const failed = { ...optimistic('a'), _status: 'failed' as const };
    const result = mergeDirectMessageRealtime(
      [failed],
      server('server-a', 'On my way', '2026-09-07T12:00:00.200Z', 'a'),
    );

    expect(result).toEqual([{
      ...server('server-a', 'On my way', '2026-09-07T12:00:00.200Z', 'a'),
      _status: 'sent',
    }]);
  });

  it('uses a reconnect snapshot as an exact acknowledgement', () => {
    const result = mergeDirectMessageSnapshot(
      [optimistic('a'), optimistic('still-sending', 'Second')],
      [server('server-a', 'On my way', '2026-09-07T12:00:00.200Z', 'a')],
    );

    expect(result.map((message) => message.id)).toEqual([
      'temp-still-sending',
      'server-a',
    ]);
    expect(result.some((message) => message._clientId === 'a')).toBe(false);
    expect(result.some((message) => message._clientId === 'still-sending')).toBe(true);
  });

  it('inserts remote messages in chronological order', () => {
    const result = mergeDirectMessageRealtime(
      [server('later', 'Later', '2026-09-07T12:00:02.000Z')],
      { ...server('earlier', 'Earlier', '2026-09-07T12:00:01.000Z'), sender_id: 'other' },
    );

    expect(result.map((message) => message.id)).toEqual(['earlier', 'later']);
  });
});
