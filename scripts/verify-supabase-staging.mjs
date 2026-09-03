// Destination-only integration smoke test. Creates isolated, unpublished
// fixtures and deletes only the IDs/objects created by this run. Sends no email.
// Inject keys in process memory; never write them to a report or the repository.
import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const ref = 'rqfqwavhtfwwtmfjnxkx';
const url = `https://${ref}.supabase.co`;
const serviceKey = process.env.PULSE_STAGING_SERVICE_ROLE_KEY;
const anonKey = process.env.PULSE_STAGING_ANON_KEY;
const secretKey = process.env.PULSE_STAGING_SECRET_KEY;
if (!process.argv.includes('--allow-fixtures') || !serviceKey || !anonKey) {
  throw new Error('Requires --allow-fixtures and PULSE_STAGING_SERVICE_ROLE_KEY / PULSE_STAGING_ANON_KEY in memory.');
}
const options = { auth: { persistSession: false, autoRefreshToken: false },
  realtime: { logger: (kind, message) => {
    if (process.argv.includes('--realtime-debug')) console.log(JSON.stringify({ realtime: kind,
      message: String(message).replace(/eyJ[A-Za-z0-9_.-]+/g, '[redacted-token]').replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[redacted-key]') }));
  } },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(25000) }) } };
const admin = createClient(url, serviceKey, options);
const anon = createClient(url, anonKey, options);
const users = [], clients = [], objects = [], channels = [];
const run = randomUUID();
const groupId = randomUUID(), venueId = randomUUID();
let groupCreated = false, venueCreated = false, conversationId, friendshipId;
const results = [];
const safeMessage = (error) => [serviceKey, anonKey, secretKey].filter(Boolean).reduce((message, key) => message.split(key).join('[redacted]'), String(error?.message ?? error));
async function data(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}
async function check(name, action) {
  const started = Date.now();
  try { await action(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', error: safeMessage(error) }); }
  results.at(-1).elapsedMs = Date.now() - started;
  console.log(JSON.stringify(results.at(-1)));
}
async function expectStatus(name, token, expected, apiKey = anonKey) {
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST', headers: { apikey: apiKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(25000),
  });
  const body = await response.text();
  assert.equal(response.status, expected, `${name} returned ${response.status}, expected ${expected}: ${safeMessage(body)}`);
}
async function observeInsert(client, table, filter, write, repetitions = 1) {
  let resolveEvent = () => {};
  const channel = client.channel(`migration-qa-${table}-${randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, payload => resolveEvent(payload.new));
  channels.push([client, channel]);
  let timer;
  try {
    await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${table}: subscription timeout`)), 20000);
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(`${table}: ${status}${error ? ` (${safeMessage(error)})` : ''}`)); }
      });
    });
    // Keep the chat subscription alive across messages as the app does.
    // Repeatedly removing the last channel and immediately adding a new one
    // races the SDK's asynchronous socket disconnect, testing teardown instead.
    for (let index = 0; index < repetitions; index++) {
      const event = new Promise(resolve => { resolveEvent = resolve; });
      const inserted = await write(index);
      const received = await Promise.race([event, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${table}: change delivery timeout`)), 15000);
      })]);
      clearTimeout(timer);
      assert.equal(received.id, inserted.id);
    }
  } finally {
    clearTimeout(timer);
    await client.removeChannel(channel);
    const index = channels.findIndex(([, tracked]) => tracked === channel);
    if (index !== -1) channels.splice(index, 1);
  }
}

try {
  await check('Email dispatcher rejects a forged service-role claim', async () => {
    const forged = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"role":"service_role"}').toString('base64url')}.`;
    await expectStatus('process-email-queue', forged, 401);
  });
  await check('Transactional email rejects the public anon credential', () => expectStatus('send-transactional-email', anonKey, 401));
  if (secretKey) {
    await check('Transactional email authorizes server caller before body validation', () => expectStatus('send-transactional-email', undefined, 400, secretKey));
  } else {
    results.push({ name: 'Transactional email authorizes server caller before body validation', status: 'SKIP', reason: 'Supply an active PULSE_STAGING_SECRET_KEY or verify with the dashboard managed-secret test.' });
    console.log(JSON.stringify(results.at(-1)));
  }

  for (const label of ['a', 'b']) {
    const email = `pulse-migration-${run}-${label}@example.com`;
    const password = `Qa!${randomBytes(24).toString('base64url')}`;
    const created = await data(admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { full_name: `Migration QA ${label}`, display_name: `Migration QA ${label}` } }));
    assert.ok(created.user?.id);
    users.push(created.user.id);
    const client = createClient(url, anonKey, options);
    clients.push(client);
    await data(client.auth.signInWithPassword({ email, password }));
  }
  const [a, b] = clients, [aId, bId] = users;
  await check('Two independent email/password logins and profile creation', async () => {
    assert.equal((await data(a.auth.getUser())).user.id, aId);
    assert.equal((await data(b.auth.getUser())).user.id, bId);
    assert.equal((await data(admin.from('profiles').select('id').in('id', users))).length, 2);
  });
  if (process.argv.includes('--verify-nested-email')) {
    await check('Existing Edge Function server credential authorizes nested email call', async () => {
      const probe = await data(a.functions.invoke('migration-email-auth-check'));
      assert.equal(probe.nestedStatus, 400, 'Empty nested email request must reach body validation');
    });
  }
  await data(admin.from('venues').insert({ id: venueId, name: `Migration QA ${run}`, slug: `migration-qa-${run}`,
    owner_id: aId, is_published: false, is_searchable: false, is_active: false, description: 'Migration test only', timezone: 'America/New_York' }));
  venueCreated = true;
  // The official-group trigger requires an actual venue owner's auth.uid(),
  // including for privileged callers. Exercise the same identity as the app.
  await data(a.from('groups').insert({ id: groupId, name: `Migration QA ${run}`, created_by: aId,
    type: 'venue_official', visibility: 'unlisted', venue_id: venueId }));
  groupCreated = true;
  await data(admin.from('group_members').upsert([
    { group_id: groupId, user_id: aId, role: 'owner', status: 'active' },
    { group_id: groupId, user_id: bId, role: 'member', status: 'active' },
  ], { onConflict: 'group_id,user_id' }));
  await data(admin.from('venue_staff').upsert({ venue_id: venueId, user_id: aId, role: 'owner', status: 'active', is_active: true, accepted_at: new Date().toISOString() }, { onConflict: 'venue_id,user_id' }));

  await check('Community settings save and canonical audit log', async () => {
    await data(a.from('groups').update({ description: 'QA settings change' }).eq('id', groupId).select().single());
    const audit = await data(a.from('group_audit_log').select('actor_user_id,metadata').eq('group_id', groupId).eq('action', 'settings_changed'));
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_user_id, aId);
    assert.equal(audit[0].metadata.after.description, 'QA settings change');
  });

  await check('Venue program, court holds, overlap protection, RSVP waitlist and release', async () => {
    const courts = await data(admin.from('venue_courts').insert([1, 2].map(number => ({ venue_id: venueId, court_number: number, name: `QA Court ${number}`, is_active: true }))).select('id'));
    const start = new Date(Date.now() + 7 * 86400000).toISOString();
    const end = new Date(Date.now() + 7 * 86400000 + 3600000).toISOString();
    const base = { group_id: groupId, created_by: aId, title: 'Migration QA program', venue_id: venueId,
      location_type: 'venue', start_time: start, end_time: end, capacity: 1 };
    const event = await data(a.from('group_events').insert({ ...base, event_format: 'open_play', rotation_style: 'paddle_stack', waitlist_enabled: true }).select().single());
    const holds = courts.map(court => ({ ...base, venue_court_id: court.id, parent_event_id: event.id, event_format: 'program_hold', waitlist_enabled: false }));
    await data(a.from('group_events').insert(holds));
    const overlap = await a.from('group_events').insert({ ...base, venue_court_id: courts[0].id, event_format: 'reservation' });
    assert.equal(overlap.error?.code, '23P01', 'The database must reject double booking');
    assert.equal(await data(a.rpc('set_group_event_rsvp', { p_event_id: event.id, p_status: 'going' })), 'going');
    assert.equal(await data(b.rpc('set_group_event_rsvp', { p_event_id: event.id, p_status: 'going' })), 'waitlist');
    await data(a.rpc('set_group_event_rsvp', { p_event_id: event.id, p_status: 'not_going' }));
    assert.equal((await data(b.from('group_event_rsvps').select('status').eq('event_id', event.id).eq('user_id', bId).single())).status, 'going');
    await data(a.from('group_events').delete().eq('id', event.id));
    assert.equal((await data(admin.from('group_events').select('id').eq('parent_event_id', event.id))).length, 0);
  });

  await check('Two-account realtime venue chat delivery', async () => {
    await observeInsert(b, 'group_messages', `group_id=eq.${groupId}`, attempt => data(a.from('group_messages')
      .insert({ group_id: groupId, user_id: aId, content: `Migration test ${run} #${attempt}` }).select().single()), 3);
  });
  await check('Member reply, message edit, and shared history', async () => {
    const reply = await data(b.from('group_messages').insert({ group_id: groupId, user_id: bId, content: 'QA reply' }).select().single());
    await data(b.rpc('edit_group_message', { p_message_id: reply.id, p_content: 'QA edited reply' }));
    assert.equal((await data(a.from('group_messages').select('content').eq('id', reply.id).single())).content, 'QA edited reply');
    const forbidden = await a.rpc('edit_group_message', { p_message_id: reply.id, p_content: 'Must not overwrite another author' });
    assert.ok(forbidden.error, 'Even an owner must not rewrite someone else\'s message');
  });
  await check('Venue post create, read, edit, and delete', async () => {
    const post = await data(a.from('group_posts').insert({ group_id: groupId, user_id: aId, type: 'feed', content: 'QA post' }).select().single());
    assert.equal((await data(b.from('group_posts').select('id').eq('id', post.id))).length, 1);
    assert.equal((await data(a.from('group_posts').update({ content: 'QA edited post' }).eq('id', post.id).select().single())).content, 'QA edited post');
    await data(a.from('group_posts').delete().eq('id', post.id));
    assert.equal((await data(b.from('group_posts').select('id').eq('id', post.id))).length, 0);
  });
  await check('Anonymous caller cannot read venue chat', async () => {
    const result = await anon.from('group_messages').select('id').eq('group_id', groupId);
    assert.ok(result.error || result.data.length === 0);
  });

  // Valid 1x1 PNG; no user images or personal data are uploaded.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
  const prefixes = { avatars: aId, groups: groupId, 'group-files': groupId, 'group-message-images': groupId,
    'group-post-images': groupId, 'venue-logos': venueId, 'tournament-assets': aId };
  for (const [bucket, prefix] of Object.entries(prefixes)) {
    await check(`Authenticated upload, public download, and deletion: ${bucket}`, async () => {
      const path = `${prefix}/migration-qa-${run}.png`;
      await data(a.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: false }));
      objects.push([bucket, path]);
      const publicUrl = a.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      assert.equal(new URL(publicUrl).hostname, `${ref}.supabase.co`);
      const response = await fetch(publicUrl, { signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      await data(a.storage.from(bucket).remove([path]));
      const remaining = await data(admin.storage.from(bucket).list(prefix, { search: `migration-qa-${run}.png` }));
      assert.equal(remaining.length, 0);
    });
  }
  await check('One atomic venue, community, and staff ownership transfer', async () => {
    const settings = (await data(admin.from('groups').select('settings').eq('id', groupId).single())).settings;
    const transfer = await data(a.rpc('transfer_group_ownership', { p_group_id: groupId, p_new_owner_id: bId }));
    assert.equal(transfer.venue_transferred, true);
    const venue = await data(admin.from('venues').select('owner_id,description,timezone').eq('id', venueId).single());
    assert.equal(venue.owner_id, bId);
    assert.equal(venue.description, 'Migration test only');
    assert.equal(venue.timezone, 'America/New_York');
    const members = await data(admin.from('group_members').select('user_id,role').eq('group_id', groupId));
    assert.equal(members.find(m => m.user_id === bId).role, 'owner');
    assert.equal(members.find(m => m.user_id === aId).role, 'moderator');
    const staff = await data(admin.from('venue_staff').select('user_id,role,is_active,status').eq('venue_id', venueId));
    assert.equal(staff.find(m => m.user_id === bId).role, 'owner');
    assert.equal(staff.find(m => m.user_id === aId).role, 'manager');
    assert.deepEqual((await data(admin.from('groups').select('settings').eq('id', groupId).single())).settings, settings);
    const denied = await a.rpc('transfer_group_ownership', { p_group_id: groupId, p_new_owner_id: bId });
    assert.ok(denied.error, 'Former owner must no longer transfer ownership');
    assert.equal((await data(b.from('venues').update({ description: 'Updated by new QA owner' }).eq('id', venueId).select().single())).description, 'Updated by new QA owner');
  });
  await check('Direct conversation and two-account realtime DM delivery', async () => {
    const blocked = await a.rpc('get_or_create_dm_conversation', { other_user_id: bId });
    assert.ok(blocked.error, 'Non-friends must not bypass DM privacy');
    const friendship = await data(a.from('friendships').insert({ user_id: aId, friend_id: bId, status: 'pending' }).select().single());
    friendshipId = friendship.id;
    await data(b.from('friendships').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', friendshipId).select().single());
    conversationId = await data(a.rpc('get_or_create_dm_conversation', { other_user_id: bId }));
    assert.equal(typeof conversationId, 'string');
    await observeInsert(b, 'direct_messages', `conversation_id=eq.${conversationId}`, attempt => data(a.from('direct_messages')
      .insert({ conversation_id: conversationId, sender_id: aId, content: `QA direct message #${attempt}` }).select().single()), 3);
    assert.equal((await data(b.from('direct_messages').select('id').eq('conversation_id', conversationId))).length, 3);
  });
} catch (error) {
  results.push({ name: 'Fixture setup or runner', status: 'FAIL', error: safeMessage(error) });
  console.log(JSON.stringify(results.at(-1)));
} finally {
  for (const [client, channel] of channels) await client.removeChannel(channel).catch(() => {});
  await check('Remove all objects and records created by this test', async () => {
    const failures = [];
    const clean = async (label, operation) => { try { await data(operation); } catch (error) { failures.push(`${label}: ${safeMessage(error)}`); } };
    for (const [bucket, path] of objects) await clean(`storage ${bucket}/${path}`, admin.storage.from(bucket).remove([path]));
    if (conversationId) await clean(`conversation ${conversationId}`, admin.from('conversations').delete().eq('id', conversationId));
    if (friendshipId) await clean(`friendship ${friendshipId}`, admin.from('friendships').delete().eq('id', friendshipId));
    if (groupCreated) await clean(`group ${groupId}`, admin.from('groups').delete().eq('id', groupId));
    // The canonical audit table deliberately has no group FK, so remove this
    // run's audit rows explicitly after membership-delete triggers have fired.
    if (groupCreated) await clean(`group audit ${groupId}`, admin.from('group_audit_log').delete().eq('group_id', groupId));
    if (venueCreated) await clean(`venue ${venueId}`, admin.from('venues').delete().eq('id', venueId));
    for (const id of users) await clean(`test user ${id}`, admin.auth.admin.deleteUser(id));
    assert.equal(failures.length, 0, failures.join('; '));
    assert.equal((await data(admin.from('groups').select('id').eq('id', groupId))).length, 0);
    assert.equal((await data(admin.from('venues').select('id').eq('id', venueId))).length, 0);
  });
  for (const client of clients) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  console.log(JSON.stringify({ summary: { passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length, skipped: results.filter(r => r.status === 'SKIP').length, destination: ref, fixtureRun: run } }));
  process.exitCode = results.some(r => r.status === 'FAIL') ? 1 : 0;
}
