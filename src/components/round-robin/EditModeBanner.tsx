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

/**
 * Compact edit-mode bar.
 *
 * Pre-overhaul: a large shadcn Alert block that ate ~70px of vertical
 * space above the hero. Now: a single slim row — primary-tinted edit
 * chip + event name + a tight action cluster. Reads as a status bar,
 * not a banner, which is what "edit mode" actually is.
 *
 * The non-edit "Edit Event" button branch is preserved so callers that
 * render the toggle inline keep working unchanged.
 */
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/8 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-primary/15 text-primary px-2 text-[11px] font-semibold uppercase tracking-wide flex-shrink-0">
          <Edit className="h-3 w-3" />
          Editing
        </span>
        <span className="text-sm font-medium text-foreground truncate">
          {eventName}
        </span>
        {hasUnsavedChanges && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
            · Unsaved
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {hasUnsavedChanges && onSave && (
          <Button onClick={onSave} size="sm" className="h-8 gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        )}
        {hasUnsavedChanges && onDiscard && (
          <Button onClick={onDiscard} size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground">
            <X className="w-3.5 h-3.5" />
            Discard
          </Button>
        )}
        <Button onClick={onToggleEdit} size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-foreground">
          Exit
        </Button>
      </div>
    </div>
  );
}
