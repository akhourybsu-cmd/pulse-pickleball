import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
const read = (name: string) => readFileSync('supabase/migrations/' + name, 'utf8');
const migration = read('20261010020000_social_inbox_summaries.sql');
const id = (n: number) => '5a000000-0000-4000-8000-' + String(n).padStart(12, '0');
const a = id(1), b = id(2), stranger = id(3), busy = id(10), quiet = id(11), empty = id(12), privateChat = id(13);
let db: PGlite;
type Summary = { id: string; participant: { id: string }; last_message: { content: string; image_url?: string; senderName?: string; senderIsMe?: boolean } | null; unread_count: number; is_muted?: boolean };
const rows = async (name: 'dm' | 'group', user = a, verified = true) => db.transaction(async tx => {
  await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('test.verified',$2,true)", [user, String(verified)]);
  await tx.exec('SET LOCAL ROLE authenticated');
  return (await tx.query<Summary>('SELECT * FROM social_' + name + '_inbox()')).rows;
});
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
    CREATE TABLE profiles(id uuid PRIMARY KEY, display_name text, full_name text, avatar_url text, current_rating numeric);
    CREATE VIEW profiles_public AS SELECT * FROM profiles;
    CREATE TABLE groups(id uuid PRIMARY KEY,name text,icon_url text,member_count integer,updated_at timestamptz);
    CREATE TABLE group_members(group_id uuid,user_id uuid,status text,last_read_at timestamptz,last_chat_read_at timestamptz,PRIMARY KEY(group_id,user_id));
    CREATE TABLE group_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid,user_id uuid,content text,image_url text,created_at timestamptz);
    CREATE FUNCTION is_group_member(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
      SELECT EXISTS(SELECT 1 FROM group_members WHERE user_id=$1 AND group_id=$2 AND status='active') $$;
    ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY group_read ON group_messages FOR SELECT USING(is_group_member(auth.uid(),group_id));
    ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
    CREATE POLICY membership_read ON group_members FOR SELECT USING(user_id=auth.uid());
    ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
    CREATE POLICY group_read ON groups FOR SELECT USING(is_group_member(auth.uid(),id));`);
  const original = read('20260130233055_2617c20c-4407-4b1d-a658-4e4cc4359fdb.sql');
  await db.exec(original.slice(0, original.indexOf('-- Enable realtime for direct messages')));
  await db.exec(read('20260623032428_ff15319a-b110-40de-ad6c-7e94818004b4.sql'));
  await db.exec(`ALTER TABLE conversation_participants ADD COLUMN left_at timestamptz, ADD COLUMN is_muted boolean DEFAULT false;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    CREATE INDEX ON direct_messages(conversation_id,created_at DESC);
    CREATE INDEX ON group_messages(group_id,created_at DESC);`);
  await db.exec('CREATE PUBLICATION supabase_realtime FOR TABLE direct_messages, group_members, group_messages');
  // The RPC must retain restrictive policies rather than bypassing them.
  for (const table of ['conversations', 'conversation_participants', 'direct_messages', 'groups', 'group_members', 'group_messages'])
    await db.exec(`CREATE POLICY pulse_required_mfa ON ${table} AS RESTRICTIVE TO authenticated USING(current_setting('test.verified',true)='true')`);
  await db.exec(migration);
  for (const [user, name] of [[a, 'Alex'], [b, 'Bailey'], [stranger, 'Other player']])
    await db.query('INSERT INTO profiles(id,display_name) VALUES($1,$2)', [user, name]);
  for (const chat of [busy, quiet, empty, privateChat]) {
    await db.query("INSERT INTO conversations(id,updated_at) VALUES($1,'2026-10-01')", [chat]);
    for (const user of [chat === privateChat ? stranger : a, b])
      await db.query("INSERT INTO conversation_participants(conversation_id,user_id,last_read_at) VALUES($1,$2,'2026-10-01')", [chat, user]);
    await db.query("INSERT INTO groups VALUES($1,$2,NULL,2,'2026-10-01')", [chat, chat === quiet ? 'Quiet court crew' : 'Court crew']);
    for (const user of [chat === privateChat ? stranger : a, b])
      await db.query("INSERT INTO group_members VALUES($1,$2,'active','2026-10-01',NULL)", [chat, user]);
  }
  // A single busy conversation used to consume both shared message windows.
  await db.query("INSERT INTO direct_messages(conversation_id,sender_id,content,created_at) SELECT $1,$2,'Busy '||n,'2026-10-03'::timestamptz+n*interval '1 second' FROM generate_series(1,650)n", [busy, b]);
  await db.query("INSERT INTO group_messages(group_id,user_id,content,created_at) SELECT $1,$2,'Busy '||n,'2026-10-03'::timestamptz+n*interval '1 second' FROM generate_series(1,650)n", [busy, b]);
  for (const chat of [quiet, privateChat]) {
    await db.query("INSERT INTO direct_messages(conversation_id,sender_id,content,created_at) VALUES($1,$2,'Court 4 at six?','2026-10-02')", [chat, b]);
    await db.query("INSERT INTO group_messages(group_id,user_id,content,created_at) VALUES($1,$2,'Court 4 at six?','2026-10-02')", [chat, b]);
  }
}, 30_000);
afterAll(async () => { await db?.close(); });
it.each(['dm', 'group'] as const)('%s returns one row per chat, including quiet and empty chats beside a 650-message thread', async name => {
  const result = await rows(name);
  expect(result).toHaveLength(3);
  expect(result[0]).toMatchObject({ id: busy, unread_count: 100, last_message: { content: 'Busy 650' } });
  expect(result.find(row => row.id === quiet)).toMatchObject({ unread_count: 1, last_message: { content: 'Court 4 at six?' } });
  expect(result.find(row => row.id === empty)).toMatchObject({ unread_count: 0, last_message: null });
  expect(result.some(row => row.id === privateChat)).toBe(false);
});
it.each(['dm', 'group'] as const)('%s scopes summaries to the caller and rejects an unverified session through RLS', async name => {
  expect((await rows(name, stranger)).map(row => row.id)).toEqual([privateChat]);
  expect(await rows(name, a, false)).toEqual([]);
});
it('honors the dedicated group-chat read marker and excludes the caller’s own messages', async () => {
  await db.query("UPDATE group_members SET last_chat_read_at='2026-10-02' WHERE group_id=$1 AND user_id=$2", [quiet, a]);
  await db.query("INSERT INTO group_messages(group_id,user_id,content,image_url,created_at) VALUES($1,$2,'','photo.png','2026-10-04')", [quiet, a]);
  const result = (await rows('group')).find(row => row.id === quiet)!;
  expect(result).toMatchObject({ unread_count: 0, last_message: { content: '', image_url: 'photo.png', senderName: 'Alex', senderIsMe: true } });
});
it('keeps mute state but removes departed DMs and inactive group memberships', async () => {
  await db.query('UPDATE conversation_participants SET is_muted=true WHERE conversation_id=$1 AND user_id=$2', [empty, a]);
  expect((await rows('dm')).find(row => row.id === empty)?.is_muted).toBe(true);
  await db.query('UPDATE conversation_participants SET left_at=now() WHERE conversation_id=$1 AND user_id=$2', [empty, a]);
  await db.query("UPDATE group_members SET status='removed' WHERE group_id=$1 AND user_id=$2", [empty, a]);
  expect((await rows('dm')).some(row => row.id === empty)).toBe(false);
  expect((await rows('group')).some(row => row.id === empty)).toBe(false);
});
it('keeps both functions invoker-only and unavailable to anonymous callers, including after replay', async () => {
  await db.exec(migration);
  const publication = await db.query<{ tablename: string }>("SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename");
  expect(publication.rows.map(row => row.tablename)).toEqual(['conversation_participants', 'direct_messages', 'group_members', 'group_messages']);
  const result = await db.query<{ prosecdef: boolean; anon: boolean }>("SELECT prosecdef,has_function_privilege('anon',oid,'EXECUTE') AS anon FROM pg_proc WHERE proname IN ('social_dm_inbox','social_group_inbox')");
  expect(result.rows).toEqual([{ prosecdef: false, anon: false }, { prosecdef: false, anon: false }]);
  await db.exec('SET ROLE anon');
  try { await expect(db.query('SELECT * FROM social_dm_inbox()')).rejects.toMatchObject({ code: '42501' }); }
  finally { await db.exec('RESET ROLE'); }
});
