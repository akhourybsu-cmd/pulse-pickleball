import { parseGroupSettings } from "@/types/groupSettings";

export type CommunityTab = "feed" | "schedule" | "chat" | "members" | "more";

export function communityTab(
  value: string | null,
  chatEnabled = true
): CommunityTab {
  if (value === "events" || value === "play") return "schedule";
  if (value === "files" || value === "about") return "more";
  if (value === "chat") return chatEnabled ? "chat" : "feed";
  return value === "schedule" || value === "members" || value === "more"
    ? value
    : "feed";
}

export function communityAbilities(
  settings: unknown,
  membership?: { status: string; role: string } | null
) {
  const config = parseGroupSettings(settings);
  const active = membership?.status === "active";
  const owner = active && membership.role === "owner";
  const moderator = active && membership.role === "moderator";
  const admin = owner || moderator;
  return {
    post: active && (admin || config.allow_member_posts),
    lfg:
      active &&
      (admin || (config.allow_member_posts && config.allow_member_lfg)),
    event:
      active &&
      (owner ||
        (moderator && config.moderators_can_create_events) ||
        config.allow_member_events),
    chat: active && config.chat_enabled,
    sendChat:
      active && config.chat_enabled && (admin || config.allow_member_chat),
    files: active && config.files_enabled,
    upload:
      active &&
      config.files_enabled &&
      (owner ||
        (moderator && config.moderators_can_manage_files) ||
        config.allow_member_uploads),
  };
}
