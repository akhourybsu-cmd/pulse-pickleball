import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, MessageSquare, FolderOpen } from 'lucide-react';
import { GroupSettings } from '@/types/groupSettings';

interface AdminPermissionsTabProps {
  settings: GroupSettings;
  saving: boolean;
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
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1 pr-4">
        <Label htmlFor={id} className="font-medium cursor-pointer">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

export function AdminPermissionsTab({ settings, saving, onSettingChange }: AdminPermissionsTabProps) {
  return (
    <div className="space-y-6">
      {/* Member Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Permissions
          </CardTitle>
          <CardDescription>
            Control what regular members can do in the group.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <PermissionRow
            id="allow_member_posts"
            label="Allow member posts"
            description="Members can create posts in the feed"
            checked={settings.allow_member_posts}
            disabled={saving}
            onChange={(checked) => onSettingChange('allow_member_posts', checked)}
          />
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
          <PermissionRow
            id="allow_member_lfg"
            label="Allow member LFG posts"
            description="Members can create Looking for Game posts"
            checked={settings.allow_member_lfg}
            disabled={saving}
            onChange={(checked) => onSettingChange('allow_member_lfg', checked)}
          />
        </CardContent>
      </Card>

      {/* Chat & Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat & Files
          </CardTitle>
          <CardDescription>
            Control chat and file sharing features.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
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
        </CardContent>
      </Card>

      {/* Moderator Capabilities */}
      <Card>
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
      </Card>
    </div>
  );
}
