import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareImageForUpload } from '@/lib/images/prepareImageUpload';
const drawImage = vi.fn();
let width = 6000, height = 2000, outputType = 'image/webp';
const context = { drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: 'low' };
const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (done: (blob: Blob) => void) => done(new Blob(['normalized'], { type: outputType })) };
function file(type = 'image/jpeg', size = 100) { return { type, size } as File; }
beforeEach(() => {
  width = 6000; height = 2000; outputType = 'image/webp'; drawImage.mockClear();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('Image', class { naturalWidth = width; naturalHeight = height; onload?: () => void; set src(_value: string) { this.onload?.(); } });
  vi.stubGlobal('document', { createElement: () => canvas });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('real image preparation geometry', () => {
  it('downsizes a panoramic camera image proportionally with high-quality resampling', async () => {
    const image = await prepareImageForUpload(file(), { maxDimension: 2880 });
    expect([image.width, image.height]).toEqual([2880, 960]); expect(context.imageSmoothingQuality).toBe('high');
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2880, 960); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
  it('preserves portrait proportions rather than stretching to a banner', async () => {
    width = 2000; height = 6000;
    const image = await prepareImageForUpload(file(), { maxDimension: 2880 }); expect([image.width, image.height]).toEqual([960, 2880]);
  });
  it('does not enlarge a smaller valid source or re-encode a small transparent logo', async () => {
    width = 640; height = 480; const input = file('image/png');
    const image = await prepareImageForUpload(input, { maxDimension: 1024 }); expect(image.blob).toBe(input); expect(drawImage).not.toHaveBeenCalled();
  });
  it('uses the browser encoder’s actual file type when WebP is unsupported', async () => {
    outputType = 'image/png'; const image = await prepareImageForUpload(file()); expect(image.extension).toBe('png'); expect(image.blob.type).toBe('image/png');
  });
  it('rejects unsupported files, oversized input and insufficient resolution', async () => {
    await expect(prepareImageForUpload(file('image/svg+xml'))).rejects.toThrow('JPG, PNG, or WebP');
    await expect(prepareImageForUpload(file('image/jpeg', 13 * 1024 * 1024))).rejects.toThrow('12MB');
    width = 200; height = 200; await expect(prepareImageForUpload(file(), { minWidth: 320, minHeight: 320 })).rejects.toThrow('320×320');
  });
});
