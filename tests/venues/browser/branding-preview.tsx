import { useState } from "react";
import { VenueTheme } from "@/components/venue/VenueTheme";
import { CommunityBrandMark } from "@/components/community/CommunityBrandMark";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function BrandingPreview() {
  const [small, setSmall] = useState(false);
  const [second, setSecond] = useState(false);
  const brand = second
    ? { primary_color: "#7722aa", secondary_color: "#332244" }
    : { primary_color: "#166f63", secondary_color: "#143c37" };
  return (
    <VenueTheme brand={brand}>
      <main className="min-h-screen space-y-6 p-6">
        <h1>Local venue menu checks</h1>
        <Button onClick={() => setSecond((s) => !s)}>Switch venue</Button>
        <Button onClick={() => setSmall((s) => !s)}>Toggle small menus</Button>
        <p>{second ? "Purple venue" : "Green venue"}</p>
        <CommunityBrandMark
          group={{ name: "Broken Logo Test", icon_url: "/missing-logo-qa.png" }}
          className="h-16 w-16 text-[64px]"
        />
        <div className="flex flex-wrap gap-4">
          <TooltipProvider>
            <Tooltip open={small}>
              <TooltipTrigger asChild>
                <Button variant="outline">Venue hint</Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="text-primary">Venue hint colors</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <HoverCard open={small} openDelay={0}>
            <HoverCardTrigger asChild>
              <Button variant="outline">Venue information</Button>
            </HoverCardTrigger>
            <HoverCardContent>
              <p className="text-primary">Venue information colors</p>
            </HoverCardContent>
          </HoverCard>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Venue menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem className="text-primary">
                Venue action
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Venue dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Venue settings</DialogTitle>
              <DialogDescription>
                Local test of venue branding.
              </DialogDescription>
              <Button>Save venue settings</Button>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </VenueTheme>
  );
}
