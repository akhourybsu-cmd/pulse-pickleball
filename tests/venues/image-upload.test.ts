import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ prepare: vi.fn(), guard: vi.fn(), upload: vi.fn(), remove: vi.fn(), update: vi.fn(), single: vi.fn(), eq: vi.fn(), select: vi.fn() }));
vi.mock('@/lib/images/prepareImageUpload', async original => ({ ...await original<typeof import('@/lib/images/prepareImageUpload')>(), prepareImageForUpload: mock.prepare }));
vi.mock('@/lib/venues/privateMedia', () => ({ assertPublicVenueMediaUploadAllowed: mock.guard }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ update: mock.update }), storage: { from: () => ({ upload: mock.upload, remove: mock.remove, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://sample.supabase.co/storage/v1/object/public/venue-logos/${path}` } }) }) } } }));
import { uploadVenueImage, removeVenueImage, VENUE_IMAGE_OPTIONS } from '@/lib/venues/imageUpload';

const previous = 'https://sample.supabase.co/storage/v1/object/public/venue-logos/venue-1/old.png';
beforeEach(() => {
  vi.resetAllMocks();
  mock.guard.mockResolvedValue(undefined);
  mock.prepare.mockResolvedValue({ blob: new Blob(['image'], { type: 'image/webp' }), extension: 'webp', width: 2880, height: 960 });
  mock.upload.mockResolvedValue({ error: null }); mock.remove.mockResolvedValue({ error: null }); mock.single.mockResolvedValue({ data: { id: 'venue-1' }, error: null });
  mock.update.mockReturnValue({ eq: mock.eq }); mock.eq.mockReturnValue({ select: mock.select }); mock.select.mockReturnValue({ single: mock.single });
});
describe('venue image persistence', () => {
  it('preserves image proportions and stores an immutable high-quality banner before replacing its reference', async () => {
    const result = await uploadVenueImage('venue-1', 'cover', {} as File, previous);
    expect(mock.prepare).toHaveBeenCalledWith({}, VENUE_IMAGE_OPTIONS.cover);
    expect(VENUE_IMAGE_OPTIONS.cover).not.toHaveProperty('squareFit');
    expect(mock.upload).toHaveBeenCalledWith(expect.stringMatching(/^venue-1\/venue-cover-.*\.webp$/), expect.any(Blob), expect.objectContaining({ upsert: false, contentType: 'image/webp' }));
    expect(mock.update).toHaveBeenCalledWith({ cover_image_url: result.publicUrl });
    expect(mock.select).toHaveBeenCalledWith('id'); expect(mock.single).toHaveBeenCalled();
    expect(mock.remove).toHaveBeenCalledWith(['venue-1/old.png']);
    expect(mock.upload.mock.invocationCallOrder[0]).toBeLessThan(mock.update.mock.invocationCallOrder[0]);
    expect(mock.single.mock.invocationCallOrder[0]).toBeLessThan(mock.remove.mock.invocationCallOrder[0]);
  });
  it('keeps logos sharp without retaining oversized camera files', async () => {
    await uploadVenueImage('venue-1', 'logo', {} as File, null);
    expect(mock.prepare).toHaveBeenCalledWith({}, expect.objectContaining({ maxDimension: 1024, minWidth: 320, quality: 0.92 }));
    expect(mock.update).toHaveBeenCalledWith({ logo_url: expect.any(String) });
  });
  it('blocks private sample uploads before preparation or storage', async () => {
    mock.guard.mockRejectedValue(new Error('Private sample'));
    await expect(uploadVenueImage('venue-1', 'logo', {} as File, previous)).rejects.toThrow('Private sample');
    expect(mock.prepare).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled();
  });
  it('leaves previous images alone when validation or storage fails', async () => {
    mock.upload.mockResolvedValue({ error: new Error('Storage denied') });
    await expect(uploadVenueImage('venue-1', 'logo', {} as File, previous)).rejects.toThrow('Storage denied');
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
    mock.prepare.mockRejectedValue(new Error('Too small'));
    await expect(uploadVenueImage('venue-1', 'logo', {} as File, previous)).rejects.toThrow('Too small');
  });
  it('cleans only the new upload if saving the venue is denied or affects no row', async () => {
    mock.single.mockResolvedValue({ error: Object.assign(new Error('No venue row'), { code: 'PGRST116' }) });
    await expect(uploadVenueImage('venue-1', 'cover', {} as File, previous)).rejects.toThrow('No venue row');
    expect(mock.remove).toHaveBeenCalledTimes(1);
    expect(mock.remove).toHaveBeenCalledWith([mock.upload.mock.calls[0][0]]);
    expect(mock.remove).not.toHaveBeenCalledWith(['venue-1/old.png']);
  });
  it('preserves both files when a lost response makes the save outcome uncertain', async () => {
    mock.single.mockRejectedValue(new Error('Network interrupted'));
    await expect(uploadVenueImage('venue-1', 'cover', {} as File, previous)).rejects.toThrow('Network interrupted');
    expect(mock.remove).not.toHaveBeenCalled();
    mock.single.mockResolvedValue({ error: { message: 'Failed to fetch', code: '' } });
    await expect(uploadVenueImage('venue-1', 'cover', {} as File, previous)).rejects.toMatchObject({ message: 'Failed to fetch' });
    expect(mock.remove).not.toHaveBeenCalled();
  });
  it('never cleans images from another venue and tolerates old-file cleanup failure', async () => {
    await uploadVenueImage('venue-1', 'logo', {} as File, previous.replace('venue-1', 'other-venue'));
    expect(mock.remove).not.toHaveBeenCalled();
    mock.remove.mockRejectedValue(new Error('Cleanup unavailable'));
    await expect(uploadVenueImage('venue-1', 'logo', {} as File, previous)).resolves.toHaveProperty('publicUrl');
  });
  it('only removes the old file after confirming the profile no longer references it', async () => {
    mock.single.mockResolvedValueOnce({ error: new Error('Save denied') });
    await expect(removeVenueImage('venue-1', 'logo', previous)).rejects.toThrow('Save denied'); expect(mock.remove).not.toHaveBeenCalled();
    await removeVenueImage('venue-1', 'logo', previous);
    expect(mock.update).toHaveBeenLastCalledWith({ logo_url: null }); expect(mock.remove).toHaveBeenCalledWith(['venue-1/old.png']);
  });
});
