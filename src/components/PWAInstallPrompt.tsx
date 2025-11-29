import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, Bell, X, Share2, Plus } from 'lucide-react';
import pulseLogo from '@/assets/pulse-logo-new.png';

export const PWAInstallPrompt = () => {
  const { isStandalone, isMobile, isIOS, canInstall, promptInstall } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone) {
      localStorage.setItem('pulse_pwa_installed', 'true');
      return;
    }

    // Don't show on desktop
    if (!isMobile) return;

    // Check if permanently dismissed
    if (localStorage.getItem('pulse_pwa_dismissed_permanent') === 'true') return;

    // Check if user already installed
    if (localStorage.getItem('pulse_pwa_installed') === 'true') return;

    // Check if we should remind later
    const remindAfter = localStorage.getItem('pulse_pwa_remind_after');
    if (remindAfter && Date.now() < parseInt(remindAfter)) return;

    // Show prompt after a short delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isStandalone, isMobile]);

  const handleInstallNow = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      const success = await promptInstall();
      if (success) {
        setShowPrompt(false);
      }
    }
  };

  const handleRemindLater = () => {
    const remindTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    localStorage.setItem('pulse_pwa_remind_after', remindTime.toString());
    setShowPrompt(false);
  };

  const handleNoThanks = () => {
    localStorage.setItem('pulse_pwa_dismissed_permanent', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || !canInstall) return null;

  return (
    <>
      {/* Main Install Prompt - Mobile Sheet */}
      <Sheet open={showPrompt} onOpenChange={setShowPrompt}>
        <SheetContent 
          side="bottom" 
          className="rounded-t-3xl border-t-2 px-6 py-8"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            {/* Branded Header Strip */}
            <div className="bg-secondary -mx-6 -mt-8 px-6 pt-8 pb-6 mb-6 rounded-t-3xl flex flex-col items-center w-[calc(100%+3rem)]">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg bg-white/10 p-2">
                <img src={pulseLogo} alt="PULSE Logo" className="w-full h-full object-contain" />
              </div>
              <SheetTitle className="text-2xl font-bold text-secondary-foreground mt-4">
                📱 Get the PULSE App
              </SheetTitle>
            </div>

            {/* Description */}
            <SheetDescription className="text-base mb-6">
              Install PULSE on your home screen for quick access, offline use, and the best experience.
            </SheetDescription>

            {/* Actions */}
            <div className="flex flex-col w-full space-y-3">
              {/* Install Now */}
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold"
                onClick={handleInstallNow}
              >
                <Download className="w-5 h-5 mr-2" />
                Install Now
              </Button>

              {/* Remind Me Later */}
              <Button
                size="lg"
                variant="outline"
                className="w-full h-12 text-base font-semibold"
                onClick={handleRemindLater}
              >
                <Bell className="w-5 h-5 mr-2" />
                Remind Me Later
              </Button>

              {/* No Thanks */}
              <button
                onClick={handleNoThanks}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                No Thanks
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* iOS Installation Instructions Dialog */}
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl">How to Install on iPhone</DialogTitle>
            <DialogDescription className="text-left space-y-4 text-base">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">Tap the Share button</p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Share2 className="w-5 h-5" />
                    <span className="text-sm">(at the bottom of Safari)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">Scroll down and tap</p>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg mt-2">
                    <Plus className="w-5 h-5" />
                    <span className="font-semibold">"Add to Home Screen"</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Tap <strong>"Add"</strong> in the top right</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <Button
            size="lg"
            className="w-full mt-4"
            onClick={() => {
              setShowIOSInstructions(false);
              setShowPrompt(false);
              localStorage.setItem('pulse_pwa_installed', 'true');
            }}
          >
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
