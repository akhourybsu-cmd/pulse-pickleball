import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateAndroidRelease } from '../../scripts/check-android-release.mjs';

describe('Android release inputs', () => {
  const version = { VERSION_CODE: '13', VERSION_NAME: '1.1.0' };
  it('can build a signed bundle without any Play publishing credential', () => {
    expect(validateAndroidRelease(version)).toEqual({ versionCode: 13, versionName: '1.1.0', uploadToPlay: false });
  });
  it.each(['', '0', '-1', '1.5', '1e3', '13x', '2100000001', '999999999999999999'])('rejects invalid version code %s', code => {
    expect(() => validateAndroidRelease({ ...version, VERSION_CODE: code })).toThrow('VERSION_CODE');
  });
  it('accepts the maximum Play version code and a beta version name', () => {
    expect(validateAndroidRelease({ VERSION_CODE: '2100000000', VERSION_NAME: '1.1.0-beta.1' }).versionCode).toBe(2100000000);
  });
  it.each(['', 'latest', '1.1.0\n', '1.1.0; echo bad'])('rejects ambiguous or unsafe version names', name => {
    expect(() => validateAndroidRelease({ ...version, VERSION_NAME: name })).toThrow('VERSION_NAME');
  });
  it('requires an exact track and configured publishing credential only for an explicit upload', () => {
    expect(() => validateAndroidRelease({ ...version, UPLOAD_TO_PLAY: 'true' })).toThrow('track ID');
    expect(() => validateAndroidRelease({ ...version, UPLOAD_TO_PLAY: 'true', PLAY_TRACK: 'closed-beta' })).toThrow('not configured');
    expect(validateAndroidRelease({ ...version, UPLOAD_TO_PLAY: 'true', PLAY_TRACK: 'closed-beta', PLAY_SA: 'fixture' }).uploadToPlay).toBe(true);
    expect(validateAndroidRelease({ ...version, PLAY_SA: 'fixture' }).uploadToPlay).toBe(false);
  });
  it('uses explicit versions and never uploads merely because a secret exists', () => {
    const workflow = readFileSync('.github/workflows/android-release.yml', 'utf8');
    expect(workflow).not.toContain('github.run_number');
    expect(workflow).toContain('VERSION_CODE: ${{ inputs.version_code }}');
    expect(workflow).toContain('VERSION_NAME: ${{ inputs.version_name }}');
    expect(workflow).toContain('if: ${{ inputs.upload_to_play }}');
    expect(workflow).toContain('jarsigner -verify');
  });
});
