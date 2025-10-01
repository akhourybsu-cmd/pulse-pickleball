import { useState } from "react";
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

interface Player {
  id: string;
  full_name: string;
  current_rating: number;
}

interface PlayerComboboxProps {
  players: Player[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function PlayerCombobox({
  players,
  value,
  onValueChange,
  placeholder = "Search player...",
}: PlayerComboboxProps) {
  const [open, setOpen] = useState(false);

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
              {selectedPlayer.full_name} ({(selectedPlayer.current_rating ?? 3.00).toFixed(2)})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No player found.</CommandEmpty>
            <CommandGroup>
              {players.map((player) => (
                <CommandItem
                  key={player.id}
                  value={`${player.full_name} ${player.current_rating ?? 3.00}`}
                  onSelect={() => {
                    onValueChange(player.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === player.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {player.full_name} ({(player.current_rating ?? 3.00).toFixed(2)})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
