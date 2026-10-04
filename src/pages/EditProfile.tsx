import { AccountPageHeader } from "@/components/profile/AccountPageHeader";
import { withAuthDeadline } from "@/lib/authDeadline";
import { useAccountSessionState } from "@/lib/accountSession";
import { sanitizeRedirectPath } from "@/lib/authRedirect";
import { useAuthState } from "@/hooks/useAuthState";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { saveProfileChange } from "@/lib/saveProfileChange";
import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  UserCog,
  User,
  MapPin,
  Trophy,
  Gamepad2,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CityAutocomplete } from "@/components/match-wizard/CityAutocomplete";

import {
  ProfileIdentitySection,
  ProfileLocationSection,
} from "@/components/profile/ProfileBasicsTab";
import { TournamentInfoTab } from "@/components/profile/TournamentInfoTab";
import { PlayStyleTab } from "@/components/profile/PlayStyleTab";
import { TournamentReadinessCard } from "@/components/profile/TournamentReadinessCard";

import { getErrorMessage } from "@/lib/getErrorMessage";
import {
  prepareImageForUpload,
  storagePathFromPublicUrl,
  type ImageFit,
} from "@/lib/images/prepareImageUpload";

interface ProfileData {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  name_locked: boolean;
  avatar_url: string | null;
  town: string | null;
  state: string | null;
  location_name: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  discoverable_by_location: boolean;
  handedness: string | null;
  play_side: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  skill_level_self: string | null;
}

type SectionKey =
  | "identity"
  | "location"
  | "discovery"
  | "tournament"
  | "playstyle";

const focusToSection = (focus: string | null): SectionKey | null => {
  if (focus === "tournament") return "tournament";
  if (focus === "playstyle") return "playstyle";
  if (focus === "location") return "location";
  if (focus === "basics") return "identity";
  return null;
};

const EMPTY_DRAFT: Partial<ProfileData> = {};
const DEFAULT_PROFILE: ProfileData = {
  display_name: null,
  first_name: null,
  last_name: null,
  full_name: null,
  name_locked: false,
  avatar_url: null,
  town: null,
  state: null,
  location_name: null,
  location_place_id: null,
  location_lat: null,
  location_lng: null,
  discoverable_by_location: false,
  handedness: null,
  play_side: null,
  phone_number: null,
  date_of_birth: null,
  gender: null,
  skill_level_self: null,
};

const EditProfile = () => {
  const { user } = useAuthState();
  return user ? <ProfileEditor key={user.id} /> : null;
};

