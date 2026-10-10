import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateAndroidRelease(env) {
  const code = env.VERSION_CODE ?? '';
  const name = env.VERSION_NAME ?? '';
  if (code.trim() !== code || !/^[1-9]\d*$/.test(code) || !Number.isSafeInteger(Number(code)) || Number(code) > 2_100_000_000) {
    throw new Error('VERSION_CODE must be a positive integer up to 2100000000. Choose an unused code greater than every Play upload.');
  }
  if (name.trim() !== name || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(name)) {
    throw new Error('VERSION_NAME must be a release version such as 1.1.0 or 1.1.0-beta.1.');
  }
  if (env.UPLOAD_TO_PLAY === 'true') {
    if (!env.PLAY_TRACK?.trim()) throw new Error('Enter the exact existing Play track ID before uploading.');
    if (!env.PLAY_SA?.trim()) throw new Error('PLAY_SERVICE_ACCOUNT_JSON is not configured. Build the signed bundle without automatic upload, then upload it in Play Console.');
  }
  return { versionCode: Number(code), versionName: name, uploadToPlay: env.UPLOAD_TO_PLAY === 'true' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const release = validateAndroidRelease(process.env);
    console.log(`Android ${release.versionName} (${release.versionCode}): ${release.uploadToPlay ? 'Play upload requested' : 'signed bundle only'}.`);
    console.log('Confirm this version code exceeds every existing Play upload; local validation cannot read Play Console.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
