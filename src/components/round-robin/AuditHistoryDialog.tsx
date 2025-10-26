import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, User, FileEdit } from "lucide-react";

interface AuditEntry {
  id: string;
  action_type: string;
  changed_by: string;
  changed_by_name?: string;
  old_value: any;
  new_value: any;
  created_at: string;
}

interface AuditHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditEntries: AuditEntry[];
}

export function AuditHistoryDialog({
  open,
  onOpenChange,
  auditEntries,
}: AuditHistoryDialogProps) {
  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      update_settings: "Updated Event Settings",
      add_player: "Added Player",
      mark_inactive: "Marked Player Inactive",
      substitute_player: "Substituted Player",
      update_courts: "Updated Courts",
      update_rounds: "Updated Rounds",
      swap_partners: "Swapped Partners",
      swap_opponents: "Swapped Opponents",
      move_court: "Moved Match Court",
      edit_score: "Edited Match Score",
      void_match: "Voided Match",
      delete_match: "Deleted Match",
    };
    return labels[actionType] || actionType;
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes("delete") || actionType.includes("void")) {
      return "destructive";
    }
    if (actionType.includes("add") || actionType.includes("substitute")) {
      return "default";
    }
    return "secondary";
  };

  const formatValue = (value: any): string => {
    if (!value) return "N/A";
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="w-5 h-5" />
            Audit History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {auditEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No changes recorded yet
            </div>
          ) : (
            <div className="space-y-4">
              {auditEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 space-y-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Badge variant={getActionColor(entry.action_type)}>
                        {getActionLabel(entry.action_type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{entry.changed_by_name || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {format(new Date(entry.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {entry.old_value && (
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Previous Value
                        </div>
                        <div className="bg-muted/50 rounded p-2 font-mono text-xs whitespace-pre-wrap break-all">
                          {formatValue(entry.old_value)}
                        </div>
                      </div>
                    )}
                    {entry.new_value && (
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          New Value
                        </div>
                        <div className="bg-muted/50 rounded p-2 font-mono text-xs whitespace-pre-wrap break-all">
                          {formatValue(entry.new_value)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
