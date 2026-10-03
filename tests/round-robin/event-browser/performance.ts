// Local fixture instrumentation only. No production telemetry or network writes.
import type { ProfilerOnRenderCallback } from 'react';

let started = performance.now();
let readyMs: number | null = null;
let renderMs = 0;
let commits = 0;
const reads: Record<string, number> = {};
let output: HTMLElement | null = null;
function display() {
  if (!output) return;
  output.textContent = JSON.stringify({
    readyMs: readyMs === null ? null : Math.round(readyMs),
    renderMs: Math.round(renderMs * 10) / 10,
    commits, reads,
    mountedRounds: document.querySelectorAll('.rr-schedule-carousel [aria-roledescription="slide"] > *').length,
  });
}
export function recordRead(name: string) {
  reads[name] = (reads[name] ?? 0) + 1;
  display();
}
export const recordRender: ProfilerOnRenderCallback = (_id, _phase, duration) => {
  renderMs += duration;
  commits++;
  if (readyMs === null && document.querySelector('.rr-event-page')) readyMs = performance.now() - started;
  display();
};
export function installPerformancePanel() {
  if (!new URLSearchParams(location.search).has('perf')) return;
  const panel = document.createElement('aside');
  panel.setAttribute('aria-label', 'Local performance measurements');
  panel.style.cssText = 'position:fixed;bottom:0;right:0;z-index:9999;max-width:520px;background:#fff;color:#111;padding:8px;border:1px solid #aaa;font:11px monospace';
  output = document.createElement('output');
  const reset = document.createElement('button');
  reset.textContent = 'Reset measurements';
  reset.onclick = () => {
    started = performance.now(); readyMs = null; renderMs = 0; commits = 0;
    Object.keys(reads).forEach(key => delete reads[key]);
    display();
  };
  panel.append(output, reset);
  document.body.append(panel);
  reset.click();
}
