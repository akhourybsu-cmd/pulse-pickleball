import type { GroupWithMembership } from "@/hooks/useGroups";
import { GroupCard } from "./GroupCard";
/** Shared cards keep discovery and joined communities visually consistent. */
export function ReorderableGroupList({
  groups,
}: {
  groups: GroupWithMembership[];
  onReorder?: (groups: GroupWithMembership[]) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
