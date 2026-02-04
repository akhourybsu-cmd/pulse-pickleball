import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PurchaseDivisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  currentCount: number;
  paidCount: number;
  onSuccess: () => void;
}

export function PurchaseDivisionDialog({
  open,
  onOpenChange,
  tournamentId,
  currentCount,
  paidCount,
  onSuccess,
}: PurchaseDivisionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("purchase-division-slot", {
        body: { tournament_id: tournamentId },
      });

      if (response.error || response.data?.error) {
        const errorMessage = response.error?.message || response.data?.error || "Could not start payment process";
        throw new Error(errorMessage);
      }

      // Handle free access (no redirect needed)
      if (response.data?.free && response.data?.success) {
        toast({
          title: "Division slot added!",
          description: "You can now add another division.",
        });
        onOpenChange(false);
        onSuccess();
        setLoading(false);
        return;
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error: any) {
      toast({
        title: "Payment error",
        description: error.message || "Could not start payment process",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-2 shadow-[0_0_20px_rgba(169,207,70,0.2)]">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Add More Divisions</DialogTitle>
          <DialogDescription className="text-center">
            You've used all your included division slots
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current usage */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 border border-border/50 rounded-xl p-4 text-center"
          >
            <p className="text-sm text-muted-foreground">Current usage</p>
            <p className="text-2xl font-bold mt-1">
              <span className="text-primary">{currentCount}</span>
              <span className="text-muted-foreground"> / {paidCount}</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">divisions</span>
            </p>
          </motion.div>

          {/* Price breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative group"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-accent/30 rounded-xl blur opacity-50" />
            <div className="relative bg-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Additional Division Slot</p>
                    <p className="text-sm text-muted-foreground">Add one more division</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-primary">$9</p>
              </div>
            </div>
          </motion.div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2"
              onClick={handlePurchase}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Purchase & Add
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You'll be redirected to checkout to complete your purchase
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}