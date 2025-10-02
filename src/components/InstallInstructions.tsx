import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Download } from "lucide-react";

const InstallInstructions = () => {
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
              <ol className="space-y-3 text-sm">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Smartphone className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Android</CardTitle>
              <CardDescription>Install on Android devices</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default InstallInstructions;
