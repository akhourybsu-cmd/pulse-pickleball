import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Synthetic, isolated PostgreSQL fixtures only. No credentials or live writes.
const cwd = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cwd, '.qa-cache');
const reportPath = path.join(output, 'round-robin-event-matrix.json');
const htmlPath = path.join(output, 'round-robin-event-matrix.html');
mkdirSync(output, { recursive: true });
for (const file of [reportPath, htmlPath]) rmSync(file, { force: true });
const run = spawnSync(process.execPath, [path.join(cwd, 'node_modules/vitest/vitest.mjs'), 'run',
  'tests/round-robin/event-matrix.test.ts', '--maxWorkers=1', '--reporter=verbose'], {
  cwd, stdio: 'inherit', env: { ...process.env, RR_EVENT_MATRIX_REPORT: reportPath },
});
if (run.error) throw run.error;
if (!existsSync(reportPath)) throw new Error('The event test did not produce a report.');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const passed = run.status === 0 && report.totals.passed === 32 && report.finalReconciliation === 'passed';
const cards = [
  [report.totals.passed + ' / 32', 'Events passed'], [report.totals.scoredMatches.toLocaleString(), 'Scored matches'],
  [report.totals.scoreCalls.toLocaleString(), 'Score submissions'], [report.totals.participantResults.toLocaleString(), 'Player results reconciled'],
  [report.totals.retries, 'Safe retries'], [report.totals.rejectedChanges, 'Rejected changes checked'],
];
writeFileSync(htmlPath, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PULSE round-robin event test report</title><style>
:root{font-family:system-ui,sans-serif;color:#eaf0f4;background:#10171d;line-height:1.55}body{margin:0;padding:24px}main{max-width:1180px;margin:auto}h1{line-height:1.15;font-size:clamp(28px,4vw,44px);margin:12px 0}.eyebrow{color:#e5bf66;letter-spacing:.14em;font-weight:700}.lead{max-width:850px;color:#bdcbd4}.status{display:inline-block;border:1px solid ${passed ? '#75daba' : '#f59898'};color:${passed ? '#75daba' : '#f59898'};padding:6px 12px;border-radius:20px;font-weight:700}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:24px 0}.card{padding:20px;border:1px solid #34424d;border-radius:12px;background:#18232c}.card b{display:block;font-size:28px;color:#e5bf66}.card span{font-size:13px;color:#bdcbd4}.box{padding:18px;border:1px solid #34424d;border-radius:12px;margin:18px 0}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:10px;border-bottom:1px solid #34424d}th{color:#e5bf66;white-space:nowrap}td:nth-child(2){min-width:220px}.pass{color:#75daba}.fail{color:#f59898}small{color:#a6bac8}code{color:#e5bf66}ul{padding-left:22px}a{color:#75daba}</style>
<main><div class="eyebrow">PULSE / QUALITY ASSURANCE</div><h1>32-event round-robin test</h1><p class="status">${passed ? 'All events and final reconciliation passed' : 'Review required — see results below'}</p>
<p class="lead">Complete synthetic events from start through scoring, live adjustments and completion. Every round reconciles its standings, match history and player totals. All events share one isolated database.</p><small>Generated ${esc(report.generatedAt)} · Application behavior exercised through production scheduling code and SQL functions.</small>
<div class="cards">${cards.map(([value,label]) => `<div class="card"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('')}</div>
<div class="box"><strong>Coverage</strong><ul><li>4–128 players, 1–16 courts, open, mixed, men’s and women’s formats, rated and unrated play.</li><li>Guests and claimed accounts, one-round and permanent replacements, departures, abandoned games, partner/opponent/court edits.</li><li>Shutouts, close games, extended scores, corrections, voided results, stale requests, duplicate submissions, and forced transaction rollback.</li><li>Final cached ratings and participant rating snapshots checked against a full history replay: <strong>${esc(report.finalReconciliation)}</strong>.</li></ul></div>
<div class="box"><strong>What these results establish</strong><p>${esc(report.environment)}. Burst scoring queues requests on one database connection. This does not measure live Supabase network latency, simultaneous users, mobile UI behavior, or realtime delivery. No production events, accounts, or ratings were modified.</p><p>The small test schema now loads existing production indexes. Instrumentation confirmed that normal score submissions did not replay the entire rating history. Deliberate corrections and voids did, as required.</p></div>
<h2>Scenario results</h2><div class="scroll"><table><thead><tr><th>#</th><th>Scenario</th><th>Players</th><th>Courts</th><th>Rounds</th><th>Matches</th><th>Score calls</th><th>Retries</th><th>Result</th></tr></thead><tbody>${report.events.map(r => `<tr><td>${r.number}</td><td>${esc(r.name)}${r.error ? `<br><small>${esc(r.error)}</small>` : ''}</td><td>${r.players}</td><td>${r.courts}</td><td>${r.rounds}</td><td>${r.scoredMatches}</td><td>${r.scoreCalls}</td><td>${r.retries}</td><td class="${r.status === 'passed' ? 'pass' : 'fail'}">${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>
<div class="box"><strong>Repeat this test</strong><p><code>npm run test:round-robin-events</code></p><p>Writes the full JSON evidence and this HTML report into <code>.qa-cache</code>. The same scenarios also run with the repository’s normal test suite.</p></div></main></html>`);
console.info(`Event report: ${htmlPath}`);
process.exitCode = passed ? 0 : 1;
