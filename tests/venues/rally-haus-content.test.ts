import { readFileSync, statSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260928162000_rally_haus_official_content.sql', 'utf8');
const venue = 'd99d7de3-2431-4ee2-a826-04cc293da1cd';
const group = 'd5b47d17-d217-441a-a62a-bcdd87307d62';
const owner = '00000000-0000-4000-8000-000000000001';
let db: PGlite;
afterEach(async () => { await db?.close(); });
async function setup(present = true) {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE venues(id uuid PRIMARY KEY, description text, tagline text, welcome_message text, phone text, logo_url text);
    CREATE TABLE groups(id uuid PRIMARY KEY, venue_id uuid REFERENCES venues(id), created_by uuid, type text);
    CREATE TABLE group_members(group_id uuid REFERENCES groups(id), user_id uuid, role text, status text);
    CREATE TABLE group_files(id uuid PRIMARY KEY,group_id uuid REFERENCES groups(id),uploader_id uuid,file_url text,file_name text,file_type text,file_size integer);
    CREATE TABLE group_posts(id uuid PRIMARY KEY,group_id uuid REFERENCES groups(id),user_id uuid,type text,title text,content text,image_url text,pinned boolean,poll_options jsonb);
    INSERT INTO venues VALUES('00000000-0000-4000-8000-000000000002','Unrelated venue','Unchanged',NULL,NULL,NULL);
  `);
  if (present) {
    await db.query('INSERT INTO venues(id,logo_url) VALUES($1,$2)', [venue, 'existing-brand.webp']);
    await db.query("INSERT INTO groups VALUES($1,$2,$3,'venue_official')", [group, venue, owner]);
    await db.query("INSERT INTO group_members VALUES($1,$2,'owner','active')", [group, owner]);
  }
}

it('persists official media and native posts only in the existing venue, with complete hosted assets', async () => {
  await setup();
  await db.exec(sql);
  const files = (await db.query('SELECT * FROM group_files')).rows;
  expect(files).toHaveLength(3);
  for (const file of files) {
    expect(file.group_id).toBe(group);
    expect(file.uploader_id).toBe(owner);
    const path = new URL(file.file_url as string).pathname;
    expect(statSync('public' + path).size).toBe(file.file_size);
  }
  expect((await db.query('SELECT * FROM group_posts')).rows).toHaveLength(5);
  expect((await db.query("SELECT poll_options FROM group_posts WHERE type='poll'")).rows[0].poll_options).toHaveLength(5);
  expect((await db.query('SELECT logo_url,phone FROM venues WHERE id=$1', [venue])).rows[0]).toEqual({ logo_url: 'existing-brand.webp', phone: '401-999-9065' });
  expect((await db.query('SELECT description,tagline FROM venues WHERE id<>$1', [venue])).rows[0]).toEqual({ description: 'Unrelated venue', tagline: 'Unchanged' });
}, 30_000);

it('can be retried without duplicate content or overwriting subsequent manager edits', async () => {
  await setup();
  await db.exec(sql);
  await db.query("UPDATE venues SET description='Manager copy',phone='Updated contact' WHERE id=$1", [venue]);
  await db.exec("UPDATE group_posts SET title='Edited by manager' WHERE id='948f5200-bb84-49df-a126-7de710000001'");
  await db.exec(sql);
  expect((await db.query('SELECT * FROM group_files')).rows).toHaveLength(3);
  expect((await db.query('SELECT * FROM group_posts')).rows).toHaveLength(5);
  expect((await db.query('SELECT description,phone FROM venues WHERE id=$1', [venue])).rows[0]).toEqual({ description: 'Manager copy', phone: 'Updated contact' });
  expect((await db.query("SELECT title FROM group_posts WHERE pinned")).rows[0].title).toBe('Edited by manager');
}, 30_000);

it('skips other environments and fails atomically if the venue/community relationship is wrong', async () => {
  await setup(false);
  await db.exec(sql);
  expect((await db.query('SELECT * FROM group_files')).rows).toHaveLength(0);
  await db.query('INSERT INTO venues(id) VALUES($1)', [venue]);
  await expect(db.exec(sql)).rejects.toThrow('existing venue community owner');
  await db.exec('ROLLBACK');
  expect((await db.query('SELECT * FROM group_posts')).rows).toHaveLength(0);
  expect((await db.query('SELECT description FROM venues WHERE id=$1', [venue])).rows[0].description).toBeNull();
}, 30_000);
