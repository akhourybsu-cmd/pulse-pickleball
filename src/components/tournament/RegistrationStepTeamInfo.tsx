import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegistrationFormData {
  teamName: string;
  hasPartner: boolean;
  partnerId: string | null;
}

interface RegistrationStepTeamInfoProps {
  formData: RegistrationFormData;
  onUpdate: (updates: Partial<RegistrationFormData>) => void;
}

export function RegistrationStepTeamInfo({
  formData,
  onUpdate,
}: RegistrationStepTeamInfoProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCurrentUser();
    fetchPlayers();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, current_rating")
      .order("display_name");
    setPlayers(data || []);
  };

  const selectedPartner = players.find((p) => p.id === formData.partnerId);
  const filteredPlayers = searchQuery.trim() === ""
    ? []
    : players.filter((player) => {
        if (currentUser && player.id === currentUser.id) return false;
        const displayName = player.display_name || player.full_name;
        return displayName.toLowerCase().includes(searchQuery.toLowerCase());
      });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Team Information</h3>
        <p className="text-sm text-muted-foreground">
          Provide details about your team
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="teamName">Team Name</Label>
          <Input
            id="teamName"
            placeholder="Enter your team name"
            value={formData.teamName}
            onChange={(e) => onUpdate({ teamName: e.target.value })}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            This will be displayed on brackets and scoreboards
          </p>
        </div>

        <div>
          <Label className="mb-3 block">Do you have a partner?</Label>
          <RadioGroup
            value={formData.hasPartner ? "yes" : "no"}
            onValueChange={(value) => {
              const hasPartner = value === "yes";
              onUpdate({ 
                hasPartner,
                partnerId: hasPartner ? formData.partnerId : null
              });
            }}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="has-partner-yes" />
              <Label htmlFor="has-partner-yes" className="cursor-pointer font-normal">
                Yes, my partner will play with me
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="has-partner-no" />
              <Label htmlFor="has-partner-no" className="cursor-pointer font-normal">
                I need a partner (will be assigned later)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {formData.hasPartner && (
          <div>
            <Label>Select Partner</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between mt-1.5"
                >
                  {selectedPartner
                    ? selectedPartner.display_name || selectedPartner.full_name
                    : "Search for your partner..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search player by name..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No player found.</CommandEmpty>
                    <CommandGroup>
                      {filteredPlayers.slice(0, 10).map((player) => (
                        <CommandItem
                          key={player.id}
                          value={player.id}
                          onSelect={() => {
                            onUpdate({ partnerId: player.id });
                            setOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.partnerId === player.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{player.display_name || player.full_name}</span>
                            <span className="text-xs text-muted-foreground">
                              Rating: {player.current_rating.toFixed(2)}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              Your partner must have a PULSE account
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
