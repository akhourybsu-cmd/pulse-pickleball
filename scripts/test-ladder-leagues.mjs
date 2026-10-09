import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(cwd, '.qa-cache');
const reportPath = path.join(output, 'ladder-season-matrix.json');
const htmlPath = path.join(output, 'ladder-season-matrix.html');
mkdirSync(output, { recursive: true });
for (const file of [reportPath, htmlPath]) rmSync(file, { force: true });
const run = spawnSync(process.execPath, [path.join(cwd, 'node_modules/vitest/vitest.mjs'), 'run',
  'tests/leagues/ladder-season-matrix.test.ts', '--maxWorkers=1', '--reporter=verbose'], {
  cwd, stdio: 'inherit', env: { ...process.env, LADDER_SEASON_REPORT: reportPath },
});
if (run.error) throw run.error;
if (!existsSync(reportPath)) throw new Error('The ladder tests did not produce a report.');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const passed = run.status === 0 && report.expectedLeagues > 0
  && report.totals.leagues === report.expectedLeagues && report.totals.passed === report.expectedLeagues
  && report.finalReconciliation === 'passed';
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cards = [[`${report.totals.passed} / ${report.expectedLeagues}`, 'League seasons passed'],
  [report.totals.games, 'Completed games'], [report.totals.playerResults, 'Player results reconciled'],
  [report.totals.retries, 'Safe retries'], [report.totals.rejectedActions, 'Rejected actions checked'],
  [report.totals.tieDecisions, 'Tiebreak decisions']];
writeFileSync(htmlPath, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PULSE ladder league test report</title><style>
:root{font-family:system-ui,sans-serif;color:#eaf0f4;background:#10171d;line-height:1.55}body{margin:0;padding:24px}main{max-width:1180px;margin:auto}h1{line-height:1.15;font-size:clamp(28px,4vw,44px);margin:12px 0}.eyebrow{color:#e5bf66;letter-spacing:.14em;font-weight:700}.lead{max-width:850px;color:#bdcbd4}.status{display:inline-block;border:1px solid ${passed ? '#75daba' : '#f59898'};color:${passed ? '#75daba' : '#f59898'};padding:6px 12px;border-radius:20px;font-weight:700}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:24px 0}.card{padding:20px;border:1px solid #34424d;border-radius:12px;background:#18232c}.card b{display:block;font-size:28px;color:#e5bf66}.card span{font-size:13px;color:#bdcbd4}.box{padding:18px;border:1px solid #34424d;border-radius:12px;margin:18px 0}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:10px;border-bottom:1px solid #34424d}th{color:#e5bf66;white-space:nowrap}td:nth-child(2){min-width:220px}.pass{color:#75daba}.fail{color:#f59898}small{color:#a6bac8}code{color:#e5bf66}ul{padding-left:22px}</style></head>
<body><main><div class="eyebrow">PULSE / QUALITY ASSURANCE</div><h1>Ladder league season tests</h1><p class="status">${passed ? 'All seasons and final reconciliation passed' : 'Review required — see results below'}</p>
<p class="lead">Complete seasons from the opening draw through league completion. Each batch checks the real scores, player accounts, standings, court rotations, ladder movements and saved results. Expected movement and player totals are calculated independently of the production ladder engine.</p><small>Generated ${esc(report.generatedAt)}</small>
<div class="cards">${cards.map(([value, label]) => `<div class="card"><b>${esc(typeof value === 'number' ? value.toLocaleString() : value)}</b><span>${esc(label)}</span></div>`).join('')}</div>
<div class="box"><strong>What was exercised</strong><ul><li>4–32 players, constrained court capacity and multiple waves, three- and four-week seasons, one to three batches per week.</li><li>Opponent-confirmed scores, self-reporting and organizer scoring; ranked and unranked leagues.</li><li>Manual and automatic progression, promotion/relegation ties, absent players, returning substitutes, sit-outs and permanent replacements.</li><li>Missing schedules, unresolved requests, stale confirmations, invalid scores, outsider access, repeated requests and premature season closure.</li><li>Reopening a processed batch, protecting played downstream games, explicitly discarding and regenerating results, and removing obsolete rating inputs.</li></ul></div>
<div class="box"><strong>Result integrity</strong><p>${passed ? `All ${report.totals.playerResults.toLocaleString()} player results reconciled with the score ledger. ${report.totals.ratingInputs.toLocaleString()} eligible games were checked against their rating-input match and the four actual players who played. Unranked league games produced no rating-input rows. Earlier seasons remained unchanged; no orphaned rating-input rows remained.` : 'The run is incomplete or failed. Review the scenario errors and JSON evidence; partial counters do not establish a passing result.'}</p><p>Ladder positions are separate from PULSE skill ratings. These checks verify ladder movement and the data sent to the PULSE rating engine; they do not recalculate global PULSE ratings or compare them with DUPR.</p></div>
<h2>Scenario results</h2><div class="scroll"><table><thead><tr><th>#</th><th>Scenario</th><th>Players</th><th>Courts</th><th>Weeks</th><th>Batches</th><th>Games</th><th>Result</th></tr></thead><tbody>${report.scenarios.map(r => `<tr><td>${r.number}</td><td>${esc(r.name)}${r.error ? `<br><small>${esc(r.error)}</small>` : ''}</td><td>${r.players}</td><td>${r.courts}</td><td>${r.weeks}</td><td>${r.batches}</td><td>${r.games}</td><td class="${r.status === 'passed' ? 'pass' : 'fail'}">${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>
<div class="box"><strong>Test environment and limits</strong><p>${esc(report.environment)}</p><p>All fixtures are synthetic. No live league, player, schedule, score or rating was modified.</p></div>
<div class="box"><strong>Repeat this test</strong><p><code>npm run test:ladder-leagues</code></p><p>Creates JSON evidence and this HTML report in <code>.qa-cache</code>. These scenarios also run in the normal repository test suite.</p></div></main></body></html>`);
console.info(`Ladder report: ${htmlPath}`);
process.exitCode = passed ? 0 : 1;
