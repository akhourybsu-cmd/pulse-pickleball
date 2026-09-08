import { describe, expect, it } from 'vitest';
import { isTransientAuthError } from '@/lib/authErrors';
describe('auth connectivity versus sign-out', () => {
  it.each([{name:'AuthRetryableFetchError'}, {status:503}, {status:429}, {name:'AbortError'}, new TypeError('Failed to fetch')])('keeps a transport failure retryable: %s', error => {
    expect(isTransientAuthError(error)).toBe(true);
  });
  it.each([{name:'AuthApiError',status:401}, {code:'refresh_token_not_found',status:400}, {name:'AuthSessionMissingError'}, new Error('Invalid credentials'), null])('does not preserve an invalid session: %s', error => {
    expect(isTransientAuthError(error)).toBe(false);
  });
});
