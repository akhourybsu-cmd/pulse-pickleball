import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Isolated fixtures only. Never reads production credentials or creates events.
const cwd = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(new URL('../.qa-cache/', import.meta.url), { recursive: true });
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', 'tests/round-robin/scenario-performance.test.ts',
  'tests/round-robin/lifecycle-simulation.test.ts', '--maxWorkers=1',
], {
  cwd, stdio: 'inherit', env: { ...process.env,
    RR_BENCHMARK_REPORT: '.qa-cache/rr-after.json',
    RR_LIFECYCLE_REPORT: '.qa-cache/rr-lifecycle.json',
  },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
