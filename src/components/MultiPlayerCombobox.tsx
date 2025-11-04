import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  full_name: string;
  display_name: string | null;
  gender?: string | null;
}

interface MultiPlayerComboboxProps {
  selectedPlayers: Player[];
  onPlayersChange: (players: Player[]) => void;
  genderFilter?: "male" | "female";
}

export function MultiPlayerCombobox({
  selectedPlayers,
  onPlayersChange,
  genderFilter,
}: MultiPlayerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  useEffect(() => {
    fetchPlayers();
  }, [genderFilter]);

  const fetchPlayers = async () => {
    let queryBuilder = supabase
      .from("profiles")
      .select("id, full_name, display_name, gender")
      .order("full_name");

    // Apply gender filter if provided
    if (genderFilter) {
      queryBuilder = queryBuilder.eq("gender", genderFilter);
    }

    const { data } = await queryBuilder;
    
    if (data) {
      // Filter out players without gender if gender filter is active
      const filteredData = genderFilter 
        ? data.filter(p => p.gender === genderFilter)
        : data;
      setAllPlayers(filteredData);
    }
  };

  const filteredPlayers = searchQuery.trim() === ""
    ? []
    : allPlayers.filter((player) => {
        const displayName = player.display_name || player.full_name;
        const isAlreadySelected = selectedPlayers.some(p => p.id === player.id);
        return !isAlreadySelected && displayName.toLowerCase().includes(searchQuery.toLowerCase());
      });

  const handleSelect = (player: Player) => {
    onPlayersChange([...selectedPlayers, player]);
    setSearchQuery("");
  };

  const handleRemove = (playerId: string) => {
    onPlayersChange(selectedPlayers.filter(p => p.id !== playerId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="text-muted-foreground">Add players...</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search players..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {searchQuery.trim() === "" ? "Type to search for players..." : "No player found."}
              </CommandEmpty>
              <CommandGroup>
                {filteredPlayers.map((player) => (
                  <CommandItem
                    key={player.id}
                    value={player.id}
                    onSelect={() => {
                      handleSelect(player);
                      setOpen(false);
                    }}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    {player.display_name || player.full_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedPlayers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedPlayers.map((player) => (
            <Badge key={player.id} variant="secondary" className="px-2 py-1">
              {player.display_name || player.full_name}
              <button
                onClick={() => handleRemove(player.id)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
