import { readFileSync } from "node:fs";
import { digest } from "./backend-build.mjs";
import {
  PRODUCTION_SUPABASE_PROJECT,
  PRODUCTION_SUPABASE_URL,
} from "../src/lib/backendPolicy.mjs";

// Verify what Hosting serves, including its actual JS/HTML bytes, rather than
// trusting a successful upload or a project name printed by the build command.
async function verify() {
  const expected = JSON.parse(
    readFileSync("dist/backend-release.json", "utf8")
  );
  const get = async (name) => {
    const response = await fetch(
      `https://pulsepb.com/${name}?release=${expected.revision}`,
      { cache: "no-store", signal: AbortSignal.timeout(20_000) }
    );
    if (!response.ok)
      throw new Error(`Live release file unavailable (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  };
  const actual = JSON.parse(
    (await get("backend-release.json")).toString("utf8")
  );
  if (
    actual.mode !== "production" ||
    actual.projectId !== PRODUCTION_SUPABASE_PROJECT ||
    actual.url !== PRODUCTION_SUPABASE_URL ||
    actual.revision !== expected.revision ||
    JSON.stringify(actual.files) !== JSON.stringify(expected.files)
  )
    throw new Error(
      "Live PULSE does not match the verified production release."
    );
  const entries = Object.entries(expected.files);
  // Bounded batches keep this read-only verification light on Hosting.
  for (let index = 0; index < entries.length; index += 8) {
    await Promise.all(
      entries.slice(index, index + 8).map(async ([name, hash]) => {
        if (digest(await get(name)) !== hash)
          throw new Error(
            `Live release file differs from the verified build: ${name}`
          );
      })
    );
  }
  console.log(
    `Live PULSE verified: ${actual.projectId}, revision ${actual.revision}, ${entries.length} app files.`
  );
}

let failure;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await verify();
    failure = null;
    break;
  } catch (error) {
    failure = error;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
if (failure) {
  console.error(failure.message);
  process.exitCode = 1;
}
