import { Users, Lock, Megaphone, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAdminGroups } from "@/hooks/useAdminGroups";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type GroupVisibility = "personal" | "private_group" | "shared_group";

interface GroupShareStepProps {
  visibility: GroupVisibility;
  groupId: string | null;
  onChange: (visibility: GroupVisibility, groupId: string | null) => void;
}

export function GroupShareStep({ visibility, groupId, onChange }: GroupShareStepProps) {
  const navigate = useNavigate();
  const { adminGroups, loading } = useAdminGroups();
  const hasGroups = adminGroups.length > 0;

  const options: {
    id: GroupVisibility;
    icon: typeof Users;
    title: string;
    desc: string;
    requiresGroup: boolean;
  }[] = [
    {
      id: "personal",
      icon: Users,
      title: "Just me / friends I add",
      desc: "Private event — invite players manually. No group post.",
      requiresGroup: false,
    },
    {
      id: "private_group",
      icon: Lock,
      title: "Private to a group",
      desc: "Only members of the chosen group can see and join.",
      requiresGroup: true,
    },
    {
      id: "shared_group",
      icon: Megaphone,
      title: "Share to a group",
      desc: "Auto-posts to the group feed and creates a public sign-up link.",
      requiresGroup: true,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Where should this Round Robin live?</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Choose who can see and join this event.
      </p>

      <div className="flex-1 flex flex-col gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = visibility === opt.id;
          const disabled = opt.requiresGroup && !hasGroups && !loading;

          return (
            <div key={opt.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (opt.id === "personal") {
                    onChange("personal", null);
                  } else {
                    // Default to first admin group if none picked yet
                    const nextGroupId = groupId || adminGroups[0]?.id || null;
                    onChange(opt.id, nextGroupId);
                  }
                }}
                className={cn(
                  "w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "p-2.5 rounded-lg shrink-0",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{opt.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  {disabled && (
                    <p className="text-xs text-amber-600 mt-1">
                      You don't admin any groups yet.
                    </p>
                  )}
                </div>
              </button>

              {/* Group picker shown directly under selected option */}
              {selected && opt.requiresGroup && hasGroups && (
                <div className="mt-2 ml-1 pl-12">
                  <Select
                    value={groupId || ""}
                    onValueChange={(v) => onChange(opt.id, v)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {adminGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}

        {!loading && !hasGroups && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 self-start"
            onClick={() => navigate("/player/community")}
          >
            Create a group first
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
