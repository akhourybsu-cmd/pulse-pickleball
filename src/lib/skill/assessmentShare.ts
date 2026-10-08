import { SUBSKILL_LABELS } from './model';
import type { ScoringSnapshot } from './scoring';

export type AssessmentCardFormat = 'square' | 'portrait';
export const ASSESSMENT_CARD_SIZE = { square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 } };
export const ASSESSMENT_CARD_EXPORT_SCALE = 2;

/** Explicit allowlist: an exported card never contains answers or private diagnostics. */
export function assessmentShareSummary(snapshot: ScoringSnapshot, completedAt?: string | null) {
  const date = completedAt ? new Date(completedAt) : null;
  return {
    level: snapshot.estimatedLevelDisplay.toFixed(1),
    band: snapshot.displayBand,
    date: date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
    strengths: snapshot.strengths.filter(strength => snapshot.subskills.some(skill => skill.subskill === strength.subskill && !skill.insufficientEvidence)).slice(0, 3).map(strength => SUBSKILL_LABELS[strength.subskill]),
  };
}

export function assessmentCardName(name: string) {
  const printable = Array.from(name).filter(character => character.codePointAt(0)! >= 32 && character.codePointAt(0) !== 127).join('');
  return Array.from(printable.trim()).slice(0, 40).join('');
}

/** The preview SVG is also the export source: no remote images, fonts or uploads. */
export async function renderAssessmentCard(svg: SVGSVGElement, format: AssessmentCardFormat): Promise<File> {
  const { width, height } = ASSESSMENT_CARD_SIZE[format];
  const source = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('Card image preparation timed out')); }, 10_000);
      image.onload = () => { clearTimeout(timeout); resolve(); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Card image could not load')); };
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width * ASSESSMENT_CARD_EXPORT_SCALE;
    canvas.height = height * ASSESSMENT_CARD_EXPORT_SCALE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Card image could not be created')), 'image/png'));
    return new File([blob], `pulse-self-assessment-${format}.png`, { type: 'image/png' });
  } finally { URL.revokeObjectURL(url); }
}

export function downloadAssessmentCard(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    // Give Safari/embedded browsers time to consume the download URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Called with a prepared file directly from the click, retaining native user activation. */
export async function shareAssessmentCard(file: File, caption: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My PULSE self-assessment', text: caption });
      return 'shared';
    }
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return 'cancelled';
  }
  downloadAssessmentCard(file);
  return 'downloaded';
}
