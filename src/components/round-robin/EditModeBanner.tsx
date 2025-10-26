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
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
      <Edit className="w-4 h-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          You're editing <strong>{eventName}</strong>
          {hasUnsavedChanges && (
            <span className="text-amber-600 dark:text-amber-400 ml-2">
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
