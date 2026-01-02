export interface GroupSettings {
  // Content Permissions
  allow_member_posts: boolean;
  require_post_approval: boolean;
  allow_member_events: boolean;
  allow_member_lfg: boolean;
  
  // Moderator Permissions
  moderators_can_approve_posts: boolean;
  moderators_can_approve_members: boolean;
  moderators_can_remove_members: boolean;
  moderators_can_create_events: boolean;
  moderators_can_manage_files: boolean;
  
  // Chat Settings
  chat_enabled: boolean;
  allow_member_chat: boolean;
  
  // File Settings
  files_enabled: boolean;
  allow_member_uploads: boolean;
}

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  allow_member_posts: true,
  require_post_approval: false,
  allow_member_events: true,
  allow_member_lfg: true,
  moderators_can_approve_posts: true,
  moderators_can_approve_members: true,
  moderators_can_remove_members: false,
  moderators_can_create_events: true,
  moderators_can_manage_files: true,
  chat_enabled: true,
  allow_member_chat: true,
  files_enabled: true,
  allow_member_uploads: true,
};

export function parseGroupSettings(settings: unknown): GroupSettings {
  const parsed = settings as Partial<GroupSettings> | null;
  return {
    ...DEFAULT_GROUP_SETTINGS,
    ...parsed,
  };
}
