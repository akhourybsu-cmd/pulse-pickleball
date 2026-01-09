import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { TournamentDivision } from "@/hooks/useTournaments";

interface DivisionCardEditorProps {
  divisions: TournamentDivision[];
  onAdd: (division: { name: string; skill_level: string | null; format: string | null }) => Promise<boolean>;
  onUpdate: (id: string, updates: Partial<TournamentDivision>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const SKILL_LEVELS = [
  { value: "2.0-2.5", label: "2.0 - 2.5 (Beginner)" },
  { value: "3.0-3.5", label: "3.0 - 3.5 (Intermediate)" },
  { value: "4.0-4.5", label: "4.0 - 4.5 (Advanced)" },
  { value: "5.0+", label: "5.0+ (Pro)" },
  { value: "open", label: "Open (All Levels)" },
];

const FORMATS = [
  { value: "singles", label: "Singles" },
  { value: "doubles", label: "Doubles" },
  { value: "mixed", label: "Mixed Doubles" },
];

export function DivisionCardEditor({
  divisions,
  onAdd,
  onUpdate,
  onDelete,
}: DivisionCardEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    skill_level: "",
    format: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({ name: "", skill_level: "", format: "" });
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleOpenEdit = (division: TournamentDivision) => {
    setFormData({
      name: division.name,
      skill_level: division.skill_level || "",
      format: division.format || "",
    });
    setEditingId(division.id);
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await onUpdate(editingId, {
          name: formData.name,
          skill_level: formData.skill_level || null,
          format: formData.format || null,
        });
      } else {
        await onAdd({
          name: formData.name,
          skill_level: formData.skill_level || null,
          format: formData.format || null,
        });
      }
      setIsOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Divisions</h3>
          <p className="text-sm text-muted-foreground">
            Total divisions: {divisions.length}
          </p>
        </div>
        <Button onClick={handleOpenAdd} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Division
        </Button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {divisions.map((division, index) => (
            <motion.div
              key={division.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card/50 border border-border/50 rounded-lg p-4 flex items-center justify-between group hover:border-primary/30 transition-colors"
            >
              <div className="space-y-1">
                <h4 className="font-medium">{division.name}</h4>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  {division.skill_level && (
                    <span className="bg-muted px-2 py-0.5 rounded">
                      {SKILL_LEVELS.find(s => s.value === division.skill_level)?.label || division.skill_level}
                    </span>
                  )}
                  {division.format && (
                    <span className="bg-muted px-2 py-0.5 rounded capitalize">
                      {division.format}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenEdit(division)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(division.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {divisions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No divisions yet. Add your first division to get started.</p>
          </div>
        )}
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Division" : "Add Division"}</SheetTitle>
            <SheetDescription>
              {editingId
                ? "Update the division details below."
                : "Create a new division for your tournament."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="division-name">Division Name *</Label>
              <Input
                id="division-name"
                placeholder="e.g., Men's Doubles 3.5"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-level">Skill Level</Label>
              <Select
                value={formData.skill_level}
                onValueChange={(value) => setFormData({ ...formData, skill_level: value })}
              >
                <SelectTrigger id="skill-level">
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
              <Label htmlFor="format">Format</Label>
              <Select
                value={formData.format}
                onValueChange={(value) => setFormData({ ...formData, format: value })}
              >
                <SelectTrigger id="format">
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
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!formData.name.trim() || isSubmitting}
              >
                {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Add Division"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
