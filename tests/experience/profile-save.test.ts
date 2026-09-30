import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock }));
import { saveProfileChange } from "@/lib/saveProfileChange";
beforeEach(() => {
  vi.resetAllMocks();
  for (const method of [mock.from, mock.update, mock.eq, mock.select])
    method.mockReturnValue(mock);
});
it("verifies that the current player profile actually changed", async () => {
  mock.maybeSingle.mockResolvedValue({ data: { id: "player" }, error: null });
  await saveProfileChange("player", { avatar_url: null });
  expect(mock.eq).toHaveBeenCalledWith("id", "player");
  expect(mock.update).toHaveBeenCalledWith({ avatar_url: null });
});
it("rejects silent zero-row writes and database errors before UI success or asset cleanup", async () => {
  mock.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(
    saveProfileChange("player", { avatar_url: null }),
  ).rejects.toThrow();
  mock.maybeSingle.mockResolvedValue({
    data: null,
    error: new Error("Network unavailable"),
  });
  await expect(saveProfileChange("player", { city: "Boston" })).rejects.toThrow(
    "Network unavailable",
  );
});
