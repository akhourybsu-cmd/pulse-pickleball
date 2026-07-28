/**
 * League Play re-exports the shared PULSE motion system. Kept as a thin
 * shim so existing `@/lib/leagues/motion` imports across the ladder
 * surface keep working while the tokens live in one neutral place
 * (`@/lib/motion`) that other flows (e.g. the Round Robin wizard) share.
 */
export * from "@/lib/motion";
