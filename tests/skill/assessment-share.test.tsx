import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssessmentShareCard } from '../../src/components/skill/AssessmentShareCard';
import { ASSESSMENT_CARD_SIZE, assessmentCardName, assessmentShareSummary, renderAssessmentCard, shareAssessmentCard } from '../../src/lib/skill/assessmentShare';
import { QUESTION_BANK_V3 } from '../../src/lib/skill/questionBankV3';
import { QUESTION_BANK_V1 } from '../../src/lib/skill/questionBank';
import { scoreAssessment } from '../../src/lib/skill/scoring';

const snapshot = scoreAssessment(QUESTION_BANK_V3, Object.fromEntries(QUESTION_BANK_V3.map(i => [i.itemKey, i.subskill === 'serve' ? 'reliably' : 'usually'])));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('assessment card privacy and accurate reporting', () => {
  it('exports only display level, band, date and supported strengths', () => {
    const copy = structuredClone(snapshot);
    copy.strengths = [{ subskill: 'serve', displayLevel: 4, reason: 'private explanation' }, { subskill: 'backhand', displayLevel: 4, reason: 'private explanation' }];
    copy.subskills.find(s => s.subskill === 'backhand')!.insufficientEvidence = true;
    const summary = assessmentShareSummary(copy, '2026-10-08T16:00:00Z');
    expect(Object.keys(summary).sort()).toEqual(['band', 'date', 'level', 'strengths']);
    expect(summary.level).toBe(snapshot.estimatedLevelDisplay.toFixed(1));
    expect(summary.strengths).toEqual(['Serve']);
    expect(JSON.stringify(summary)).not.toContain('private explanation');
    expect(assessmentShareSummary(copy, 'invalid').date).toBeNull();
  });
  it.each(['square', 'portrait'] as const)('renders a self-contained %s image with explicit self-assessment labeling', format => {
    const html = renderToStaticMarkup(<AssessmentShareCard snapshot={snapshot} completedAt="2026-10-08T16:00:00Z" name="Alex & Jordan <script>" format={format} />);
    expect(html).toContain(`viewBox="0 0 1080 ${ASSESSMENT_CARD_SIZE[format].height}"`);
    expect(html).toContain('Alex &amp; Jordan &lt;script&gt;');
    expect(html).toContain('SELF-ASSESSED LEVEL');
    expect(html).toContain('Provisional self-report');
    expect(html).toContain('Not a match rating or DUPR rating');
    expect(html).not.toMatch(/<image|<foreignObject|<script/);
    expect(html).not.toContain('contradiction');
    expect(html).not.toContain('Confidence');
    expect(html).not.toContain('player_id');
  });
  it('supports legacy reports, anonymous cards and no relative strengths without inventing them', () => {
    const legacy = scoreAssessment(QUESTION_BANK_V1, Object.fromEntries(QUESTION_BANK_V1.map(i => [i.itemKey, 'usually'])));
    legacy.strengths = [];
    const html = renderToStaticMarkup(<AssessmentShareCard snapshot={legacy} name="" format="square" />);
    expect(html).toContain(legacy.estimatedLevelDisplay.toFixed(1));
    expect(html).toContain('My skill fingerprint');
    expect(html).toContain('Building a clearer picture');
    expect(html).not.toContain('MY SUPPORTED STRENGTHS');
    expect(assessmentCardName(' \nAlex\u0000 ')).toBe('Alex');
    expect(Array.from(assessmentCardName('🏓'.repeat(50)))).toHaveLength(40);
  });
});

describe('native image sharing and download fallback', () => {
  const file = new File(['image fixture'], 'pulse-self-assessment-square.png', { type: 'image/png' });
  function browser(share?: ReturnType<typeof vi.fn>, canShare?: ReturnType<typeof vi.fn>) {
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('navigator', { share, canShare });
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { appendChild: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:card');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    return link;
  }
  it('invokes native share immediately with the prepared image', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const link = browser(share, vi.fn(() => true));
    const pending = shareAssessmentCard(file, 'My caption');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'My PULSE self-assessment', text: 'My caption' });
    expect(await pending).toBe('shared');
    expect(link.click).not.toHaveBeenCalled();
  });
  it('treats a dismissed share sheet as cancellation, without a surprise download', async () => {
    const link = browser(vi.fn().mockRejectedValue({ name: 'AbortError' }), vi.fn(() => true));
    expect(await shareAssessmentCard(file, '')).toBe('cancelled');
    expect(link.click).not.toHaveBeenCalled();
  });
  it.each(['unavailable', 'unsupported', 'denied', 'canShare throws'])('downloads a PNG when native sharing is %s', async reason => {
    const share = reason === 'unavailable' ? undefined : vi.fn().mockRejectedValue({ name: 'NotAllowedError' });
    const canShare = vi.fn(() => { if (reason === 'canShare throws') throw new Error('unsupported'); return reason !== 'unsupported'; });
    const link = browser(share, canShare);
    expect(await shareAssessmentCard(file, '')).toBe('downloaded');
    expect(link.download).toBe(file.name);
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:card');
  });
});

describe('image preparation failures', () => {
  it('releases the image URL and returns control if image decoding stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('XMLSerializer', class { serializeToString() { return '<svg />'; } });
    vi.stubGlobal('Image', class { onload = null; onerror = null; src = ''; });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const promise = renderAssessmentCard({} as SVGSVGElement, 'square');
    const check = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(10_000);
    await check;
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pending');
  });
});
