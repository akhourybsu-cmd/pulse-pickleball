import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Edit2, Layers, Sparkles, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PurchaseDivisionDialog } from "./PurchaseDivisionDialog";

interface Division {
  id: string;
  name: string;
  format: string | null;
  skill_level?: string | null;
  team_count?: number;
}

interface DivisionManagerProps {
  divisions: Division[];
  paidDivisionsCount: number;
  tournamentId: string;
  onAddDivision: (division: { name: string; skill_level: string | null; format: string | null }) => Promise<boolean>;
  onUpdateDivision: (id: string, updates: Partial<Division>) => Promise<boolean>;
  onDeleteDivision: (id: string) => Promise<boolean>;
  onRefresh: () => void;
}

const SKILL_LEVELS = [
  { value: "2.0-2.5", label: "2.0 - 2.5 (Beginner)" },
  { value: "3.0-3.5", label: "3.0 - 3.5 (Intermediate)" },
  { value: "4.0-4.5", label: "4.0 - 4.5 (Advanced)" },
  { value: "5.0+", label: "5.0+ (Pro)" },
  { value: "open", label: "Open (All Levels)" },
];

const FORMATS = [
  { value: "round_robin", label: "Round Robin" },
  { value: "single_elimination", label: "Single Elimination" },
  { value: "double_elimination", label: "Double Elimination" },
];

const GAME_TYPES = [
  { value: "singles", label: "Singles" },
  { value: "doubles", label: "Doubles" },
  { value: "mixed", label: "Mixed Doubles" },
];

export function DivisionManager({
  divisions,
  paidDivisionsCount,
  tournamentId,
  onAddDivision,
  onUpdateDivision,
  onDeleteDivision,
  onRefresh,
}: DivisionManagerProps) {
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    skill_level: "",
    format: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDivisionClick = (divisionId: string) => {
    navigate(`/tournaments/${tournamentId}/divisions/${divisionId}`);
  };

  const currentCount = divisions.length;
  const isAtLimit = currentCount >= paidDivisionsCount;
  const progressPercentage = Math.min((currentCount / paidDivisionsCount) * 100, 100);

  const resetForm = () => {
    setFormData({ name: "", skill_level: "", format: "" });
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    if (isAtLimit) {
      setIsPurchaseOpen(true);
    } else {
      resetForm();
      setIsSheetOpen(true);
    }
  };

  const handleOpenEdit = (division: Division) => {
    setFormData({
      name: division.name,
      skill_level: division.skill_level || "",
      format: division.format || "",
    });
    setEditingId(division.id);
    setIsSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await onUpdateDivision(editingId, {
          name: formData.name,
          skill_level: formData.skill_level || null,
          format: formData.format || null,
        });
      } else {
        await onAddDivision({
          name: formData.name,
          skill_level: formData.skill_level || null,
          format: formData.format || null,
        });
      }
      setIsSheetOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurchaseSuccess = () => {
    onRefresh();
    // Open the add division sheet after purchase
    setTimeout(() => {
      resetForm();
      setIsSheetOpen(true);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Header with capacity indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(169,207,70,0.2)]">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Divisions</h3>
            <p className="text-sm text-muted-foreground">
              {currentCount} of {paidDivisionsCount} included
            </p>
          </div>
        </div>
        
        {isAtLimit ? (
          <Button 
            onClick={handleOpenAdd} 
            size="sm" 
            variant="outline"
            className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-4 w-4" />
            Purchase Division Slot
          </Button>
        ) : (
          <Button 
            onClick={handleOpenAdd} 
            size="sm" 
            className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Division
          </Button>
        )}
      </div>

      {/* Capacity Progress Bar */}
      <div className="space-y-2">
        <Progress value={progressPercentage} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{currentCount} division{currentCount !== 1 ? "s" : ""} used</span>
          <span>{Math.max(0, paidDivisionsCount - currentCount)} slot{paidDivisionsCount - currentCount !== 1 ? "s" : ""} remaining</span>
        </div>
      </div>

      {/* Division Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {divisions.map((division, index) => (
            <motion.div
              key={division.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -2 }}
              className="bg-gradient-to-br from-card to-muted/30 border border-border/50 rounded-xl p-4 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
              onClick={() => handleDivisionClick(division.id)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{division.name}</h4>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {division.skill_level && (
                      <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md text-xs">
                        {SKILL_LEVELS.find(s => s.value === division.skill_level)?.label || division.skill_level}
                      </span>
                    )}
                    {division.format && (
                      <span className="bg-muted/70 border border-border/50 px-2 py-0.5 rounded-md capitalize text-muted-foreground text-xs">
                        {division.format}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{division.team_count ?? 0} team{(division.team_count ?? 0) !== 1 ? 's' : ''} registered</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(division);
                    }}
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDivision(division.id);
                    }}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {divisions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-full text-center py-12 bg-gradient-to-br from-card/50 to-muted/20 rounded-xl border border-dashed border-border/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(169,207,70,0.15)]">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <p className="text-muted-foreground mb-4">No divisions yet. Add your first division to get started.</p>
            <Button onClick={handleOpenAdd} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Division
            </Button>
          </motion.div>
        )}
      </div>

      {/* Add/Edit Division Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {editingId ? "Edit Division" : "Add Division"}
            </SheetTitle>
            <SheetDescription>
              {editingId
                ? "Update the division details below."
                : "Create a new division for your tournament."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="division-name" className="text-sm font-medium">Division Name *</Label>
              <Input
                id="division-name"
                placeholder="e.g., Men's Doubles 3.5"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-level" className="text-sm font-medium">Skill Level</Label>
              <Select
                value={formData.skill_level}
                onValueChange={(value) => setFormData({ ...formData, skill_level: value })}
              >
                <SelectTrigger id="skill-level" className="h-12">
                  <SelectValue placeholder="Select skill level" />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format" className="text-sm font-medium">Format</Label>
              <Select
                value={formData.format}
                onValueChange={(value) => setFormData({ ...formData, format: value })}
              >
                <SelectTrigger id="format" className="h-12">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                onClick={handleSubmit}
                disabled={!formData.name.trim() || isSubmitting}
              >
                {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Add Division"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Purchase Division Dialog */}
      <PurchaseDivisionDialog
        open={isPurchaseOpen}
        onOpenChange={setIsPurchaseOpen}
        tournamentId={tournamentId}
        currentCount={currentCount}
        paidCount={paidDivisionsCount}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}