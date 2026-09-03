/**
 * Scope persisted Supabase sessions to the backend that issued them.
 *
 * A backend-independent key makes a cutover unsafe: the browser can send a
 * JWT signed by the previous project to the new project, which correctly
 * rejects it as `bad_jwt` and can leave route guards in a redirect loop.
 */
export function getSupabaseAuthStorageKey(projectId: string | undefined, projectUrl: string): string {
  const configuredId = projectId?.trim();
  if (configuredId) return `pulse-auth:${configuredId}`;

  try {
    const hostname = new URL(projectUrl).hostname;
    const inferredId = hostname.split('.')[0]?.trim();
    if (inferredId) return `pulse-auth:${inferredId}`;
  } catch {
    // Vite configuration validation will surface an invalid project URL.
  }

  return 'pulse-auth:default';
}
