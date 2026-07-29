/**
 * PULSE Skill Assessment — client feature flag.
 *
 * The repo has no general flag service, so (mirroring how the app already
 * gates capabilities via `import.meta.env.VITE_*`) the assessment surface
 * is gated by a build-time env flag. It stays OFF unless explicitly
 * enabled, so shipping the foundation never exposes half-built UI or
 * touches existing flows.
 *
 * Enable by setting `VITE_SKILL_ASSESSMENT=on` (or `true`/`1`).
 *
 * Scope note: this flag only gates NEW skill-assessment entry points,
 * routes, and (later) the optional league/substitute skill filters. It
 * must never gate or alter existing league, round-robin, rating, or
 * profile behavior.
 */
export function isSkillAssessmentEnabled(): boolean {
  const raw = (import.meta.env.VITE_SKILL_ASSESSMENT ?? "").toString().toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}
