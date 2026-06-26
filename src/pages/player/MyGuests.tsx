import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  UserPlus,
  Search,
  Send,
  Link2,
  Trash2,
  GitMerge,
  X,
} from "lucide-react";
import { GuestInviteDialog } from "@/components/round-robin/GuestInviteDialog";
import { PageSEO } from "@/components/seo/PageSEO";
import { toast } from "sonner";

type Guest = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  linked_user_id: string | null;
  created_at: string;
  group_id: string | null;
};

export default function MyGuests() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteGuest, setInviteGuest] = useState<Guest | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeConfirm, setMergeConfirm] = useState<{
    keep: Guest;
    remove: Guest;
  } | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: guests = [], isLoading } = useQuery({
    queryKey: ["my-guest-players", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_players")
        .select("id, display_name, email, phone, linked_user_id, created_at, group_id")
        .eq("created_by", userId!)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Guest[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.display_name.toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q),
    );
  }, [guests, search]);

  const addGuest = async () => {
    const display = name.trim();
    if (!display || !userId) return;
    setCreating(true);
    const { error } = await supabase
      .from("guest_players")
      .insert({ display_name: display, created_by: userId } as never);
    setCreating(false);
    if (error) {
      toast.error("Could not add guest.");
      return;
    }
    setName("");
    qc.invalidateQueries({ queryKey: ["my-guest-players", userId] });
    toast.success("Guest added to your roster.");
  };

  const removeGuest = async (g: Guest) => {
    if (!confirm(`Remove ${g.display_name} from your guest roster?`)) return;
    const { error } = await supabase.from("guest_players").delete().eq("id", g.id);
    if (error) {
      toast.error("Could not remove. They may still be linked to past round robins.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-guest-players", userId] });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const exitMergeMode = () => {
    setMergeMode(false);
    setSelectedIds([]);
  };

  const beginMerge = () => {
    if (selectedIds.length !== 2) return;
    const a = guests.find((g) => g.id === selectedIds[0]);
    const b = guests.find((g) => g.id === selectedIds[1]);
    if (!a || !b) return;
    // Prefer keeping the linked one; otherwise the older record.
    const keep = a.linked_user_id && !b.linked_user_id
      ? a
      : !a.linked_user_id && b.linked_user_id
        ? b
        : new Date(a.created_at) <= new Date(b.created_at)
          ? a
          : b;
    const remove = keep.id === a.id ? b : a;
    setMergeConfirm({ keep, remove });
  };

  const confirmMerge = async () => {
    if (!mergeConfirm) return;
    setMerging(true);
    const { error } = await supabase.rpc("merge_guest_players", {
      p_keep_id: mergeConfirm.keep.id,
      p_remove_id: mergeConfirm.remove.id,
    } as never);
    setMerging(false);
    if (error) {
      toast.error(error.message || "Merge failed.");
      return;
    }
    toast.success(
      `Merged into "${mergeConfirm.keep.display_name}". Past round robins updated.`,
    );
    setMergeConfirm(null);
    exitMergeMode();
    qc.invalidateQueries({ queryKey: ["my-guest-players", userId] });
  };

  // Suggest duplicates (case-insensitive name match).
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of guests) {
      const key = g.display_name.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, n]) => n > 1)
        .map(([k]) => k),
    );
  }, [guests]);

  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="Guest Roster | PULSE"
        description="Manage your reusable guest players for round robins."
        path="/player/guests"
      />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Guest Roster</h1>
          <p className="text-sm text-muted-foreground">
            Reusable guest profiles for casual & open-play round robins. Guests
            don't count toward PULSE Ratings until they claim an account.
          </p>
        </header>

        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Guest name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGuest()}
            />
            <Button onClick={addGuest} disabled={creating || !name.trim()}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search guests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </Card>

        {/* Merge toolbar */}
        {guests.length >= 2 && (
          <div className="flex items-center justify-between gap-2">
            {mergeMode ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Pick 2 guests to merge ({selectedIds.length}/2)
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={exitMergeMode}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={beginMerge}
                    disabled={selectedIds.length !== 2}
                  >
                    <GitMerge className="h-3.5 w-3.5 mr-1" /> Merge
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {duplicateNames.size > 0
                    ? `${duplicateNames.size} possible duplicate${duplicateNames.size === 1 ? "" : "s"} detected`
                    : "Tip: use Merge to combine duplicate guests"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMergeMode(true)}
                >
                  <GitMerge className="h-3.5 w-3.5 mr-1" /> Merge duplicates
                </Button>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No guests yet. Add one above — they'll be available in every future
            round robin.
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((g) => {
              const initials = g.display_name
                .split(" ")
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const isSelected = selectedIds.includes(g.id);
              const isDup = duplicateNames.has(g.display_name.trim().toLowerCase());
              return (
                <Card
                  key={g.id}
                  className={`p-3 flex items-center gap-3 transition-colors ${
                    mergeMode && isSelected ? "border-primary ring-1 ring-primary" : ""
                  }`}
                  onClick={mergeMode ? () => toggleSelected(g.id) : undefined}
                  role={mergeMode ? "button" : undefined}
                >
                  {mergeMode && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelected(g.id)}
                      aria-label={`Select ${g.display_name}`}
                    />
                  )}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{g.display_name}</p>
                      {g.linked_user_id ? (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Link2 className="h-3 w-3" /> Linked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Guest
                        </Badge>
                      )}
                      {isDup && !mergeMode && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400"
                        >
                          Possible duplicate
                        </Badge>
                      )}
                    </div>
                    {g.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {g.email}
                      </p>
                    )}
                  </div>
                  {!mergeMode && (
                    <>
                      {!g.linked_user_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInviteGuest(g)}
                        >
                          <Send className="h-3 w-3 mr-1" /> Invite
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeGuest(g)}
                        aria-label="Remove guest"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {inviteGuest && (
        <GuestInviteDialog
          open={!!inviteGuest}
          onOpenChange={(o) => !o && setInviteGuest(null)}
          guestPlayerId={inviteGuest.id}
          guestDisplayName={inviteGuest.display_name}
          defaultEmail={inviteGuest.email}
        />
      )}

      <AlertDialog
        open={!!mergeConfirm}
        onOpenChange={(o) => !o && setMergeConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge guests?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Keep{" "}
                  <span className="font-semibold text-foreground">
                    {mergeConfirm?.keep.display_name}
                  </span>{" "}
                  and remove{" "}
                  <span className="font-semibold text-foreground">
                    {mergeConfirm?.remove.display_name}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Every round robin where{" "}
                  <span className="font-medium">
                    {mergeConfirm?.remove.display_name}
                  </span>{" "}
                  appeared will be rewritten to use{" "}
                  <span className="font-medium">
                    {mergeConfirm?.keep.display_name}
                  </span>
                  . This can't be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge} disabled={merging}>
              {merging ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Merge"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
