import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, MessageSquare } from 'lucide-react';
import { GroupSettings } from '@/types/groupSettings';

interface AdminPermissionsTabProps {
  settings: GroupSettings;
  saving: boolean;
  venueMode?: boolean;
  onSettingChange: <K extends keyof GroupSettings>(key: K, value: GroupSettings[K]) => void;
}

interface PermissionRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function PermissionRow({ id, label, description, checked, disabled, onChange }: PermissionRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">{label}</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export function AdminPermissionsTab({ settings, saving, venueMode = false, onSettingChange }: AdminPermissionsTabProps) {
  return (
    <div className="space-y-5">
      {/* Member Permissions */}
      <Card className="overflow-hidden border-border/70 shadow-[0_14px_40px_-34px_hsl(var(--foreground)/0.4)]">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Member activity
          </CardTitle>
          <CardDescription>
            {venueMode ? 'Choose what members can publish in the venue feed.' : 'Control what regular members can do in the group.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-0">
          <PermissionRow
            id="allow_member_posts"
            label="Allow member posts"
            description="Members can create posts in the feed"
            checked={settings.allow_member_posts}
            disabled={saving}
            onChange={(checked) => onSettingChange('allow_member_posts', checked)}
          />
          {!venueMode && (
            <>
              <PermissionRow
                id="require_post_approval"
                label="Require post approval"
                description="Posts from members need admin approval before appearing"
                checked={settings.require_post_approval}
                disabled={saving || !settings.allow_member_posts}
                onChange={(checked) => onSettingChange('require_post_approval', checked)}
              />
              <PermissionRow
                id="allow_member_events"
                label="Allow member events"
                description="Members can create group events"
                checked={settings.allow_member_events}
                disabled={saving}
                onChange={(checked) => onSettingChange('allow_member_events', checked)}
              />
            </>
          )}
          <PermissionRow
            id="allow_member_lfg"
            label="Allow Find Players posts"
            description="Members can organize games and fill open player spots"
            checked={settings.allow_member_lfg}
            disabled={saving || !settings.allow_member_posts}
            onChange={(checked) => onSettingChange('allow_member_lfg', checked)}
          />
        </CardContent>
      </Card>

      {/* Chat & Files */}
      <Card className="overflow-hidden border-border/70 shadow-[0_14px_40px_-34px_hsl(var(--foreground)/0.4)]">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" />
            {venueMode ? 'Venue chat' : 'Chat & Files'}
          </CardTitle>
          <CardDescription>
            {venueMode ? 'Control whether chat is visible and whether members can reply.' : 'Control chat and file sharing features.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-0">
          <PermissionRow
            id="chat_enabled"
            label="Enable chat"
            description="Show the chat tab in the group"
            checked={settings.chat_enabled}
            disabled={saving}
            onChange={(checked) => onSettingChange('chat_enabled', checked)}
          />
          <PermissionRow
            id="allow_member_chat"
            label="Allow member messages"
            description="Members can send messages in chat"
            checked={settings.allow_member_chat}
            disabled={saving || !settings.chat_enabled}
            onChange={(checked) => onSettingChange('allow_member_chat', checked)}
          />
          {!venueMode && (
            <>
              <PermissionRow
                id="files_enabled"
                label="Enable files"
                description="Show the files tab in the group"
                checked={settings.files_enabled}
                disabled={saving}
                onChange={(checked) => onSettingChange('files_enabled', checked)}
              />
              <PermissionRow
                id="allow_member_uploads"
                label="Allow member uploads"
                description="Members can upload files to the group"
                checked={settings.allow_member_uploads}
                disabled={saving || !settings.files_enabled}
                onChange={(checked) => onSettingChange('allow_member_uploads', checked)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Moderator Capabilities */}
      {!venueMode && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Moderator Capabilities
          </CardTitle>
          <CardDescription>
            Define what moderators can do beyond regular members.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <PermissionRow
            id="moderators_can_approve_posts"
            label="Can approve posts"
            description="Moderators can approve pending member posts"
            checked={settings.moderators_can_approve_posts}
            disabled={saving}
            onChange={(checked) => onSettingChange('moderators_can_approve_posts', checked)}
          />
          <PermissionRow
            id="moderators_can_approve_members"
            label="Can approve members"
            description="Moderators can accept or reject join requests"
            checked={settings.moderators_can_approve_members}
            disabled={saving}
            onChange={(checked) => onSettingChange('moderators_can_approve_members', checked)}
          />
          <PermissionRow
            id="moderators_can_remove_members"
            label="Can remove members"
            description="Moderators can kick members from the group"
            checked={settings.moderators_can_remove_members}
            disabled={saving}
            onChange={(checked) => onSettingChange('moderators_can_remove_members', checked)}
          />
          <PermissionRow
            id="moderators_can_create_events"
            label="Can create events"
            description="Moderators can create group events"
            checked={settings.moderators_can_create_events}
            disabled={saving}
            onChange={(checked) => onSettingChange('moderators_can_create_events', checked)}
          />
          <PermissionRow
            id="moderators_can_manage_files"
            label="Can manage files"
            description="Moderators can upload and delete files"
            checked={settings.moderators_can_manage_files}
            disabled={saving}
            onChange={(checked) => onSettingChange('moderators_can_manage_files', checked)}
          />
        </CardContent>
      </Card>}
    </div>
  );
}
