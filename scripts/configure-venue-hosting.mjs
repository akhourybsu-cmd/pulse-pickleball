import { createPrivateKey } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PRODUCTION_SUPABASE_PROJECT } from '../src/lib/backendPolicy.mjs';

const secretName = 'FIREBASE_HOSTING_SERVICE_ACCOUNT_JSON';

export async function configureVenueHosting({ accessToken, projectRef, firebaseAccount, fetchImpl = fetch }) {
  if (projectRef !== PRODUCTION_SUPABASE_PROJECT || !accessToken?.startsWith('sbp_')) throw new Error('Expected the approved PULSE production project and deployment credential.');
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/secrets`;
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const existing = await fetchImpl(endpoint, { headers, signal: AbortSignal.timeout(30_000) });
  if (!existing.ok) throw new Error(`Could not check venue hosting configuration (HTTP ${existing.status}).`);
  const names = await existing.json();
  if (!Array.isArray(names)) throw new Error('Unexpected secret metadata response.');
  // Preserve a separately provisioned or rotated integration credential.
  if (names.some(secret => secret.name === secretName)) return 'already_configured';
  let account;
  try { account = JSON.parse(firebaseAccount); } catch { throw new Error('The PULSE Firebase deployment credential is missing or invalid.'); }
  if (account?.type !== 'service_account' || account.project_id !== 'pulse-pickleball-c60e1' || typeof account.client_email !== 'string' || typeof account.private_key !== 'string') throw new Error('Expected the production PULSE Firebase service account.');
  try { createPrivateKey(account.private_key); } catch { throw new Error('The Firebase service-account key is invalid.'); }
  const response = await fetchImpl(endpoint, {
    method: 'POST', headers, body: JSON.stringify([{ name: secretName, value: JSON.stringify(account) }]), signal: AbortSignal.timeout(30_000),
  });
  // Never log credential-bearing request bodies or provider response bodies.
  if (!response.ok) throw new Error(`Could not configure venue hosting (HTTP ${response.status}).`);
  return 'configured';
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await configureVenueHosting({ accessToken: process.env.SUPABASE_ACCESS_TOKEN, projectRef: process.env.SUPABASE_PROJECT_REF, firebaseAccount: process.env.FIREBASE_SERVICE_ACCOUNT_JSON });
    console.log(`PULSE venue hosting credential: ${result}.`);
  } catch {
    console.error('Venue hosting credential setup failed. Check the production Firebase secret and Supabase secret-management permissions. No secret values were logged.');
    process.exitCode = 1;
  }
}
