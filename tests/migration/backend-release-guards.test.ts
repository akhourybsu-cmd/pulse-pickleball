import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  validateBackend,
  PRODUCTION_SUPABASE_PROJECT,
  PRODUCTION_SUPABASE_URL,
  STAGING_SUPABASE_PROJECT,
} from "../../src/lib/backendPolicy.mjs";
import {
  digest,
  validateCommittedBackend,
} from "../../scripts/backend-build.mjs";
import { validateArtifact } from "../../scripts/check-backend-artifact.mjs";
import { validateReleaseContext } from "../../scripts/check-production-release.mjs";

const folders: string[] = [];
const temporary = () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pulse-backend-"));
  folders.push(directory);
  return directory;
};
afterEach(() =>
  folders
    .splice(0)
    .forEach((folder) => rmSync(folder, { recursive: true, force: true }))
);
const env = (project = PRODUCTION_SUPABASE_PROJECT) => ({
  VITE_SUPABASE_PROJECT_ID: project,
  VITE_SUPABASE_URL: `https://${project}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
});
const revision = "a".repeat(40);
function artifact() {
  const directory = temporary();
  mkdirSync(path.join(directory, "assets"));
  const files = {
    "index.html": '<script src="/assets/app.js"></script>',
    "assets/app.js": `fetch('${PRODUCTION_SUPABASE_URL}/auth/v1/settings')`,
  };
  const manifest = {
    schema: 1,
    mode: "production",
    projectId: PRODUCTION_SUPABASE_PROJECT,
    url: PRODUCTION_SUPABASE_URL,
    revision,
    files: Object.fromEntries(
      Object.entries(files).map(([name, data]) => [name, digest(data)])
    ),
  };
  for (const [name, data] of Object.entries(files))
    writeFileSync(path.join(directory, name), data);
  const save = () =>
    writeFileSync(
      path.join(directory, "backend-release.json"),
      JSON.stringify(manifest)
    );
  save();
  return { directory, manifest, save };
}

describe("backend migration boundaries", () => {
  it.each(["production", "development", "test", "preview"])(
    "blocks a retired backend in %s mode",
    (mode) => {
      expect(() =>
        validateBackend(env("ryxklkayezjnwwunuphn"), mode)
      ).toThrow();
      expect(validateBackend(env(), mode).projectId).toBe(
        PRODUCTION_SUPABASE_PROJECT
      );
    }
  );
  it("allows only the approved staging project, and never on production hosts", () => {
    expect(
      validateBackend(env(STAGING_SUPABASE_PROJECT), "staging", "localhost")
        .projectId
    ).toBe(STAGING_SUPABASE_PROJECT);
    expect(() =>
      validateBackend(env("ryxklkayezjnwwunuphn"), "staging")
    ).toThrow();
    for (const host of [
      "pulsepb.com",
      "www.pulsepb.com",
      "pulse-pickleball-c60e1.web.app",
      "pulse-pickleball-c60e1.firebaseapp.com",
    ])
      expect(() =>
        validateBackend(env(STAGING_SUPABASE_PROJECT), "staging", host)
      ).toThrow();
  });
  it("catches a reverted base .env even when .env.production masks it", () => {
    const directory = temporary();
    const serialize = (values) =>
      Object.entries(values)
        .map(([key, value]) => `${key}="${value}"`)
        .join("\n");
    writeFileSync(path.join(directory, ".env.production"), serialize(env()));
    writeFileSync(
      path.join(directory, ".env"),
      serialize(env("ryxklkayezjnwwunuphn"))
    );
    expect(() => validateCommittedBackend(directory)).toThrow(
      /must use Supabase project/
    );
  });
  it("keeps the checked-in CLI and frontend targets aligned", () => {
    expect(() => validateCommittedBackend(process.cwd())).not.toThrow();
  });
  it("requires the latest main revision and approved deployment target", () => {
    const release = {
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: revision,
      SUPABASE_PROJECT_REF: PRODUCTION_SUPABASE_PROJECT,
    };
    expect(() =>
      validateReleaseContext(release, revision, revision)
    ).not.toThrow();
    expect(() =>
      validateReleaseContext(
        { ...release, GITHUB_REF: "refs/heads/old-preview" },
        revision,
        revision
      )
    ).toThrow();
    expect(() =>
      validateReleaseContext(release, revision, "b".repeat(40))
    ).toThrow();
    expect(() =>
      validateReleaseContext(
        { ...release, SUPABASE_PROJECT_REF: STAGING_SUPABASE_PROJECT },
        revision,
        revision
      )
    ).toThrow();
  });
});

describe("production artifacts", () => {
  it("accepts a complete production bundle and checks its revision", () => {
    const { directory } = artifact();
    expect(validateArtifact(directory, { revision }).projectId).toBe(
      PRODUCTION_SUPABASE_PROJECT
    );
    expect(() =>
      validateArtifact(directory, { revision: "b".repeat(40) })
    ).toThrow(/revision/);
  });
  it("rejects staging, missing files, and changed bundle contents", () => {
    const { directory, manifest, save } = artifact();
    manifest.mode = "staging";
    save();
    expect(() => validateArtifact(directory)).toThrow(/production/);
    manifest.mode = "production";
    save();
    writeFileSync(path.join(directory, "assets/app.js"), "tampered");
    expect(() => validateArtifact(directory)).toThrow(/modified/);
    rmSync(path.join(directory, "assets/app.js"));
    expect(() => validateArtifact(directory)).toThrow(/incomplete/);
  });
  it("rejects retired or foreign endpoints even when hashes are regenerated", () => {
    for (const project of [
      "ryxklkayezjnwwunuphn",
      STAGING_SUPABASE_PROJECT,
      "another-project",
    ]) {
      const { directory, manifest, save } = artifact();
      const code = `fetch('https://${project}.supabase.co/rest/v1/profiles')`;
      manifest.files["assets/app.js"] = digest(code);
      save();
      writeFileSync(path.join(directory, "assets/app.js"), code);
      expect(() => validateArtifact(directory)).toThrow(
        /retired|another Supabase/
      );
    }
  });
  it("prevents native remote-server overrides and wrong app identities", () => {
    const { directory } = artifact();
    const nativeConfig = path.join(directory, "capacitor.config.json");
    writeFileSync(nativeConfig, JSON.stringify({ appId: "com.pulsepb.app" }));
    expect(() => validateArtifact(directory, { nativeConfig })).not.toThrow();
    writeFileSync(
      nativeConfig,
      JSON.stringify({
        appId: "com.pulsepb.app",
        server: { url: "https://preview.example.com" },
      })
    );
    expect(() => validateArtifact(directory, { nativeConfig })).toThrow(
      /remote server/
    );
  });
});

describe("client configuration ownership", () => {
  it("routes every application env read through the validated config", () => {
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : [path.join(directory, entry.name)]
      );
    for (const file of walk("src").filter(
      (file) => /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\./.test(file)
    )) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /import\.meta\.env\.VITE_SUPABASE_/
      );
    }
  });
});
