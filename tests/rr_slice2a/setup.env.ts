/**
 * Vitest setup file — loads tests/rr_slice2a/.env.test (git-ignored) into
 * process.env before any scenario runs. If the file is absent, nothing is
 * loaded and the suite auto-skips (harness.readEnv returns null). This keeps
 * credentials out of the repo and prevents accidental production targeting.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, ".env.test") });
