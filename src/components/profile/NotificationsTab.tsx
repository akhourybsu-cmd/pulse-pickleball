import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface NotificationsTabProps {
  formData: {
    notify_score_email: boolean;
    notify_score_sms: boolean;
    notify_score_push: boolean;
    notify_badges_email: boolean;
    notify_badges_sms: boolean;
    notify_badges_push: boolean;
  };
  onFormChange: (updates: Partial<NotificationsTabProps['formData']>) => void;
}

export function NotificationsTab({
  formData,
  onFormChange,
}: NotificationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Score Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Score Confirmation Requests</CardTitle>
          <CardDescription>Get notified when your score needs confirmation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_score_email" className="font-medium">Email</Label>
              <p className="text-xs text-muted-foreground">Receive confirmation requests via email</p>
            </div>
            <Switch
              id="notify_score_email"
              checked={formData.notify_score_email}
              onCheckedChange={(checked) => onFormChange({ notify_score_email: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_score_sms" className="font-medium">SMS</Label>
              <p className="text-xs text-muted-foreground">Receive confirmation requests via text message</p>
            </div>
            <Switch
              id="notify_score_sms"
              checked={formData.notify_score_sms}
              onCheckedChange={(checked) => onFormChange({ notify_score_sms: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_score_push" className="font-medium">Push Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive confirmation requests as push notifications</p>
            </div>
            <Switch
              id="notify_score_push"
              checked={formData.notify_score_push}
              onCheckedChange={(checked) => onFormChange({ notify_score_push: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Badge & Match Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Match Approvals & Badge Unlocks</CardTitle>
          <CardDescription>Get notified about match results and achievements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_badges_email" className="font-medium">Email</Label>
              <p className="text-xs text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              id="notify_badges_email"
              checked={formData.notify_badges_email}
              onCheckedChange={(checked) => onFormChange({ notify_badges_email: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_badges_sms" className="font-medium">SMS</Label>
              <p className="text-xs text-muted-foreground">Receive updates via text message</p>
            </div>
            <Switch
              id="notify_badges_sms"
              checked={formData.notify_badges_sms}
              onCheckedChange={(checked) => onFormChange({ notify_badges_sms: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify_badges_push" className="font-medium">Push Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive updates as push notifications</p>
            </div>
            <Switch
              id="notify_badges_push"
              checked={formData.notify_badges_push}
              onCheckedChange={(checked) => onFormChange({ notify_badges_push: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
