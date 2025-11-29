import { useState, useEffect, useMemo } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect if running as installed PWA
  const isStandalone = useMemo(() => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }, []);

  // Detect device type
  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), []);
  const isAndroid = useMemo(() => /Android/.test(navigator.userAgent), []);
  const isMobile = useMemo(() => isIOS || isAndroid, [isIOS, isAndroid]);

  // Capture beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (isStandalone) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone]);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('pulse_pwa_installed', 'true');
        return true;
      }
      
      setDeferredPrompt(null);
      return false;
    } catch (error) {
      console.error('Error prompting PWA install:', error);
      return false;
    }
  };

  return {
    deferredPrompt,
    isInstalled,
    isStandalone,
    isIOS,
    isAndroid,
    isMobile,
    canInstall: !!deferredPrompt || isIOS,
    promptInstall,
  };
};
