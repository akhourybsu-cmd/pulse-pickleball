import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { configureVenueHosting } from './configure-venue-hosting.mjs';

const projectRef='rqfqwavhtfwwtmfjnxkx';
const accessToken='sbp_fixture';
const { privateKey }=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const account={type:'service_account',project_id:'pulse-pickleball-c60e1',client_email:'fixture@example.test',private_key:privateKey};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
test('preserves an existing integration secret without needing or overwriting the deployment key',async()=>{
  let calls=0;
  const result=await configureVenueHosting({accessToken,projectRef,fetchImpl:async()=>{calls++;return response([{name:'FIREBASE_HOSTING_SERVICE_ACCOUNT_JSON'}]);}});
  assert.equal(result,'already_configured'); assert.equal(calls,1);
});
test('configures only the named server secret on the approved project',async()=>{
  const calls=[];
  const result=await configureVenueHosting({accessToken,projectRef,firebaseAccount:JSON.stringify(account),fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?response([]):response({},201);}});
  assert.equal(result,'configured'); assert.equal(calls.length,2);
  assert.equal(calls[1].url,`https://api.supabase.com/v1/projects/${projectRef}/secrets`);
  const body=JSON.parse(calls[1].options.body); assert.equal(body.length,1); assert.equal(body[0].name,'FIREBASE_HOSTING_SERVICE_ACCOUNT_JSON'); assert.deepEqual(JSON.parse(body[0].value),account);
});
test('rejects a different backend before making any request',async()=>{
  await assert.rejects(()=>configureVenueHosting({accessToken,projectRef:'other',fetchImpl:()=>{throw new Error('should not call');}}),/approved PULSE/);
});
test('rejects missing, invalid, wrong-project and invalid-key accounts before writing',async()=>{
  for (const value of [undefined,'private-invalid-json',JSON.stringify({...account,project_id:'other'}),JSON.stringify({...account,private_key:'private-invalid-key'})]) {
    let calls=0;
    await assert.rejects(()=>configureVenueHosting({accessToken,projectRef,firebaseAccount:value,fetchImpl:async()=>{calls++;return response([]);}})); assert.equal(calls,1);
  }
});
test('fails closed without printing provider errors or credentials',async()=>{
  for(const phase of ['read','write']) {
    let calls=0;
    await assert.rejects(()=>configureVenueHosting({accessToken,projectRef,firebaseAccount:JSON.stringify(account),fetchImpl:async()=>{calls++;return phase==='read'||calls===2?response({private:'sensitive-provider-body'},403):response([]);}}),error=>error.message.includes('HTTP 403')&&!error.message.includes('sensitive-provider-body'));
  }
});
