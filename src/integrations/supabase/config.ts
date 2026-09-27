import { validateBackend } from "@/lib/backendPolicy.mjs";

export const backendConfig = validateBackend(
  import.meta.env,
  import.meta.env.MODE,
  typeof window === "undefined" ? "" : window.location.hostname
);
