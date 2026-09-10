/** A private sample is never a verified business. Its exception is test-only,
 * service-managed, and restricted to its actual, allowlisted owner. */
export function privatePaymentTestAllowed(
  sample: { owner_id: string; test_payments_enabled?: boolean } | null,
  ownerId: string,
  userId: string,
  mode: string,
  testUserIds: string,
) {
  return !!sample && sample.test_payments_enabled === true && mode === 'test'
    && sample.owner_id === ownerId && ownerId === userId
    && testUserIds.split(',').map(id => id.trim()).includes(userId);
}
