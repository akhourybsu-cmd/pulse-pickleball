import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  full_name: string;
  display_name: string | null;
  current_rating: number;
}

interface PlayerSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  excludePlayerIds?: string[];
}

export function PlayerSelector({
  value,
  onValueChange,
  placeholder = "Search player...",
  excludePlayerIds = [],
}: PlayerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      fetchPlayers();
    } else {
      setPlayers([]);
    }
  }, [searchQuery]);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, current_rating")
        .or(`full_name.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .not("id", "in", `(${excludePlayerIds.length > 0 ? excludePlayerIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
        .limit(20);

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error("Error fetching players:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedPlayer = players.find((player) => player.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedPlayer ? (
            <span>
              {selectedPlayer.display_name || selectedPlayer.full_name} ({(selectedPlayer.current_rating ?? 3.00).toFixed(2)})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={placeholder} 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching..." : searchQuery.trim().length < 2 ? "Type at least 2 characters to search..." : "No player found."}
            </CommandEmpty>
            <CommandGroup>
              {players.map((player) => (
                <CommandItem
                  key={player.id}
                  value={player.id}
                  onSelect={() => {
                    onValueChange(player.id);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === player.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {player.display_name || player.full_name} ({(player.current_rating ?? 3.00).toFixed(2)})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
