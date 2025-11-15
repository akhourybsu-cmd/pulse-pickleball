import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";

interface EditModeBannerProps {
  isEditMode: boolean;
  eventName: string;
  hasUnsavedChanges: boolean;
  onToggleEdit: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
}

export function EditModeBanner({
  isEditMode,
  eventName,
  hasUnsavedChanges,
  onToggleEdit,
  onSave,
  onDiscard,
}: EditModeBannerProps) {
  if (!isEditMode) {
    return (
      <Button onClick={onToggleEdit} variant="outline" size="sm">
        <Edit className="w-4 h-4 mr-2" />
        Edit Event
      </Button>
    );
  }

  return (
    <Alert className="border-primary bg-primary/10 dark:bg-primary/5">
      <Edit className="w-4 h-4 text-primary" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-foreground">
          You're editing <strong>{eventName}</strong>
          {hasUnsavedChanges && (
            <span className="text-destructive ml-2">
              (Unsaved changes)
            </span>
          )}
        </span>
        <div className="flex gap-2">
          {hasUnsavedChanges && onSave && (
            <Button onClick={onSave} size="sm" variant="default">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          )}
          {hasUnsavedChanges && onDiscard && (
            <Button onClick={onDiscard} size="sm" variant="outline">
              <X className="w-4 h-4 mr-2" />
              Discard
            </Button>
          )}
          <Button onClick={onToggleEdit} size="sm" variant="outline">
            Exit Edit Mode
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
