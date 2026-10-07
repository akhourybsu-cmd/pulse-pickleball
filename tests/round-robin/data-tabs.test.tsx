import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { EventStandings } from "@/components/round-robin/EventStandings";
import { EventRoster } from "@/components/round-robin/EventRoster";
import {
  restingPlayers,
  roundScheduleSummary,
  scheduleMatchLabel,
} from "@/lib/roundRobin/scheduleDisplay";
import {
  buildPlayerEventSnapshot,
  type EventStanding,
  type HydratedEventPlayer,
} from "@/lib/roundRobin/playerEventSnapshot";
import { RankBadge } from "@/components/round-robin/RankBadge";

let root: ReactTestRenderer;
afterEach(() => act(() => root?.unmount()));
const flatten = (node: unknown): string => {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(flatten).join("");
  if (node && typeof node === "object" && "children" in node)
    return flatten(node.children);
  return "";
};
const text = () => flatten(root.toJSON());
const row = (
  id: string,
  extras: Partial<EventStanding> = {}
): EventStanding => ({
  playerId: id,
  playerName: id,
  wins: 0,
  losses: 0,
  gamesPlayed: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  isRemoved: false,
  ...extras,
});

describe("shared standings presentation", () => {
  it("ranks played active players, retaining unplayed and departed players without medals", () => {
    act(() => {
      root = create(
        <EventStandings
          rows={[
            row("Winner", { wins: 1, gamesPlayed: 1, pointsFor: 11 }),
            row("New arrival"),
            row("Departed", {
              wins: 2,
              gamesPlayed: 2,
              pointsFor: 22,
              isRemoved: true,
            }),
          ]}
          myIds={new Set(["Winner"])}
        />
      );
    });
    expect(
      root.root.findAllByType(RankBadge).map((badge) => badge.props.rank)
    ).toEqual([1]);
    expect(text()).toContain("Awaiting first result");
    expect(text()).toContain("No longer on the active roster");
    expect(text()).toContain("11 for · 0 against");
    expect(text()).toContain("Ranking order:");
    expect(
      root.root
        .findAllByType("tr")
        .filter((tr) => tr.props.className === "rr-standing-you")
    ).toHaveLength(1);
  });
  it("does not award ranks before a score is saved", () => {
    act(() => {
      root = create(
        <EventStandings rows={["A", "B", "C", "D"].map((id) => row(id))} />
      );
    });
    expect(root.root.findAllByType(RankBadge)).toHaveLength(0);
    expect(text()).toContain("No results yet");
  });
  it("identifies voided events as historical and suppresses ranks", () => {
    act(() => {
      root = create(
        <EventStandings
          voided
          completed
          rows={[row("A", { wins: 1, gamesPlayed: 1 })]}
        />
      );
    });
    expect(root.root.findAllByType(RankBadge)).toHaveLength(0);
    expect(text()).toContain("Historical results");
    expect(text()).not.toContain("Final standings");
  });
});

it("searches the complete roster and distinguishes waiting, removed and linked guests", () => {
  const players: HydratedEventPlayer[] = [
    "Active",
    "Waiting",
    "Removed",
    "Linked guest",
  ].map((id, index) => ({
    id,
    player_id: index === 3 ? null : id,
    guest_player_id: index === 3 ? id : null,
    active: index === 0 || index === 3,
    registration_status: index === 1 ? "waitlisted" : "confirmed",
    profiles: index === 3 ? null : { display_name: id },
    guest_players:
      index === 3 ? { display_name: id, linked_user_id: "claimed-user" } : null,
  }));
  const snapshot = buildPlayerEventSnapshot(players, []);
  act(() => {
    root = create(
      <EventRoster
        players={snapshot.players}
        standings={snapshot.standings}
        myIds={new Set(["Linked guest"])}
      />
    );
  });
  expect(root.root.findAllByType("article")).toHaveLength(4);
  expect(text()).toContain("PULSE account");
  expect(
    root.root
      .findAllByType("section")
      .map((section) => section.props["aria-label"])
  ).toEqual([
    "Event players",
    "Active roster",
    "Waitlist",
    "No longer playing",
  ]);
  act(() =>
    root.root
      .findByType("input")
      .props.onChange({ target: { value: "  WAITING  " } })
  );
  expect(root.root.findAllByType("article")).toHaveLength(1);
  expect(text()).toContain("Awaiting a roster spot");
  act(() =>
    root.root
      .findByType("input")
      .props.onChange({ target: { value: "missing" } })
  );
  expect(text()).toContain("No matching players");
});

it("counts scored games, resolved results, and all unique resting seats separately", () => {
  const scored = {
    a1_player_id: "a",
    a2_player_id: "b",
    b1_player_id: "c",
    b2_player_id: "d",
    team1_score: 11,
    team2_score: 0,
  };
  const matches = [
    scored,
    { ...scored, abandoned: true },
    { ...scored, team1_score: null },
    { ...scored, superseded_by_schedule_id: "new" },
    { is_bye: true, a1_player_id: "e", a2_guest_id: "guest" },
    { is_bye: true, a1_player_id: "e" },
    { is_bye: true, a1_player_id: "old-rest", voided_at: "yesterday" },
  ];
  expect(roundScheduleSummary(matches)).toEqual({
    games: 3,
    scored: 1,
    resolved: 1,
    resting: 2,
  });
  expect(restingPlayers(matches).map((player) => player.id)).toEqual([
    "e",
    "guest",
  ]);
});

it("labels unfinished and resolved court assignments without treating missing players as a rest", () => {
  const match = {
    a1_player_id: "a",
    a2_guest_id: "guest",
    b1_player_id: "b",
    b2_player_id: "c",
    team1_score: null,
    team2_score: null,
  };
  expect(scheduleMatchLabel(match, 2, 2, "live")).toBe("Awaiting score");
  expect(scheduleMatchLabel(match, 3, 2, "live")).toBe("Upcoming");
  expect(scheduleMatchLabel(match, 1, 2, "live")).toBe("No result");
  expect(
    scheduleMatchLabel({ ...match, b2_player_id: null }, 2, 2, "live")
  ).toBe("Awaiting players");
  expect(scheduleMatchLabel({ ...match, is_bye: true }, 2, 2, "live")).toBe(
    "Resting"
  );
  expect(
    scheduleMatchLabel(
      { ...match, team1_score: 11, team2_score: 0 },
      1,
      2,
      "live"
    )
  ).toBe("Completed");
  expect(
    scheduleMatchLabel(
      { ...match, abandoned: true, abandoned_reason: "Result voided by host" },
      1,
      2,
      "live"
    )
  ).toBe("Result voided");
  expect(scheduleMatchLabel(match, 2, 2, "completed")).toBe("No result");
});
