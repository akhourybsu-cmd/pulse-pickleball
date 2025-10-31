import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface OrganizerPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  correctPin: string;
}

export function OrganizerPinModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Organizer PIN Required",
  description = "Enter 4-digit PIN to continue",
  correctPin,
}: OrganizerPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 4) {
        setTimeout(() => verifyPin(newPin), 100);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const verifyPin = (pinToVerify: string) => {
    if (pinToVerify === correctPin) {
      setPin("");
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin("");
      }, 500);
    }
  };

  const handleClose = () => {
    setPin("");
    setError(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-lg">{description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* PIN Display */}
          <div className={`flex justify-center gap-3 ${shake ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center text-3xl font-bold transition-all ${
                  error
                    ? 'border-destructive bg-destructive/10'
                    : pin.length > i
                    ? 'border-primary bg-primary/10'
                    : 'border-muted-foreground/30'
                }`}
              >
                {pin.length > i && '•'}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-center text-destructive text-sm font-medium">
              Incorrect PIN. Please try again.
            </p>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <Button
                key={num}
                onClick={() => handleNumberClick(num)}
                variant="outline"
                size="lg"
                className="h-16 text-2xl font-bold hover:bg-primary hover:text-primary-foreground"
              >
                {num}
              </Button>
            ))}
            <Button
              onClick={handleBackspace}
              variant="outline"
              size="lg"
              className="h-16 text-xl hover:bg-destructive/10"
            >
              <X className="w-6 h-6" />
            </Button>
            <Button
              onClick={() => handleNumberClick('0')}
              variant="outline"
              size="lg"
              className="h-16 text-2xl font-bold hover:bg-primary hover:text-primary-foreground"
            >
              0
            </Button>
            <div /> {/* Empty space */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Shake animation keyframes - add to index.css if not present
