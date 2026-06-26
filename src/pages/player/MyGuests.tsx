import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, UserPlus, Search, Send, Link2, Trash2 } from "lucide-react";
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
    return guests.filter((g) =>
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

  return (
    <div className="min-h-screen bg-background">
      <PageSEO title="Guest Roster | PULSE" description="Manage your reusable guest players for round robins." />
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
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
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

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No guests yet. Add one above — they'll be available in every future round robin.
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
              return (
                <Card key={g.id} className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{g.display_name}</p>
                      {g.linked_user_id ? (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Link2 className="h-3 w-3" /> Linked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Guest</Badge>
                      )}
                    </div>
                    {g.email && (
                      <p className="text-xs text-muted-foreground truncate">{g.email}</p>
                    )}
                  </div>
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
    </div>
  );
}
