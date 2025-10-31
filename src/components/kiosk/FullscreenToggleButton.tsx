import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize } from "lucide-react";

export function FullscreenToggleButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  if (isFullscreen) {
    return (
      <Button
        onClick={toggleFullscreen}
        variant="ghost"
        size="sm"
        className="fixed top-4 right-20 z-50 bg-background/50 backdrop-blur"
      >
        <Minimize className="w-4 h-4 mr-2" />
        Exit Fullscreen
      </Button>
    );
  }

  return (
    <Button
      onClick={toggleFullscreen}
      variant="outline"
      size="sm"
      className="bg-background/50 backdrop-blur"
    >
      <Maximize className="w-4 h-4 mr-2" />
      Go Fullscreen
    </Button>
  );
}
