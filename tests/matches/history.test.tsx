import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { formatRatingChange, participantProfileId } from "@/lib/matchDisplay";
import {
  buildHistoryMatch,
  groupMatchHistory,
  verificationStatus,
  type HistoryMatch,
  type HistoryRow,
} from "@/lib/matchHistory";
import { PremiumMatchCard } from "@/components/matches/PremiumMatchCard";
import { RoundRobinMatchGroup } from "@/components/matches/RoundRobinMatchGroup";

const row: HistoryRow = {
  match_id: "match-1",
  team: 2,
  rating_change: 0.12345678,
  rating_after: 4.32345678,
  matches: {
    match_date: "2026-09-26",
    created_at: "2026-09-26T12:00:00Z",
    team1_score: 7,
    team2_score: 11,
    status: "approved",
    voided: false,
    count_for_rating: true,
    other_location: "Riverside",
    courts: null,
    verified_by: ["me", "me", "stranger", "opponent"],
    source: "round_robin",
    round_no: 2,
    court_no: 1,
  },
};
const participants = [
  {
    match_id: "match-1",
    team: 2,
    player_id: "me",
    profiles: { display_name: "Alex" },
  },
  {
    match_id: "match-1",
    team: 2,
    player_id: null,
    guest_player_id: "guest-id",
    guest: { display_name: "Jordan", linked_user_id: "claimed-account" },
  },
  {
    match_id: "match-1",
    team: 1,
    player_id: "opponent",
    profiles: { display_name: "Taylor" },
  },
  {
    match_id: "match-1",
    team: 1,
    player_id: null,
    guest_player_id: "unclaimed",
    guest: { display_name: "Sam" },
  },
];
const match = (overrides: Partial<HistoryMatch> = {}) => ({
  ...buildHistoryMatch(row, participants, [], "me"),
  rr_event_id: "event-1",
  rr_event_name: "Saturday doubles",
  ...overrides,
});

describe("rating movement", () => {
  it.each([
    [0.12345678, "+0.123"],
    [-0.123987, "−0.124"],
    [0.1 + 0.2, "+0.3"],
    [0.001, "+0.001"],
    [-0.0004, null],
    [0, null],
    [null, null],
    [NaN, null],
    [Infinity, null],
  ] as const)(
    "formats %s without floating point tails or negative zero",
    (value, expected) => {
      expect(formatRatingChange(value)).toBe(expected);
    }
  );
});
describe("account identity and verification", () => {
  it("uses account IDs for claimed guests and never links an unclaimed guest ID", () => {
    expect(participantProfileId(participants[1])).toBe("claimed-account");
    expect(participantProfileId(participants[3])).toBe("");
    const result = match();
    expect(result.partner_name).toBe("Jordan");
    expect(result.opponent2_name).toBe("Sam (G)");
    expect(result.registered_player_ids).toEqual(["me", "opponent"]);
    expect(result.won).toBe(true); // team 2 wins, independent of rating delta
    expect(verificationStatus(result, "me")).toEqual({
      verifiedCount: 2,
      totalPlayers: 2,
      isCurrentUserVerified: true,
    });
  });
  it("counts only eligible approval rows for pending matches", () => {
    const result = buildHistoryMatch(
      { ...row, matches: { ...row.matches, status: "pending" } },
      participants,
      [
        { match_id: row.match_id, player_id: "me", approved: true },
        { match_id: row.match_id, player_id: "opponent", approved: null },
      ],
      "me"
    );
    expect(verificationStatus(result, "me", true)).toEqual({
      verifiedCount: 1,
      totalPlayers: 2,
      isCurrentUserVerified: true,
    });
    expect(result.verified_by).toEqual(["me"]);
  });
  it("does not invent a partner for singles", () => {
    const result = buildHistoryMatch(
      row,
      participants.filter((p) => p.player_id),
      [],
      "me"
    );
    expect(result.partner_name).toBe("");
    expect(result.partner_id).toBe("");
  });
});
describe("round robin grouping", () => {
  it("keeps every round together, sorts round order, and excludes unranked rating movement", () => {
    const input = [
      match({ match_id: "late", round_no: 9, rating_change: 0.2 }),
      match({ match_id: "early", round_no: 1, rating_change: 0.1 }),
      match({
        match_id: "unranked",
        round_no: 3,
        is_ranked: false,
        rating_change: 999,
      }),
    ];
    const items = groupMatchHistory(input);
    expect(items).toHaveLength(1);
    if (items[0].kind !== "group") throw new Error("Expected a group");
    expect(items[0].group.matches.map((m) => m.match_id)).toEqual([
      "early",
      "unranked",
      "late",
    ]);
    expect(items[0].group.rankedCount).toBe(2);
    expect(formatRatingChange(items[0].group.netRating)).toBe("+0.3");
    expect(input[0].round_no).toBe(9); // no mutation of cached query data
    expect(groupMatchHistory(input, true)[0]).toMatchObject({
      group: {
        matches: [
          expect.objectContaining({ match_id: "early" }),
          expect.objectContaining({ match_id: "late" }),
        ],
      },
    });
  });
  it("does not present missing ratings as a complete total", () => {
    expect(
      groupMatchHistory([
        match({ rating_change: null }),
        match({ match_id: "second", rating_change: 0.02 }),
      ])[0]
    ).toMatchObject({ group: { netRating: null } });
  });
  it("retains newest-first order between events and single matches", () => {
    expect(
      groupMatchHistory([
        match({ match_id: "old", match_date: "2026-08-01" }),
        match({
          match_id: "recent",
          rr_event_id: undefined,
          match_date: "2026-09-20",
        }),
      ])[0]
    ).toMatchObject({ kind: "single", match: { match_id: "recent" } });
  });
});

