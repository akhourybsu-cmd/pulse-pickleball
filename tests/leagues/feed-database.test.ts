import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { leagueActor, leagueSimulationDatabase } from '../helpers/leagueSimulationDatabase';
import { leagueSimulationClient } from '../helpers/leagueSimulationClient';
import type { LeaguePost } from '@/hooks/useLeaguePosts';

const id = (n: number) => `ac100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), manager = id(2), player = id(3), sub = id(4), outsider = id(5), inactive = id(6), otherOwner = id(7);
let db: PGlite, league: string, otherLeague: string, season: string;
const actor = (user: string | null) => leagueActor(db, user);
async function rpc<T>(user: string | null, name: string, args: Record<string, unknown>): Promise<T> {
  const result = await leagueSimulationClient(db, user).rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  // PostgreSQL composite return types are exposed as a one-row result set.
  return (Array.isArray(result.data) && ['create_league_post', 'update_league_post'].includes(name) ? result.data[0] : result.data) as T;
}
const create = (user = owner, content = 'Courts open at 6 PM.', postId = id(100), target = league) =>
  rpc<LeaguePost>(user, 'create_league_post', { p_league_id: target, p_content: content, p_post_id: postId });
const update = (post: LeaguePost, user = owner, content = 'Courts open at 7 PM.', pinned = false) =>
  rpc<LeaguePost>(user, 'update_league_post', { p_post_id: post.id, p_expected_version: post.version, p_content: content, p_pinned: pinned });
const remove = (post: LeaguePost, user = owner) =>
  rpc(user, 'delete_league_post', { p_post_id: post.id, p_expected_version: post.version });
const read = (user: string | null, target = league) => actor(user)<LeaguePost>('SELECT * FROM league_posts WHERE league_id=$1 ORDER BY pinned DESC,created_at DESC,id DESC', [target]);
const saved = async () => (await db.query('SELECT * FROM league_posts ORDER BY id')).rows;
async function rejectsWithoutChange(work: () => Promise<unknown>, message: RegExp) {
  const before = await saved(); await expect(work()).rejects.toThrow(message); expect(await saved()).toEqual(before);
}
beforeAll(async () => {
  db = await leagueSimulationDatabase();
  for (const user of [owner, manager, player, sub, outsider, inactive, otherOwner])
    await db.query('INSERT INTO profiles(id,display_name) VALUES($1,$2)', [user, `Feed test ${user.slice(-2)}`]);
  league = await rpc<string>(owner, 'create_league', { p_name: 'Feed league', p_league_type: 'ladder' });
  otherLeague = await rpc<string>(otherOwner, 'create_league', { p_name: 'Other league', p_league_type: 'singles' });
  season = (await actor(owner)<{ id: string }>("INSERT INTO league_seasons(league_id,name,status) VALUES($1,'Autumn','active') RETURNING id", [league])).rows[0].id;
  for (const [user, role, status] of [[manager, 'manager', 'active'], [player, 'player', 'active'], [inactive, 'manager', 'removed']])
    await actor(owner)('INSERT INTO league_members(league_id,season_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)', [league, season, user, role, status]);
  await actor(owner)('INSERT INTO league_substitutes(league_id,season_id,user_id) VALUES($1,$2,$3)', [league, season, sub]);
}, 60_000);
beforeEach(async () => {
  await db.exec('TRUNCATE league_posts');
  await db.query("UPDATE league_members SET status='active' WHERE user_id=$1", [manager]);
  await db.query("UPDATE leagues SET visibility='private' WHERE id=$1", [league]);
});
afterAll(async () => { await db?.close(); });

describe('league update permissions and persistence', () => {
  it.each([owner, manager])('lets an owner or active manager publish with their own author identity (%s)', async user => {
    const post = await create(user, '  Court change\nPlease use court 2.  ');
    expect(post).toMatchObject({ id: id(100), league_id: league, author_id: user, content: 'Court change\nPlease use court 2.', version: 1, pinned: false, edited_at: null });
  });
  it.each([player, sub, outsider, inactive, otherOwner])('rejects posting by a non-manager without partial records (%s)', async user => {
    await rejectsWithoutChange(() => create(user), /owner or an active manager/);
  });
  it('rejects anonymous mutation calls and reads', async () => {
    await expect(rpc(null, 'create_league_post', { p_league_id: league, p_content: 'Hidden', p_post_id: id(100) })).rejects.toThrow(/permission|owner|manager/);
    await expect(read(null)).rejects.toThrow(/permission/);
  });
  it.each([owner, manager, player, sub])('allows a league participant to read league-wide updates (%s)', async user => {
    const post = await create(); expect((await read(user)).rows.map(p => p.id)).toEqual([post.id]);
  });
  it.each([outsider, inactive, otherOwner])('keeps a private league feed hidden from non-members (%s)', async user => {
    await create(); expect((await read(user)).rows).toHaveLength(0);
  });
  it('does not expose updates merely because a league is publicly discoverable', async () => {
    await actor(owner)("UPDATE leagues SET visibility='public_future' WHERE id=$1", [league]);
    await create(); expect((await read(outsider)).rows).toHaveLength(0);
  });
  it('hides admin-only league updates from players and substitutes', async () => {
    await actor(owner)("UPDATE leagues SET visibility='admin_only' WHERE id=$1", [league]);
    await create(); expect((await read(player)).rows).toHaveLength(0); expect((await read(sub)).rows).toHaveLength(0);
    expect((await read(manager)).rows).toHaveLength(1);
  });
  it.each(['', '   ', '\n\t', 'x'.repeat(4001)])('rejects empty or oversized content (%s)', async content => {
    await rejectsWithoutChange(() => create(owner, content), /1 and 4,000/);
  });
  it('supports the maximum content length', async () => { expect((await create(owner, 'x'.repeat(4000))).content).toHaveLength(4000); });
  it('retries a lost create response without duplicating a post', async () => {
    const first = await create(); expect(await create()).toEqual(first); expect(await saved()).toHaveLength(1);
    await rejectsWithoutChange(() => create(owner, 'Different request'), /different content/);
    await rejectsWithoutChange(() => create(manager), /different content/);
    await rejectsWithoutChange(() => create(otherOwner, first.content, first.id, otherLeague), /different content/);
  });
  it('lets managers edit and pin another organizer’s update without changing its author or posted time', async () => {
    const original = await create(); const pinned = await update(original, manager, original.content, true);
    expect(pinned).toMatchObject({ author_id: owner, created_at: original.created_at, pinned: true, version: 2, edited_at: null });
    const edited = await update(pinned, manager); expect(edited.edited_at).not.toBeNull(); expect(edited.version).toBe(3);
    await rejectsWithoutChange(() => update(original), /changed.*Refresh/);
    await rejectsWithoutChange(() => remove(original), /changed.*Refresh/);
  });
  it('rejects member moderation, including deletion of a known post ID', async () => {
    const post = await create();
    for (const user of [player, sub, outsider, inactive, otherOwner]) {
      await rejectsWithoutChange(() => update(post, user), /owner or an active manager/);
      await rejectsWithoutChange(() => remove(post, user), /owner or an active manager/);
    }
  });
  it('revokes a former manager’s posting and moderation immediately', async () => {
    const post = await create(manager);
    await actor(owner)("UPDATE league_members SET status='removed' WHERE user_id=$1", [manager]);
    await rejectsWithoutChange(() => create(manager, 'New', id(101)), /owner or an active manager/);
    await rejectsWithoutChange(() => update(post, manager), /owner or an active manager/);
    await rejectsWithoutChange(() => remove(post, manager), /owner or an active manager/);
    expect((await read(manager)).rows).toHaveLength(0);
  });
  it('prevents direct REST writes from forging identity or bypassing version checks', async () => {
    const post = await create();
    await rejectsWithoutChange(() => actor(manager)('INSERT INTO league_posts(league_id,author_id,content) VALUES($1,$2,$3)', [league, owner, 'Forged']), /row-level security|permission/);
    expect((await actor(manager)('UPDATE league_posts SET content=$1 WHERE id=$2 RETURNING id', ['Forged', post.id])).rows).toHaveLength(0);
    expect((await actor(manager)('DELETE FROM league_posts WHERE id=$1 RETURNING id', [post.id])).rows).toHaveLength(0);
    expect((await saved())[0]).toMatchObject({ content: post.content });
  });
  it('persists the feed across seasons and keeps pinned updates ahead of newer posts', async () => {
    const old = await create(); await update(old, owner, old.content, true);
    await actor(owner)("INSERT INTO league_seasons(league_id,name,status) VALUES($1,'Winter','draft')", [league]);
    const recent = await create(manager, 'Next season begins soon.', id(101));
    expect((await read(player)).rows.map(p => p.id)).toEqual([old.id, recent.id]);
    await remove(recent, manager); expect((await read(player)).rows).toHaveLength(1);
  });
  it('applies the migration again without changing existing posts', async () => {
    await create(); const before = await saved();
    await db.exec(readFileSync('supabase/migrations/20261010010000_league_update_feed.sql', 'utf8'));
    expect(await saved()).toEqual(before);
  });
});
