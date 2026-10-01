import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Palette, ImagePlus, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeagueScope } from "@/components/leagues/_leagueScope";
import { PlayerLeagueStage } from "@/components/leagues/PlayerLeagueStage";
import { VenueImagePositionEditor } from "@/components/venue/VenueImagePositionEditor";
import { useImageUpload } from "@/hooks/useImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { normalizeHex } from "@/lib/venues/branding";
import { LEAGUE_PALETTES, type LeagueBrand } from "@/lib/leagues/branding";
import type { League } from "@/lib/leagues/types";

const colorFields = [
  [
    "primary_color",
    "Primary color",
    "Buttons, selected tabs and your league identity.",
  ],
  ["secondary_color", "Header color", "The color behind your league entrance."],
  ["accent_color", "Accent color", "Highlights and details in the header."],
] as const;

export function BrandingTab({
  league,
  onRefresh,
}: {
  league: League;
  onRefresh: () => void | Promise<void>;
}) {
  const client = useQueryClient();
  const [saved, setSaved] = useState<LeagueBrand>(league.branding ?? {});
  const [draft, setDraft] = useState<LeagueBrand>(league.branding ?? {});
  const [saving, setSaving] = useState(false);
  const { uploadImage, uploading } = useImageUpload({
    bucket: "league-branding",
    folder: league.id,
    maxSizeMB: 8,
    maxDimension: 1920,
  });
  const busy = saving || uploading;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const patch = (value: Partial<LeagueBrand>) =>
    setDraft((previous) => ({ ...previous, ...value }));

  async function upload(file: File, kind: "logo" | "cover") {
    const result = await uploadImage(file);
    if (result)
      patch({
        [`${kind}_url`]: result.url,
        [`${kind}_crop`]: { x: 50, y: 50, zoom: 1 },
      });
  }
  async function save() {
    if (busy) return;
    const branding = { ...draft };
    for (const [key, label] of colorFields) {
      if (branding[key] === undefined) continue;
      const color = normalizeHex(branding[key]);
      if (!color) {
        toast.error(`${label} needs a valid hex color, such as #2563eb.`);
        return;
      }
      branding[key] = color;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc(
        "set_league_branding" as never,
        { p_league_id: league.id, p_branding: branding } as never
      );
      if (error) throw error;
      setSaved(branding);
      setDraft(branding);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["my-leagues"] }),
        client.invalidateQueries({ queryKey: ["player-league-detail"] }),
        client.invalidateQueries({ queryKey: ["browseable-leagues"] }),
      ]);
      await onRefresh();
      toast.success("League branding saved");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Could not save league branding. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Palette className="h-5 w-5" />
          Make this league yours
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Create a look players recognize on their league cards, invitations and
          game day. Preview your changes, then save to apply them everywhere.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.85fr)]">
        <fieldset
          disabled={busy}
          className="min-w-0 space-y-6 disabled:opacity-70"
        >
          <section className="lg-card space-y-5 p-5">
            <h3 className="font-semibold">League colors</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LEAGUE_PALETTES.map(({ name, ...colors }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => patch(colors)}
                  aria-pressed={colorFields.every(
                    ([key]) =>
                      (draft[key] ?? LEAGUE_PALETTES[0][key]) === colors[key]
                  )}
                className="rounded-xl border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 aria-pressed:border-primary/60 aria-pressed:bg-primary/10"
                >
                  <span className="mb-2 flex gap-1.5" aria-hidden>
                    {Object.values(colors).map((color) => (
                      <span
                        key={color}
                        className="h-5 w-5 rounded-full border border-black/10"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                  <span className="text-xs font-semibold">{name}</span>
                </button>
              ))}
            </div>
            {colorFields.map(([key, label, hint]) => (
              <div key={key}>
                <label
                  htmlFor={"league-" + key}
                  className="text-sm font-medium"
                >
                  {label}
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="color"
                    aria-label={`Choose ${label.toLowerCase()}`}
                    value={normalizeHex(draft[key]) ?? LEAGUE_PALETTES[0][key]}
                    onChange={(e) => patch({ [key]: e.target.value })}
                    className="h-11 w-12 cursor-pointer rounded-lg border bg-card p-1"
                  />
                  <Input
                    id={"league-" + key}
                    value={draft[key] ?? LEAGUE_PALETTES[0][key]}
                    onChange={(e) => patch({ [key]: e.target.value })}
                    maxLength={7}
                    spellCheck={false}
                    className="h-11 font-mono"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Text and button shades adjust automatically to stay readable in
              light and dark mode.
            </p>
          </section>
          <section className="lg-card space-y-5 p-5">
            <h3 className="font-semibold">Profile & cover images</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Use a logo, team photo or court image. JPG, PNG, WebP or GIF, up
              to 8 MB. Branding images can appear on shared invitations; upload
              images suitable for public viewing.
            </p>
            {(["logo", "cover"] as const).map((kind) => {
              const url = draft[`${kind}_url`];
              const label = kind === "logo" ? "Profile image" : "Cover image";
              return (
                <div key={kind} className="space-y-3 border-t pt-4">
                  <label
                    className="block text-sm font-medium"
                    htmlFor={`league-${kind}-upload`}
                  >
                    {label}
                  </label>
                  <Input
                    id={`league-${kind}-upload`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="h-auto min-h-11 cursor-pointer text-xs file:mr-3 file:rounded-md file:bg-muted file:px-3 file:py-1"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void upload(file, kind);
                    }}
                  />
                  {url ? (
                    <>
                      {kind === "logo" && (
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-medium">
                            Image shape
                            <select
                              aria-label="Profile image shape"
                              className="mt-1 h-11 w-full rounded-lg border bg-card px-2 text-sm"
                              value={draft.logo_shape ?? "square"}
                              onChange={(e) =>
                                patch({
                                  logo_shape: e.target
                                    .value as LeagueBrand["logo_shape"],
                                })
                              }
                            >
                              <option value="square">Rounded square</option>
                              <option value="circle">Circle</option>
                            </select>
                          </label>
                          <label className="text-xs font-medium">
                            Image fit
                            <select
                              aria-label="Profile image fit"
                              className="mt-1 h-11 w-full rounded-lg border bg-card px-2 text-sm"
                              value={draft.logo_fit ?? "cover"}
                              onChange={(e) =>
                                patch({
                                  logo_fit: e.target
                                    .value as LeagueBrand["logo_fit"],
                                })
                              }
                            >
                              <option value="cover">Fill frame</option>
                              <option value="contain">Show full image</option>
                            </select>
                          </label>
                        </div>
                      )}
                      <VenueImagePositionEditor
                        src={url}
                        label={label}
                        kind={kind}
                        fit={
                          kind === "cover"
                            ? "cover"
                            : (draft.logo_fit ?? "cover")
                        }
                        shape={draft.logo_shape ?? "square"}
                        backgroundColor={
                          normalizeHex(draft.primary_color) ?? "#c9962f"
                        }
                        value={draft[`${kind}_crop`]}
                        onChange={(crop) => patch({ [`${kind}_crop`]: crop })}
                        disabled={busy}
                        saveHint="Save league branding to apply."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft((previous) => {
                            const next = { ...previous };
                            delete next[`${kind}_url`];
                            delete next[`${kind}_crop`];
                            return next;
                          })
                        }
                      >
                        Remove {label.toLowerCase()}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                      <ImagePlus className="h-4 w-4 shrink-0" />
                      {kind === "logo"
                        ? "Your league initials appear until you add an image."
                        : "Your color palette and court artwork appear here."}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </fieldset>
        <aside className="min-w-0 space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Live preview</h3>
            <span className="text-xs text-muted-foreground">
              {dirty ? "Unsaved changes" : "Current branding"}
            </span>
          </div>
          <LeagueScope
            brand={draft}
            className="league-player !min-h-0 rounded-3xl"
          >
            <PlayerLeagueStage
              title={league.name}
              description={league.location}
              branding={draft}
              showIdentity
              compact
            />
            <div className="flex flex-wrap items-center gap-3 p-4">
              <Button
                type="button"
                tabIndex={-1}
                className="pointer-events-none"
              >
                Enter league
              </Button>
              <span className="text-xs text-[color:var(--lg-accent-gold)]">
                Your league. Your look.
              </span>
            </div>
          </LeagueScope>
        </aside>
      </div>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-lg">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? (
              uploading ? (
                "Uploading image…"
              ) : (
                "Saving…"
              )
            ) : dirty ? (
              "Save league branding"
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Branding saved
              </>
            )}
          </Button>
          {dirty && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(saved)}
            >
              Discard changes
            </Button>
          )}
        </div>
        <Button variant="ghost" disabled={busy} onClick={() => setDraft({})}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to PULSE
        </Button>
      </div>
    </div>
  );
}