const ProfileEditor = () => {
  const { user, refresh: refreshAuthProfile } = useAuthState();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("return")
    ? sanitizeRedirectPath(searchParams.get("return"))
    : null;
  const focusSection = focusToSection(searchParams.get("focus"));
  const [openSections, setOpenSections] = useAccountSessionState<string[]>(
    user!.id,
    "profile-sections",
    focusSection ? [focusSection] : ["identity"]
  );
  useEffect(() => {
    if (focusSection)
      setOpenSections((current) =>
        current.includes(focusSection) ? current : [...current, focusSection]
      );
    // Only a new explicit focus link changes the section; returning keeps its state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSection]);
  const [draft, setDraft] = useAccountSessionState<Partial<ProfileData>>(
    user!.id,
    "profile-draft",
    EMPTY_DRAFT
  );
  const [uploading, setUploading] = useState(false);
  const [avatarFit, setAvatarFit] = useAccountSessionState<ImageFit>(
    user!.id,
    "profile-photo-fit",
    "contain"
  );
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [confirmingName, setConfirmingName] = useState(false);
  const savingLock = useRef(false);
  const query = useQuery({
    queryKey: ["account-profile", user!.id],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const { data: profileData, error } = await withAuthDeadline((signal) =>
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user!.id)
          .abortSignal(signal)
          .single()
      );
      if (error) throw error;
      if (!profileData) throw new Error("Your profile could not be loaded.");
      return {
        display_name: profileData.display_name,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        full_name: profileData.full_name,
        name_locked:
          ((profileData as Record<string, unknown>).name_locked as boolean) ??
          false,
        avatar_url: profileData.avatar_url,
        town: profileData.town,
        state: profileData.state,
        // Cast: these columns aren't in the generated types until regenerated
        // after the location-discovery migration is deployed.
        location_name:
          ((profileData as Record<string, unknown>).location_name as string) ??
          null,
        location_place_id:
          ((profileData as Record<string, unknown>)
            .location_place_id as string) ?? null,
        location_lat:
          ((profileData as Record<string, unknown>).location_lat as number) ??
          null,
        location_lng:
          ((profileData as Record<string, unknown>).location_lng as number) ??
          null,
        discoverable_by_location:
          ((profileData as Record<string, unknown>)
            .discoverable_by_location as boolean) ?? false,
        handedness: profileData.handedness,
        play_side: profileData.play_side,
        phone_number: profileData.phone_number,
        date_of_birth: profileData.date_of_birth,
        gender: profileData.gender,
        skill_level_self: profileData.skill_level_self,
      } as ProfileData;
    },
  });
  const loading = query.isLoading;
  // A fresh read never overwrites unsaved fields. Locked names remain authoritative.
  const formData: ProfileData = {
    ...DEFAULT_PROFILE,
    ...query.data,
    ...draft,
    name_locked: query.data?.name_locked ?? false,
    ...(query.data?.name_locked
      ? {
          first_name: query.data.first_name,
          last_name: query.data.last_name,
          full_name: query.data.full_name,
        }
      : {}),
  };
  const commitSaved = (payload: Partial<ProfileData>, submitted = payload) => {
    queryClient.setQueryData<ProfileData>(
      ["account-profile", user!.id],
      (old) => ({ ...DEFAULT_PROFILE, ...old, ...payload })
    );
    setDraft((current) => {
      const next = { ...current };
      for (const key of Object.keys(submitted) as (keyof ProfileData)[]) {
        if (next[key] === submitted[key]) delete next[key];
      }
      return next;
    });
    // Refresh dependent screens in the background; a successful write is already saved.
    void refreshAuthProfile();
    for (const key of [
      "player-profile",
      "view-profile",
      "nearby-players",
      "group-members",
      "group-posts",
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const handleFormChange = (updates: Partial<ProfileData>) =>
    setDraft((prev) => ({ ...prev, ...updates }));

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id || savingLock.current) return;
    savingLock.current = true;

    setUploading(true);
    try {
      const prepared = await prepareImageForUpload(file, {
        maxInputMB: 12,
        maxOutputMB: 5,
        maxDimension: 1024,
        minWidth: 320,
        minHeight: 320,
        quality: 0.92,
        squareFit: avatarFit,
      });
      const fileName = `${Date.now()}.${prepared.extension}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, prepared.blob, {
          contentType: prepared.blob.type,
          cacheControl: "31536000",
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Keep the uploaded file on an uncertain write outcome: deleting it could
      // break a profile update that reached the server before a connection loss.
      await saveProfileChange(user.id, { avatar_url: publicUrl });
      const previousPath = storagePathFromPublicUrl(
        formData.avatar_url,
        "avatars"
      );
      commitSaved({ avatar_url: publicUrl });
      if (previousPath && previousPath !== filePath) {
        void supabase.storage.from("avatars").remove([previousPath]);
      }
      toast.success(
        `Profile picture updated · ${
          avatarFit === "contain" ? "full photo shown" : "frame filled"
        }`
      );
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error(getErrorMessage(error, "Failed to upload profile picture"));
    } finally {
      savingLock.current = false;
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id || !formData.avatar_url || savingLock.current) return;
    savingLock.current = true;
    setUploading(true);
    try {
      const oldPath = storagePathFromPublicUrl(formData.avatar_url, "avatars");
      await saveProfileChange(user.id, { avatar_url: null });
      commitSaved({ avatar_url: null });
      if (oldPath) {
        void supabase.storage
          .from("avatars")
          .remove([oldPath])
          .catch((error) => console.warn("Old avatar cleanup failed", error));
      }
      toast.success("Profile picture removed");
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error("Failed to remove profile picture");
    } finally {
      savingLock.current = false;
      setUploading(false);
    }
  };

  const saveSection = async (
    section: SectionKey,
    payload: Partial<ProfileData>
  ) => {
    if (!user?.id || savingLock.current) return;

    // First/last are only in the payload while the name is still editable
    // (unlocked). Once locked, the identity save carries display_name only,
    // so skip the required-name check in that case.
    if (section === "identity" && !formData.name_locked) {
      if (
        !payload.first_name?.toString().trim() ||
        !payload.last_name?.toString().trim()
      ) {
        toast.error("First and last name are required");
        return;
      }
    }

    if (
      section === "discovery" &&
      payload.discoverable_by_location &&
      (payload.location_lat == null || payload.location_lng == null)
    ) {
      toast.error("Choose a home city before enabling nearby discovery.");
      return;
    }
    if (
      payload.date_of_birth &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date_of_birth) ||
        payload.date_of_birth > new Date().toISOString().slice(0, 10))
    ) {
      toast.error("Enter a valid date of birth in the past.");
      return;
    }
    const normalized = Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() || null : value,
      ])
    ) as Partial<ProfileData>;
    savingLock.current = true;
    setSavingSection(section);
    try {
      await saveProfileChange(user.id, normalized);
      commitSaved(normalized, payload);
      toast.success("Saved");
    } catch (error) {
      console.error("Error saving section:", error);
      toast.error("Failed to save");
    } finally {
      savingLock.current = false;
      setSavingSection(null);
    }
  };

  // Existing users lock in their name once, deliberately. This is the only
  // client path that flips name_locked false -> true; the DB guard freezes
  // first/last from that point on.
  const confirmName = async () => {
    if (!user?.id || savingLock.current) return;
    const first = formData.first_name?.trim();
    const last = formData.last_name?.trim();
    if (!first || !last) {
      toast.error("Enter your first and last name before locking it in");
      return;
    }

    savingLock.current = true;
    setConfirmingName(true);
    try {
      await saveProfileChange(user.id, {
        first_name: first,
        last_name: last,
        full_name: `${first} ${last}`,
        name_locked: true,
      });
      commitSaved(
        {
          first_name: first,
          last_name: last,
          full_name: `${first} ${last}`,
          name_locked: true,
        },
        {
          first_name: formData.first_name,
          last_name: formData.last_name,
        }
      );
      toast.success("Name locked in");
    } catch (error) {
      console.error("Error confirming name:", error);
      toast.error("Failed to lock in name");
    } finally {
      savingLock.current = false;
      setConfirmingName(false);
    }
  };

  if (query.isError && !query.data) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <AccountPageHeader
          icon={UserCog}
          title="Edit profile"
          subtitle="Your details and playing preferences."
        />
        <div role="alert" className="space-y-3 rounded-xl border p-4">
          <p>
            We couldn’t load your profile. Your unfinished edits have been kept.
          </p>
          <Button
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  const SectionSaveButton = ({
    section,
    onClick,
  }: {
    section: SectionKey;
    onClick: () => void;
  }) => (
    <Button
      size="sm"
      onClick={onClick}
      disabled={!!savingSection || uploading || confirmingName}
      className="min-h-10 w-full rounded-xl px-6 sm:w-auto"
    >
      {savingSection === section ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        "Save"
      )}
    </Button>
  );

  const SectionHeader = ({
    icon: Icon,
    title,
    hint,
  }: {
    icon: typeof User;
    title: string;
    hint?: string;
  }) => (
    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <div className="account-setting-icon">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold sm:text-base">{title}</div>
        {hint && (
          <div className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <AccountPageHeader
        icon={UserCog}
        title="Edit profile"
        subtitle="Your details and playing preferences."
      />

      <div className="account-settings-content">
        {Object.keys(draft).length > 0 && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm"
          >
            <p>
              Unfinished edits are kept on this device for this tab. Save each
              section to update your account.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!!savingSection || uploading || confirmingName}
              onClick={() => setDraft({})}
            >
              Discard edits
            </Button>
          </div>
        )}

        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={setOpenSections}
          className="space-y-3"
        >
          <AccordionItem value="identity" className="account-editor-section">
            <AccordionTrigger className="account-editor-trigger">
              <SectionHeader
                icon={User}
                title="Photo & Identity"
                hint={
                  formData.first_name && formData.last_name
                    ? `${formData.first_name} ${formData.last_name}`
                    : "Add your name"
                }
              />
            </AccordionTrigger>
            <AccordionContent className="account-editor-content">
              <ProfileIdentitySection
                formData={{
                  first_name: formData.first_name,
                  last_name: formData.last_name,
                  display_name: formData.display_name,
                  avatar_url: formData.avatar_url,
                }}
                onFormChange={handleFormChange}
                onFileUpload={handleFileUpload}
                onRemoveAvatar={handleRemoveAvatar}
                uploading={uploading}
                avatarFit={avatarFit}
                onAvatarFitChange={setAvatarFit}
                nameLocked={formData.name_locked}
              />

              {!formData.name_locked && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck
                      className="h-4 w-4 mt-0.5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Confirm your name</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This is your name of record for leagues and tournaments.
                        Once you lock it in, it can't be changed here — so make
                        sure it's spelled correctly. Your{" "}
                        <span className="font-medium">display name</span> stays
                        editable.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={confirmName}
                      disabled={
                        confirmingName ||
                        !formData.first_name?.trim() ||
                        !formData.last_name?.trim()
                      }
                    >
                      {confirmingName ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Locking in...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Confirm &amp; lock in name
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="account-section-actions">
                <SectionSaveButton
                  section="identity"
                  onClick={() =>
                    saveSection(
                      "identity",
                      formData.name_locked
                        ? { display_name: formData.display_name }
                        : {
                            first_name: formData.first_name,
                            last_name: formData.last_name,
                            full_name: `${formData.first_name?.trim() ?? ""} ${
                              formData.last_name?.trim() ?? ""
                            }`.trim(),
                            display_name: formData.display_name,
                          }
                    )
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="location" className="account-editor-section">
            <AccordionTrigger className="account-editor-trigger">
              <SectionHeader
                icon={MapPin}
                title="Location"
                hint={
                  formData.town || formData.state
                    ? [formData.town, formData.state].filter(Boolean).join(", ")
                    : "Where you play"
                }
              />
            </AccordionTrigger>
            <AccordionContent className="account-editor-content">
              <ProfileLocationSection
                formData={{ town: formData.town, state: formData.state }}
                onFormChange={handleFormChange}
              />
              <div className="account-section-actions">
                <SectionSaveButton
                  section="location"
                  onClick={() =>
                    saveSection("location", {
                      town: formData.town,
                      state: formData.state,
                    })
                  }
                />
              </div>

              {/* Nearby discovery — opt-in and reciprocal. You only appear in
                  other players' "Nearby" search when this is on, and you only
                  see nearby players when you're discoverable yourself. */}
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Let nearby players find me
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Appear in other players'{" "}
                      <span className="font-medium">Nearby</span> search by
                      distance. You'll only see nearby players while this is on.
                    </p>
                  </div>
                  <Switch
                    checked={formData.discoverable_by_location}
                    onCheckedChange={(v) =>
                      handleFormChange({ discoverable_by_location: v })
                    }
                    aria-label="Discoverable by nearby players"
                  />
                </div>

                {formData.discoverable_by_location && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Home city (used only to compute distance)
                    </Label>
                    {formData.location_name ? (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background px-3 py-2">
                        <span className="text-sm flex items-center gap-1.5 min-w-0">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {formData.location_name}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() =>
                            handleFormChange({
                              location_name: null,
                              location_place_id: null,
                              location_lat: null,
                              location_lng: null,
                            })
                          }
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <CityAutocomplete
                        onSelect={(c) =>
                          handleFormChange({
                            location_name: c.name,
                            location_place_id: c.placeId,
                            location_lat: c.latitude ?? null,
                            location_lng: c.longitude ?? null,
                          })
                        }
                      />
                    )}
                    {formData.location_lat == null && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        Pick a home city so nearby players can be matched by
                        distance.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <SectionSaveButton
                    section="discovery"
                    onClick={() =>
                      saveSection("discovery", {
                        location_name: formData.location_name,
                        location_place_id: formData.location_place_id,
                        location_lat: formData.location_lat,
                        location_lng: formData.location_lng,
                        discoverable_by_location:
                          formData.discoverable_by_location,
                      })
                    }
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tournament" className="account-editor-section">
            <AccordionTrigger className="account-editor-trigger">
              <SectionHeader
                icon={Trophy}
                title="Player details"
                hint="Optional contact, birth date and skill information"
              />
            </AccordionTrigger>
            <AccordionContent className="account-editor-content">
              <TournamentInfoTab
                formData={{
                  phone_number: formData.phone_number,
                  date_of_birth: formData.date_of_birth,
                  gender: formData.gender,
                  skill_level_self: formData.skill_level_self,
                }}
                onFormChange={handleFormChange}
              />
              <div className="account-section-actions">
                <SectionSaveButton
                  section="tournament"
                  onClick={() =>
                    saveSection("tournament", {
                      phone_number: formData.phone_number,
                      date_of_birth: formData.date_of_birth,
                      gender: formData.gender,
                      skill_level_self: formData.skill_level_self,
                    })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="playstyle" className="account-editor-section">
            <AccordionTrigger className="account-editor-trigger">
              <SectionHeader
                icon={Gamepad2}
                title="Play Style"
                hint="Handedness, side"
              />
            </AccordionTrigger>
            <AccordionContent className="account-editor-content">
              <PlayStyleTab
                formData={{
                  handedness: formData.handedness,
                  play_side: formData.play_side,
                }}
                onFormChange={handleFormChange}
              />
              <div className="account-section-actions">
                <SectionSaveButton
                  section="playstyle"
                  onClick={() =>
                    saveSection("playstyle", {
                      handedness: formData.handedness,
                      play_side: formData.play_side,
                    })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <TournamentReadinessCard />

        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(returnUrl || "/player/profile")}
          >
            Back to profile
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
