import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PRODUCTION_SUPABASE_PROJECT } from "../src/lib/backendPolicy.mjs";
import { validateCommittedBackend } from "./backend-build.mjs";

export function validateReleaseContext(env, head, currentMain) {
  if (
    env.GITHUB_REF !== "refs/heads/main" ||
    head !== env.GITHUB_SHA ||
    head !== currentMain
  ) {
    throw new Error(
      "Production releases must use the current main branch. Old runs and other branches cannot publish."
    );
  }
  if (
    env.SUPABASE_PROJECT_REF &&
    env.SUPABASE_PROJECT_REF !== PRODUCTION_SUPABASE_PROJECT
  )
    throw new Error(
      "Production deployment target is not the approved PULSE backend."
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const git = (...args) =>
      execFileSync("git", args, { encoding: "utf8" }).trim();
    validateReleaseContext(
      process.env,
      git("rev-parse", "HEAD"),
      git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0]
    );
    validateCommittedBackend(process.cwd());
    console.log("Current main revision and production backend verified.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
