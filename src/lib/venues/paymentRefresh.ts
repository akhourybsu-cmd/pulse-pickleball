import type { QueryClient } from '@tanstack/react-query';

/** One refresh includes the owner action queue, not just purchase history. */
export async function refreshPaymentWorkspace(client: Pick<QueryClient, 'refetchQueries'>, venueId: string | null, userId: string | undefined) {
  const keys = [
    ['payment-history', venueId],
    ...(venueId ? [['venue-payment-requests', venueId, userId], ['venue-payments', venueId, userId]] : [['payment-wallet', userId]]),
  ];
  await Promise.all(keys.map(queryKey => client.refetchQueries({ queryKey, type: 'active' }, { throwOnError: true })));
}
