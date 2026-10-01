import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  leagueSimulationDatabase,
  leagueActor,
} from "../helpers/leagueSimulationDatabase";
import { leagueBrandStyle, LEAGUE_PALETTES } from "@/lib/leagues/branding";
import {
  contrastRatio,
  contrastInk,
  readableColor,
} from "@/lib/venues/palette";

const owner = "60000000-0000-0000-0000-000000000001";
const manager = "60000000-0000-0000-0000-000000000002";
const player = "60000000-0000-0000-0000-000000000003";
const outsider = "60000000-0000-0000-0000-000000000004";
let db: PGlite, league: string, other: string;
const as = (user: string | null) => leagueActor(db, user);
beforeAll(async () => {
  db = await leagueSimulationDatabase();
  for (const user of [owner, manager, player, outsider])
    await db.query("INSERT INTO profiles(id) VALUES($1)", [user]);
  league = (
    await as(owner)<{ id: string }>(
      "SELECT create_league('Brand test','ladder') AS id"
    )
  ).rows[0].id;
  other = (
    await as(outsider)<{ id: string }>(
      "SELECT create_league('Other league','ladder') AS id"
    )
  ).rows[0].id;
  await as(owner)(
    "UPDATE leagues SET status='active',visibility='private' WHERE id=$1",
    [league]
  );
  await as(owner)(
    "INSERT INTO league_members(league_id,user_id,role,status) VALUES($1,$2,'manager','active'),($1,$3,'player','active')",
    [league, manager, player]
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});

it("persists a full identity atomically, audits the manager and carries it through player and public invitation reads", async () => {
  const brand = {
    primary_color: "#2563eb",
    secondary_color: "#172554",
    accent_color: "#67e8f9",
    logo_url: `https://example.supabase.co/storage/v1/object/public/league-branding/${league}/logo.webp`,
    cover_url: `https://example.supabase.co/storage/v1/object/public/league-branding/${league}/cover.jpg`,
    logo_crop: { x: 30, y: 60, zoom: 1.4 },
    cover_crop: { x: 70, y: 40, zoom: 1 },
    logo_shape: "circle",
    logo_fit: "contain",
  };
  await as(manager)("SELECT set_league_branding($1,$2::jsonb)", [
    league,
    JSON.stringify(brand),
  ]);
  expect(
    (
      await as(player)<any>("SELECT branding FROM leagues WHERE id=$1", [
        league,
      ])
    ).rows[0].branding
  ).toEqual(brand);
  expect(
    (
      await as(player)<any>(
        "SELECT league_branding FROM get_my_leagues_with_context() WHERE league_id=$1",
        [league]
      )
    ).rows[0].league_branding
  ).toEqual(brand);
  const code = (
    await db.query<any>("SELECT invite_code FROM leagues WHERE id=$1", [league])
  ).rows[0].invite_code;
  const teaser = (
    await as(null)<any>("SELECT * FROM find_league_by_invite_code($1)", [code])
  ).rows[0];
  expect(teaser.branding).toEqual(brand);
  expect(teaser).not.toHaveProperty("invite_code");
  expect(
    (
      await db.query<any>(
        "SELECT actor_user_id,new_value FROM league_audit_log WHERE league_id=$1 AND action='league.branding_updated'",
        [league]
      )
    ).rows
  ).toEqual([{ actor_user_id: manager, new_value: brand }]);
  await as(owner)("UPDATE leagues SET visibility='admin_only' WHERE id=$1", [
    league,
  ]);
  expect(
    (await as(null)("SELECT * FROM find_league_by_invite_code($1)", [code]))
      .rows
  ).toEqual([]);
  await as(owner)("UPDATE leagues SET visibility='private' WHERE id=$1", [
    league,
  ]);
});

it("rejects player, outsider, anonymous and cross-league writes, including direct updates and storage writes", async () => {
  for (const user of [player, outsider, null]) {
    await expect(
      as(user)("SELECT set_league_branding($1,'{}')", [league])
    ).rejects.toThrow();
    await expect(
      as(user)(
        "INSERT INTO storage.objects(bucket_id,name) VALUES('league-branding',$1)",
        [`${league}/unauthorized.png`]
      )
    ).rejects.toThrow();
  }
  expect(
    (
      await as(player)(
        "UPDATE leagues SET branding='{}' WHERE id=$1 RETURNING id",
        [league]
      )
    ).rows
  ).toEqual([]);
  await expect(
    as(manager)("SELECT set_league_branding($1,'{}')", [other])
  ).rejects.toThrow();
  await as(manager)(
    "INSERT INTO storage.objects(bucket_id,name) VALUES('league-branding',$1)",
    [`${league}/authorized.png`]
  );
  await expect(
    as(manager)("UPDATE storage.objects SET name=$1 WHERE name=$2", [
      `${other}/stolen.png`,
      `${league}/authorized.png`,
    ])
  ).rejects.toThrow();
  expect(
    (
      await as(player)(
        "DELETE FROM storage.objects WHERE bucket_id='league-branding' RETURNING id"
      )
    ).rows
  ).toEqual([]);
  await as(manager)("DELETE FROM storage.objects WHERE name=$1", [
    `${league}/authorized.png`,
  ]);
});

it("validates colors, image scope and crops on both RPC and direct database writes; reset preserves league data", async () => {
  for (const brand of [
    null,
    [],
    { primary_color: "red" },
    { primary_color: "url(bad)" },
    { logo_url: "javascript:bad" },
    {
      logo_url: `https://example.supabase.co/storage/v1/object/public/league-branding/${other}/logo.png`,
    },
    { logo_crop: { x: 1000, y: 50, zoom: 1 } },
    { cover_crop: { x: 50, y: 50, zoom: "2" } },
    { logo_shape: "triangle" },
    { unexpected: true },
  ]) {
    await expect(
      as(owner)("SELECT set_league_branding($1,$2::jsonb)", [
        league,
        JSON.stringify(brand),
      ])
    ).rejects.toThrow();
    await expect(
      as(owner)("UPDATE leagues SET branding=$2::jsonb WHERE id=$1", [
        league,
        JSON.stringify(brand),
      ])
    ).rejects.toThrow();
  }
  await as(owner)("SELECT set_league_branding($1,'{}')", [league]);
  const result = (
    await as(owner)<any>(
      "SELECT branding,name,status FROM leagues WHERE id=$1",
      [league]
    )
  ).rows[0];
  expect(result).toEqual({
    branding: {},
    name: "Brand test",
    status: "active",
  });
  expect(
    (
      await db.query<any>(
        "SELECT count(*)::int AS n FROM league_members WHERE league_id=$1",
        [league]
      )
    ).rows[0].n
  ).toBe(3);
});

it("keeps extreme colors readable and rejects arbitrary CSS while preserving defaults", () => {
  expect(leagueBrandStyle({})).toEqual({});
  for (const color of [
    ...LEAGUE_PALETTES.map((p) => p.primary_color),
    "#ffffff",
    "#000000",
    "#ffff00",
  ]) {
    for (const dark of [false, true]) {
      const style = leagueBrandStyle(
        { primary_color: color, secondary_color: color, accent_color: color },
        dark
      );
      expect(
        contrastRatio(style["--lg-accent-gold"], dark ? "#24272c" : "#f7f5ef")
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(style["--lg-hero-gold"], style["--league-header"])
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio("#ffffff", style["--league-header"])
      ).toBeGreaterThanOrEqual(4.5);
      const primary = readableColor(color, dark ? "#24272c" : "#f7f5ef");
      expect(
        contrastRatio(primary, contrastInk(primary))
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(
    JSON.stringify(
      leagueBrandStyle({
        primary_color: "url(evil)",
        secondary_color: "red; color: pink",
      })
    )
  ).not.toMatch(/evil|pink/);
});
