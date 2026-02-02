import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Share2, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

interface TournamentPublicHeaderProps {
  tournamentName: string;
  onShare: () => void;
}

export function TournamentPublicHeader({ tournamentName, onShare }: TournamentPublicHeaderProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 h-12 transition-all duration-300 ${
        scrolled 
          ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm" 
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto h-full px-4 flex items-center justify-between">
        {/* Logo - links to tournaments browse */}
        <button
          onClick={() => navigate("/tournaments")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className={`font-bold text-lg tracking-tight ${
            scrolled ? "text-foreground" : "text-white drop-shadow-md"
          }`}>
            PULSE
          </span>
        </button>

        {/* Tournament name - only visible when scrolled */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: scrolled ? 1 : 0 }}
          className="hidden md:block text-sm font-medium text-foreground truncate max-w-[300px]"
        >
          {tournamentName}
        </motion.span>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            className={`${
              scrolled 
                ? "text-foreground hover:bg-muted" 
                : "text-white hover:bg-white/20"
            }`}
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Share</span>
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`h-8 w-8 ${
              scrolled 
                ? "text-foreground hover:bg-muted" 
                : "text-white hover:bg-white/20"
            }`}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
