import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { digest } from "./backend-build.mjs";
import {
  PRODUCTION_SUPABASE_PROJECT,
  PRODUCTION_SUPABASE_URL,
} from "../src/lib/backendPolicy.mjs";

function filesIn(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const name = `${prefix}${item.name}`;
    return item.isDirectory()
      ? filesIn(path.join(directory, item.name), `${name}/`)
      : [name];
  });
}

export function validateArtifact(directory, { revision, nativeConfig } = {}) {
  const manifest = JSON.parse(
    readFileSync(path.join(directory, "backend-release.json"), "utf8")
  );
  if (
    manifest.schema !== 1 ||
    manifest.mode !== "production" ||
    manifest.projectId !== PRODUCTION_SUPABASE_PROJECT ||
    manifest.url !== PRODUCTION_SUPABASE_URL
  ) {
    throw new Error(
      "Only a verified production backend build can be released."
    );
  }
  if (
    !/^[a-f0-9]{40}$/.test(manifest.revision) ||
    (revision && manifest.revision !== revision)
  )
    throw new Error(
      "The app bundle does not match the release revision. Rebuild before publishing."
    );
  const files = filesIn(directory).filter(
    (name) =>
      /\.(js|html|css)$/.test(name) &&
      !name.startsWith("plugins/") &&
      !name.startsWith("cordova")
  );
  let foundBackend = false;
  for (const name of files) {
    const bytes = readFileSync(path.join(directory, name));
    // Public scripts/HTML are also inspected; bundled modules must be hashed.
    if (
      (name.startsWith("assets/") || name === "index.html") &&
      manifest.files?.[name] !== digest(bytes)
    )
      throw new Error(`Unverified or modified release file: ${name}`);
    const source = bytes.toString("utf8");
    if (source.includes("ryxklkayezjnwwunuphn"))
      throw new Error("The app bundle contains a retired Supabase reference.");
    for (const match of source.matchAll(
      /(?:https|wss):\/\/([a-z0-9-]+)\.supabase\.co\b/g
    )) {
      if (match[1] !== PRODUCTION_SUPABASE_PROJECT)
        throw new Error(
          "The production bundle contains another Supabase endpoint."
        );
      foundBackend = true;
    }
  }
  for (const [name, hash] of Object.entries(manifest.files ?? {})) {
    if (
      !files.includes(name) ||
      hash !== digest(readFileSync(path.join(directory, name)))
    )
      throw new Error("The release bundle is incomplete.");
  }
  if (!manifest.files?.["index.html"] || !foundBackend)
    throw new Error("The release bundle is missing its app entry or backend.");
  if (nativeConfig) {
    const config = JSON.parse(readFileSync(nativeConfig, "utf8"));
    if (config.appId !== "com.pulsepb.app" || config.server?.url)
      throw new Error(
        "PULSE native releases must use the verified bundled app, with no remote server override."
      );
  }
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const native = process.argv.includes("--native");
    const artifact = validateArtifact(
      native ? "android/app/src/main/assets/public" : "dist",
      {
        revision:
          process.env.GITHUB_SHA ||
          execFileSync(
            "git",
            [
              "-c",
              `safe.directory=${process.cwd().replaceAll("\\", "/")}`,
              "rev-parse",
              "HEAD",
            ],
            { encoding: "utf8" }
          ).trim(),
        ...(native
          ? {
              nativeConfig: "android/app/src/main/assets/capacitor.config.json",
            }
          : {}),
      }
    );
    console.log(
      `Verified ${native ? "Android" : "web"} bundle: ${
        artifact.projectId
      }, revision ${artifact.revision}.`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
