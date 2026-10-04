import { useEffect, useRef, useState } from "react";
import { Key, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (code: string) => Promise<unknown>;
}

export function JoinGroupDialog({
  open,
  onOpenChange,
  onJoin,
}: JoinGroupDialogProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const currentGeneration = generation;
    currentGeneration.current++;
    busy.current = false;
    setLoading(false);
    setError("");
    setCode("");
    return () => {
      currentGeneration.current++;
    };
  }, [open]);

  const handleJoin = async () => {
    if (!code.trim() || busy.current) return;
    busy.current = true;
    const request = generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await onJoin(code.trim());
      if (request !== generation.current) return;
      if (result) {
        onOpenChange(false);
        setCode("");
      } else
        setError("We could not join this group. Check the code and try again.");
    } catch {
      if (request === generation.current)
        setError("We could not connect. Please try again.");
    } finally {
      if (request === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Guard on `loading` too — the submit button is already disabled
    // while loading, but holding Enter (or hitting it twice fast on a
    // slow network) would otherwise re-fire the RPC.
    if (e.key === "Enter" && code.trim() && !loading) {
      e.preventDefault();
      void handleJoin();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Join a group
          </DialogTitle>
          <DialogDescription>
            Enter the group code to join. Codes are case-insensitive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="code">Group code</Label>
            <Input
              id="code"
              placeholder="e.g. YMCA-7K2P"
              value={code}
              disabled={loading}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              className="text-center text-lg tracking-wider font-mono"
              maxLength={20}
              autoFocus
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleJoin}
              disabled={!code.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join group"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
