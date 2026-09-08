import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchCanonicalRoundRobinSchedule,
  ROUND_ROBIN_SCHEDULE_PAGE_SIZE,
  type RoundRobinScheduleRow,
} from "./fetchScheduleRows";

interface QueryLog {
  table: string;
  filters: Array<[string, unknown]>;
  nullFilters: Array<[string, null]>;
  orders: Array<[string, { ascending?: boolean } | undefined]>;
  ranges: Array<[number, number]>;
}

function scheduleRows(count: number): RoundRobinScheduleRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `schedule-${String(index).padStart(5, "0")}`,
    event_id: "event-1",
    round_no: Math.floor(index / 17) + 1,
    court_no: (index % 17) + 1,
  })) as RoundRobinScheduleRow[];
}

function fakeClient(
  rows: RoundRobinScheduleRow[],
  { failFrom }: { failFrom?: number } = {},
): { client: SupabaseClient<Database>; log: QueryLog } {
  const log: QueryLog = {
    table: "",
    filters: [],
    nullFilters: [],
    orders: [],
    ranges: [],
  };

  const client = {
    from(table: string) {
      log.table = table;
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          log.filters.push([column, value]);
          return query;
        },
        is(column: string, value: null) {
          log.nullFilters.push([column, value]);
          return query;
        },
        order(column: string, options?: { ascending?: boolean }) {
          log.orders.push([column, options]);
          return query;
        },
        async range(from: number, to: number) {
          log.ranges.push([from, to]);
          if (failFrom === from) {
            return { data: null, error: new Error(`page ${from} failed`) };
          }
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;

  return { client, log };
}

describe("fetchCanonicalRoundRobinSchedule", () => {
  it("loads every row when a legal schedule exceeds the 1,000-row API cap", async () => {
    const expected = scheduleRows(1_700);
    const { client, log } = fakeClient(expected);

    const result = await fetchCanonicalRoundRobinSchedule(client, "event-1");

    expect(result).toEqual(expected);
    expect(log.table).toBe("round_robin_schedule");
    expect(log.ranges).toEqual([
      [0, 999],
      [1_000, 1_999],
    ]);
    expect(log.filters).toEqual([
      ["event_id", "event-1"],
      ["event_id", "event-1"],
    ]);
    expect(log.nullFilters).toEqual([
      ["voided_at", null],
      ["superseded_by_schedule_id", null],
      ["voided_at", null],
      ["superseded_by_schedule_id", null],
    ]);
    expect(log.orders.map(([column]) => column)).toEqual([
      "round_no",
      "court_no",
      "id",
      "round_no",
      "court_no",
      "id",
    ]);
  });

  it("requests a terminal empty page when the row count is an exact page multiple", async () => {
    const expected = scheduleRows(2 * ROUND_ROBIN_SCHEDULE_PAGE_SIZE);
    const { client, log } = fakeClient(expected);

    const result = await fetchCanonicalRoundRobinSchedule(client, "event-1");

    expect(result).toHaveLength(2_000);
    expect(log.ranges).toEqual([
      [0, 999],
      [1_000, 1_999],
      [2_000, 2_999],
    ]);
  });

  it("surfaces a later-page error instead of returning a partial schedule", async () => {
    const { client } = fakeClient(scheduleRows(1_700), { failFrom: 1_000 });

    await expect(
      fetchCanonicalRoundRobinSchedule(client, "event-1"),
    ).rejects.toThrow("page 1000 failed");
  });
});

describe("complete schedule reader contract", () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const readers = [
    "src/pages/RoundRobinDetail.tsx",
    "src/components/round-robin/PlayerRoundRobinView.tsx",
    "src/lib/roundRobin/kioskData.ts",
  ];

  it.each(readers)("routes the all-schedule read in %s through pagination", (file) => {
    const source = fs.readFileSync(path.join(root, file), "utf8");

    expect(source).toContain(
      'import { fetchCanonicalRoundRobinSchedule } from "@/lib/roundRobin/fetchScheduleRows";',
    );
    expect(source).toMatch(/fetchCanonicalRoundRobinSchedule\(\s*supabase,/);
  });
});
