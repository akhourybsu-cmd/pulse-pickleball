import { useState } from "react";
import { UserPlus, Hash, Plus, Minus, Users, Pencil, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { PlayerPickerSheet } from "@/components/round-robin/PlayerPickerSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  gender?: string | null;
  isGuest?: boolean;
  avatar_url?: string | null;
}

interface PlayersStepProps {
  eventMode: "immediate" | "open_registration";
  selectedPlayers: Profile[];
  onPlayersChange: (players: Profile[]) => void;
  playerCount: number;
  onPlayerCountChange: (count: number) => void;
  inputMethod: "add" | "count" | null;
  onInputMethodChange: (method: "add" | "count") => void;
  format: "open" | "mixed" | "male" | "female";
  maxPlayers: number;
  onMaxPlayersChange: (count: number) => void;
  groupId?: string | null;
  allowGuests?: boolean;
  onAllowGuestsChange?: (value: boolean) => void;
  onRatingEligibleChange?: (value: boolean) => void;
}

export function PlayersStep({
  eventMode,
  selectedPlayers,
  onPlayersChange,
  playerCount,
  onPlayerCountChange,
  inputMethod,
  onInputMethodChange,
  format,
  maxPlayers,
  onMaxPlayersChange,
  groupId,
  allowGuests,
  onAllowGuestsChange,
  onRatingEligibleChange,
}: PlayersStepProps) {
  // For future events, just show max players input
  if (eventMode === "open_registration") {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-2">Expected Players</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Set the maximum number of players
        </p>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => onMaxPlayersChange(Math.max(4, maxPlayers - 1))}
              disabled={maxPlayers <= 4}
            >
              <Minus className="h-6 w-6" />
            </Button>
            <span className="text-5xl font-bold tabular-nums w-20 text-center">
              {maxPlayers}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => onMaxPlayersChange(Math.min(100, maxPlayers + 1))}
              disabled={maxPlayers >= 100}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-4">Maximum players</p>
          {maxPlayers % 4 !== 0 && (
            <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">
              Tip: {maxPlayers - (maxPlayers % 4) + 4} players would fill all courts evenly
            </p>
          )}
        </div>
      </div>
    );
  }

  // Immediate mode - allow adding players or entering count
  if (!inputMethod) {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-2">How many players?</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Choose how to add players
        </p>

        <div className="flex-1 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => onInputMethodChange("add")}
            className="flex items-start gap-4 p-5 rounded-xl border-2 border-border hover:border-primary/50 text-left transition-all"
          >
            <div className="p-3 rounded-lg bg-muted">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Add players now</p>
              <p className="text-sm text-muted-foreground mt-1">
                Select players from your roster
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onInputMethodChange("count")}
            className="flex items-start gap-4 p-5 rounded-xl border-2 border-border hover:border-primary/50 text-left transition-all"
          >
            <div className="p-3 rounded-lg bg-muted">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Enter player count</p>
              <p className="text-sm text-muted-foreground mt-1">
                Just specify how many will play
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (inputMethod === "count") {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-2">How many players?</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Minimum 4 players required
        </p>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => onPlayerCountChange(Math.max(4, playerCount - 1))}
              disabled={playerCount <= 4}
            >
              <Minus className="h-6 w-6" />
            </Button>
            <span className="text-5xl font-bold tabular-nums w-20 text-center">
              {playerCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => onPlayerCountChange(Math.min(100, playerCount + 1))}
              disabled={playerCount >= 100}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-4">Players</p>
          {playerCount % 4 !== 0 && (
            <p className="text-amber-600 dark:text-amber-400 text-xs mt-2">
              Tip: {playerCount - (playerCount % 4) + 4} players would fill all courts evenly
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onInputMethodChange("add")}
          className="text-sm text-primary underline-offset-4 hover:underline mt-4"
        >
          Or add players from roster instead
        </button>
      </div>
    );
  }

  // Add players mode — new picker sheet
  const initials = (p: Profile) => {
    const name = p.display_name || p.full_name || "?";
    return name
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Add Players</h2>
      <p className="text-muted-foreground text-sm mb-4">
        {selectedPlayers.length} selected (minimum 4)
      </p>

      <div className="flex-1 space-y-4">
        <PlayerPickerSheet
          selectedPlayers={selectedPlayers}
          onPlayersChange={onPlayersChange}
          genderFilter={format === "male" ? "male" : format === "female" ? "female" : undefined}
          groupId={groupId}
          allowGuest={allowGuests}
          trigger={
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">
                    {selectedPlayers.length === 0 ? "Add players" : "Edit players"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Friends, group members, recent, search, or guests
                  </p>
                </div>
              </div>
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          }
        />

        {selectedPlayers.length > 0 && (
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {selectedPlayers.length} player{selectedPlayers.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedPlayers.slice(0, 12).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-xs"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={p.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px]">{initials(p)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate max-w-[100px]">
                    {p.display_name || p.full_name}
                  </span>
                  {p.isGuest && (
                    <span className="text-[9px] uppercase opacity-60">guest</span>
                  )}
                </div>
              ))}
              {selectedPlayers.length > 12 && (
                <div className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                  +{selectedPlayers.length - 12}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedPlayers.length < 4 && (
        <p className="text-amber-600 dark:text-amber-400 text-xs mt-4">
          Add at least {4 - selectedPlayers.length} more {4 - selectedPlayers.length === 1 ? "player" : "players"}
        </p>
      )}

      <button
        type="button"
        onClick={() => onInputMethodChange("count")}
        className="text-sm text-primary underline-offset-4 hover:underline mt-4"
      >
        Or just enter a player count instead
      </button>
    </div>
  );
}