const render = (element: React.ReactElement) =>
  renderToStaticMarkup(
    <StaticRouter location="/player/matches">{element}</StaticRouter>
  );
const props = {
  matchId: "match",
  matchDate: "2026-09-26",
  team1Score: 7,
  team2Score: 11,
  myTeam: 2 as const,
  won: true,
  playerId: "me",
  playerName: "Alex",
  partnerId: "claimed-account",
  partnerName: "Jordan",
  opponent1Id: "opponent",
  opponent1Name: "Taylor",
  opponent2Id: "",
  opponent2Name: "Sam (G)",
  ratingChange: 0.12345678,
  courtName: "Riverside",
  verifiedCount: 1,
  totalPlayers: 2,
  isCurrentUserVerified: false,
  showVerifyActions: false,
};
describe("match cards", () => {
  it("links real players and leaves unclaimed guests as text", () => {
    const html = render(<PremiumMatchCard {...props} />);
    expect(html).toContain('href="/player/profile"');
    expect(html).toContain('href="/player/profile/claimed-account"');
    expect(html).toContain('href="/player/profile/opponent"');
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain("Your score: 11");
    expect(html).toContain("+0.123");
    expect(html).not.toContain("Verify score");
  });
  it("does not show a rating change for an unranked match", () => {
    const html = render(<PremiumMatchCard {...props} isRanked={false} />);
    expect(html).toContain("Unranked");
    expect(html).not.toContain("+0.123");
  });
  it("keeps report available after confirming and disables duplicate actions while saving", () => {
    const html = render(
      <PremiumMatchCard
        {...props}
        showVerifyActions
        isCurrentUserVerified
        busy
        onReport={() => {}}
      />
    );
    expect(html).toContain("Report a problem with this match");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("Verify score");
  });
  it("shows a complete count and a real event link while rounds are collapsed", () => {
    const item = groupMatchHistory(
      Array.from({ length: 12 }, (_, i) =>
        match({ match_id: `m${i}`, round_no: i + 1 })
      )
    )[0];
    if (item.kind !== "group") throw new Error("Expected group");
    const html = render(
      <RoundRobinMatchGroup
        group={item.group}
        playerName="Alex"
        showVerifyActions={false}
        getVerificationStatus={(m) => verificationStatus(m, "me")}
        onVerify={() => {}}
        onReport={() => {}}
      />
    );
    expect(html).toContain("Show 12 matches");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('href="/round-robin/event-1"');
    expect(html).not.toContain("data-match-id=");
  });
});
