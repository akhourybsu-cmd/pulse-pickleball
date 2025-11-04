import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download } from "lucide-react";

interface SessionQRCodeProps {
  joinUrl: string;
  sessionName: string;
}

export function SessionQRCode({ joinUrl, sessionName }: SessionQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.download = `session-qr-${sessionName.replace(/\s+/g, '-').toLowerCase()}.svg`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          Join via QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={qrRef} className="bg-white p-4 rounded-lg inline-block">
          <QRCodeSVG 
            value={joinUrl} 
            size={200}
            level="H"
            includeMargin
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Scan to join this session queue
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={downloadQR}
        >
          <Download className="w-4 h-4 mr-2" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
}
