import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, User, FileEdit } from "lucide-react";

interface AuditEntry {
  id: string;
  change_type: string;
  editor_id: string;
  editor_name?: string;
  changes: {
    before?: any;
    after?: any;
  };
  created_at: string;
  reason?: string;
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
  const getActionLabel = (changeType: string) => {
    const labels: Record<string, string> = {
      event_settings: "Updated Event Settings",
      player_add: "Added Player",
      player_inactive: "Marked Player Inactive",
      player_substitute: "Substituted Player",
      courts_update: "Updated Courts",
      rounds_update: "Updated Rounds",
      schedule_edit: "Edited Schedule",
      score_edit: "Edited Match Score",
      match_void: "Voided Match",
      match_delete: "Deleted Match",
    };
    return labels[changeType] || changeType;
  };

  const getActionColor = (changeType: string) => {
    if (changeType.includes("delete") || changeType.includes("void")) {
      return "destructive";
    }
    if (changeType.includes("add") || changeType.includes("substitute")) {
      return "default";
    }
    return "secondary";
  };

  const formatChanges = (changes: any): { before: string; after: string } => {
    if (!changes) return { before: "N/A", after: "N/A" };
    
    const formatValue = (value: any): string => {
      if (!value) return "N/A";
      if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    };

    return {
      before: formatValue(changes.before),
      after: formatValue(changes.after),
    };
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
              {auditEntries.map((entry) => {
                const formattedChanges = formatChanges(entry.changes);
                return (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-4 space-y-3 bg-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <Badge variant={getActionColor(entry.change_type)}>
                          {getActionLabel(entry.change_type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{entry.editor_name || "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {format(new Date(entry.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {entry.reason && (
                      <div className="text-sm text-muted-foreground italic">
                        {entry.reason}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {formattedChanges.before !== "N/A" && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">
                            Previous Value
                          </div>
                          <div className="bg-muted/50 rounded p-2 font-mono text-xs whitespace-pre-wrap break-all">
                            {formattedChanges.before}
                          </div>
                        </div>
                      )}
                      {formattedChanges.after !== "N/A" && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">
                            New Value
                          </div>
                          <div className="bg-muted/50 rounded p-2 font-mono text-xs whitespace-pre-wrap break-all">
                            {formattedChanges.after}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
