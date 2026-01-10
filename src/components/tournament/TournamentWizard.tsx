import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Trophy, Layers, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createTournament, initiateCheckout, useTournament } from "@/hooks/useTournaments";
import { DivisionCardEditor } from "./DivisionCardEditor";
import { OrderSummaryCard } from "./OrderSummaryCard";

const STEPS = [
  { id: "basics", label: "Basics", icon: Trophy },
  { id: "divisions", label: "Divisions", icon: Layers },
  { id: "review", label: "Review & Pay", icon: CreditCard },
];

interface WizardFormData {
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  isPublic: boolean;
}

interface TournamentWizardProps {
  venueId?: string;
}

export function TournamentWizard({ venueId }: TournamentWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [formData, setFormData] = useState<WizardFormData>({
    name: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    isPublic: true,
  });

  const { tournament, divisions, refetch, createDivision, updateDivision, deleteDivision } = 
    useTournament(tournamentId || undefined);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        toast.error("Please sign in to create a tournament");
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  const goNext = () => {
    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCreateTournament = async () => {
    if (!formData.name.trim()) {
      toast.error("Tournament name is required");
      return;
    }

    setIsCreating(true);
    try {
      const id = await createTournament({
        name: formData.name,
        description: formData.description || null,
        location: formData.location || null,
        start_date: formData.startDate || undefined,
        end_date: formData.endDate || undefined,
        is_public: formData.isPublic,
        venue_id: venueId,
      });

      if (id) {
        setTournamentId(id);
        goNext();
        toast.success("Tournament created! Now add your divisions.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCheckout = async () => {
    if (!tournamentId) return;

    if (divisions.length === 0) {
      toast.error("Please add at least one division");
      return;
    }

    setIsCheckingOut(true);
    try {
      const url = await initiateCheckout(tournamentId);
      if (url) {
        window.location.href = url;
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleAddDivision = async (division: { name: string; skill_level: string | null; format: string | null }) => {
    if (!tournamentId) return false;
    const success = await createDivision({
      event_id: tournamentId,
      ...division,
    });
    if (success) await refetch();
    return success;
  };

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case "basics":
        return (
          <motion.div
            key="basics"
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Tournament Name *</Label>
              <Input
                id="name"
                placeholder="Summer Championship 2025"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-card border-border/50 focus:border-primary/50 h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-sm font-medium">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="bg-card border-border/50 focus:border-primary/50 h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-sm font-medium">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  min={formData.startDate}
                  className="bg-card border-border/50 focus:border-primary/50 h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">Location</Label>
              <Input
                id="location"
                placeholder="Diamond Hill Courts, Cumberland, RI"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="bg-card border-border/50 focus:border-primary/50 h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                placeholder="Tournament details, rules, or additional information..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="bg-card border-border/50 focus:border-primary/50"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-card/80 to-muted/30 rounded-xl border border-border/50">
              <div>
                <Label htmlFor="public" className="font-medium">Public Tournament</Label>
                <p className="text-sm text-muted-foreground">
                  Allow players to discover and register
                </p>
              </div>
              <Switch
                id="public"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>
          </motion.div>
        );

      case "divisions":
        return (
          <motion.div
            key="divisions"
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            className="space-y-6"
          >
            <DivisionCardEditor
              divisions={divisions}
              onAdd={handleAddDivision}
              onUpdate={updateDivision}
              onDelete={deleteDivision}
            />
          </motion.div>
        );

      case "review":
        return (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            className="grid md:grid-cols-2 gap-6"
          >
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-card/80 to-muted/30 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Tournament Details
                </h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">{tournament?.name || formData.name}</dd>
                  </div>
                  {(tournament?.location || formData.location) && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Location</dt>
                      <dd>{tournament?.location || formData.location}</dd>
                    </div>
                  )}
                  {(tournament?.start_date || formData.startDate) && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Date</dt>
                      <dd>{tournament?.start_date || formData.startDate}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Visibility</dt>
                    <dd>{(tournament?.is_public ?? formData.isPublic) ? "Public" : "Private"}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gradient-to-br from-card/80 to-muted/30 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Divisions ({divisions.length})
                </h3>
                {divisions.length > 0 ? (
                  <ul className="space-y-2">
                    {divisions.map((div) => (
                      <li key={div.id} className="flex items-center gap-2 text-sm p-2 bg-background/50 rounded-lg">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span>{div.name}</span>
                        {div.skill_level && (
                          <span className="text-muted-foreground">({div.skill_level})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No divisions added</p>
                )}
              </div>
            </div>

            <OrderSummaryCard
              divisionsCount={divisions.length}
              onCheckout={handleCheckout}
              isLoading={isCheckingOut}
              isSticky
            />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/tournaments")}
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Tournaments
          </Button>
          <h1 className="text-3xl font-bold">Create Tournament</h1>
          <p className="text-muted-foreground">
            Set up your tournament in a few easy steps
          </p>
        </div>

        {/* Stepper with glass-morphism */}
        <div className="mb-8 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <motion.div
                    animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 2 }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[0_0_20px_rgba(169,207,70,0.3)]"
                        : isCompleted
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                    <span className="font-medium hidden sm:inline">{step.label}</span>
                  </motion.div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 w-12 mx-2 rounded-full transition-all ${
                        isCompleted ? "bg-gradient-to-r from-primary to-accent" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 md:p-8">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {currentStep < STEPS.length - 1 && (
            <Button
              onClick={currentStep === 0 ? handleCreateTournament : goNext}
              disabled={
                (currentStep === 0 && (!formData.name.trim() || isCreating)) ||
                (currentStep === 1 && divisions.length === 0)
              }
              className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              {isCreating ? "Creating..." : "Continue"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Mobile sticky footer for Review step */}
        {currentStep === 2 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t border-border/50 md:hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-bold text-lg text-primary">
                ${29 + Math.max(0, divisions.length - 3) * 9}
              </span>
            </div>
            <Button
              onClick={handleCheckout}
              disabled={isCheckingOut || divisions.length === 0}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-[0_0_20px_rgba(169,207,70,0.3)]"
              size="lg"
            >
              {isCheckingOut ? "Processing..." : "Pay & Unlock Tournament"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
