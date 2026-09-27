import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  validateBackend,
  PRODUCTION_SUPABASE_PROJECT,
} from "../src/lib/backendPolicy.mjs";

export const digest = (data) => createHash("sha256").update(data).digest("hex");

export function readPublicEnv(file) {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(
          /^(VITE_SUPABASE_[A-Z_]+)\s*=\s*["']?([^"'\r\n]*?)["']?\s*$/
        );
        return match ? [[match[1], match[2]]] : [];
      })
  );
}

export function validateCommittedBackend(root) {
  // Check both files, even when Vite's mode-specific file masks a reverted .env.
  for (const name of [".env", ".env.production"])
    validateBackend(readPublicEnv(path.join(root, name)));
  const project = readFileSync(
    path.join(root, "supabase/config.toml"),
    "utf8"
  ).match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (project !== PRODUCTION_SUPABASE_PROJECT)
    throw new Error(
      "Supabase CLI configuration must target the current production project."
    );
}

export function backendBuildPlugin({ root, mode, config }) {
  let outDir;
  let manifest;
  let revision;
  try {
    revision = execFileSync(
      "git",
      [
        "-c",
        `safe.directory=${root.replaceAll("\\", "/")}`,
        "rev-parse",
        "HEAD",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    throw new Error(
      "A PULSE build requires its Git revision for release verification."
    );
  }
  return {
    name: "pulse-backend-release",
    apply: "build",
    configResolved(resolved) {
      outDir = path.resolve(root, resolved.build.outDir);
    },
    closeBundle() {
      // Read the final bytes after Vite's HTML/CSS post-processing has finished.
      const walk = (directory, prefix = "") =>
        readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
          const name = `${prefix}${item.name}`;
          return item.isDirectory()
            ? walk(path.join(directory, item.name), `${name}/`)
            : [name];
        });
      const files = Object.fromEntries(
        walk(outDir)
          .filter((name) => /\.(js|html|css)$/.test(name) && name !== "sw.js")
          .map((name) => [name, digest(readFileSync(path.join(outDir, name)))])
      );
      manifest = {
        schema: 1,
        mode,
        projectId: config.projectId,
        url: config.url,
        revision,
        files,
      };
      // Vite copies public files unchanged. Stamp a different worker for each
      // release so old PWA asset caches are retired without clearing auth data.
      const worker = readFileSync(path.join(root, "public/sw.js"), "utf8");
      const stampedWorker = worker.replace(
        "pulse-v8-fast-refresh",
        `pulse-${digest(JSON.stringify(manifest)).slice(0, 20)}`
      );
      writeFileSync(path.join(outDir, "sw.js"), stampedWorker);
      manifest.files["sw.js"] = digest(stampedWorker);
      writeFileSync(
        path.join(outDir, "backend-release.json"),
        JSON.stringify(manifest, null, 2) + "\n"
      );
    },
  };
}
