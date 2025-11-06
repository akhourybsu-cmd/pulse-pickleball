import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const InstallInstructions = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Detect Android
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    // Capture the install prompt event (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast({
        title: "Already Installed",
        description: "PULSE is already installed or your browser doesn't support installation.",
      });
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: "Success!",
        description: "PULSE has been installed to your home screen.",
      });
    }
    
    setDeferredPrompt(null);
  };

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <Download className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="text-3xl font-bold mb-3">Install PULSE on Your Device</h3>
          <p className="text-muted-foreground">
            Add PULSE to your home screen for quick access and an app-like experience
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Smartphone className="w-8 h-8 text-primary mb-2" />
              <CardTitle>iPhone / iPad (iOS)</CardTitle>
              <CardDescription>Install on Apple devices</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm mb-4">
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">1.</span>
                  <span>Open this website in <strong>Safari</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">2.</span>
                  <span>Tap the <strong>Share</strong> button (square with arrow up) at the bottom</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">3.</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">4.</span>
                  <span>Tap <strong>"Add"</strong> in the top right corner</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">5.</span>
                  <span>The PULSE app will appear on your home screen!</span>
                </li>
              </ol>
              {isIOS && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  Note: iOS requires manual installation through Safari's Share menu.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Smartphone className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Android</CardTitle>
              <CardDescription>Install on Android devices</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm mb-4">
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">1.</span>
                  <span>Open this website in <strong>Chrome</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">2.</span>
                  <span>Tap the <strong>three dots menu</strong> (⋮) in the top right</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">3.</span>
                  <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">4.</span>
                  <span>Tap <strong>"Install"</strong> in the popup</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold min-w-6">5.</span>
                  <span>The PULSE app will appear on your home screen!</span>
                </li>
              </ol>
              {(isAndroid || deferredPrompt) && (
                <Button onClick={handleInstallClick} className="w-full" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Install Now
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default InstallInstructions;
