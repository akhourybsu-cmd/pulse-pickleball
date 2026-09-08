import { getErrorMessage } from '../getErrorMessage';

type Payload = Record<string, unknown>;
const asPayload = (value: unknown): Payload | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Payload : null;

export class LeagueFunctionError extends Error {
  constructor(message: string, readonly data: Payload | null) {
    super(message);
    this.name = 'LeagueFunctionError';
  }
}

/** Supabase puts non-2xx JSON in error.context, not in data. Keep structured
 * details (including tiebreaks) and never report a failed action as success. */
export async function requireLeagueFunctionData(result: {
  data: unknown; error: unknown; response?: Response;
}): Promise<Payload> {
  let data = asPayload(result.data);
  if (result.error) {
    const context = asPayload(result.error)?.context;
    const response = result.response ?? (context instanceof Response ? context : undefined);
    if (response) {
      try { data = asPayload(await response.clone().json()) ?? data; }
      catch { /* A proxy/network failure may not contain JSON. */ }
    }
  }
  if (result.error || data?.error) {
    const message = typeof data?.message === 'string' && data.message.trim() ? data.message
      : typeof data?.error === 'string' && data.error.trim() ? data.error
      : getErrorMessage(result.error, 'The league action could not be completed.');
    throw new LeagueFunctionError(message, data);
  }
  if (!data) throw new LeagueFunctionError('The server returned no result. Refresh the league before trying again.', null);
  return data;
}
