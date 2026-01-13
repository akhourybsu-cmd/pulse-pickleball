import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Building2, Palette, ChevronRight, Check, Globe, MapPin, Gift, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMode } from "@/contexts/ModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { FreePlanBenefitsList } from "@/components/venue/FreePlanBenefitsList";
import { VenueGoalsStep } from "@/components/venue/VenueGoalsStep";
import logo from "@/assets/pulse-logo-new.png";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface FormData {
  name: string;
  city: string;
  state: string;
  website: string;
  description: string;
  logoUrl: string;
  coverImageUrl: string;
  goals: string[];
}

const STEPS = [
  { id: "basics", label: "Basics", icon: Building2 },
  { id: "goals", label: "Goals", icon: Target },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "confirm", label: "Confirm", icon: Gift },
];

export default function CreateVenueFast() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { refreshVenueAccess, setCurrentVenueId, setMode } = useMode();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    city: "",
    state: "",
    website: "",
    description: "",
    logoUrl: "",
    coverImageUrl: "",
    goals: [],
  });

  // Prefill from inquiry if coming from venue interest wizard
  useEffect(() => {
    const inquiryParam = searchParams.get("inquiry");
    if (inquiryParam) {
      setInquiryId(inquiryParam);
      prefillFromInquiry(inquiryParam);
    }
  }, [searchParams]);

  const prefillFromInquiry = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("venue_inquiries")
        .select("venue_name, city, state, primary_goals")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData((prev) => ({
          ...prev,
          name: data.venue_name || "",
          city: data.city || "",
          state: data.state || "",
          // Map inquiry goals to venue goals if applicable
          goals: data.primary_goals || [],
        }));
      }
    } catch (error) {
      console.error("Error loading inquiry data:", error);
      // Silently fail - user can still fill in manually
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGoal = (goalId: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goalId)
        ? prev.goals.filter(g => g !== goalId)
        : [...prev.goals, goalId]
    }));
  };

  const isStep1Valid = formData.name.trim().length > 0;

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isStep1Valid) return;

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create a venue",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Create the venue
      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .insert({
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          state: formData.state || null,
          website_url: formData.website.trim() || null,
          description: formData.description.trim() || null,
          logo_url: formData.logoUrl.trim() || null,
          cover_image_url: formData.coverImageUrl.trim() || null,
          owner_id: user.id,
          is_published: false,
        })
        .select()
        .single();

      if (venueError) throw venueError;

      // Ensure venue_subscriptions row exists (should be handled by trigger but let's be safe)
      const { error: subError } = await supabase
        .from("venue_subscriptions")
        .upsert({
          venue_id: venue.id,
          tier: "free",
          status: "active",
        }, { onConflict: "venue_id" });

      if (subError) {
        console.warn("Could not create subscription:", subError);
      }

      // Link venue back to inquiry if created from wizard
      if (inquiryId) {
        await supabase
          .from("venue_inquiries")
          .update({ converted_venue_id: venue.id, status: "converted" })
          .eq("id", inquiryId);
      }

      toast({
        title: "Your free venue is ready!",
        description: "Let's complete your venue setup.",
      });

      // Refresh venue access, set current venue, switch to venue mode
      await refreshVenueAccess();
      setCurrentVenueId(venue.id);
      setMode("venue");

      // Navigate to venue onboarding to complete setup
      navigate("/venue/onboarding/profile");
    } catch (error: any) {
      console.error("Error creating venue:", error);
      toast({
        title: "Failed to create venue",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/tournaments">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Back Button */}
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Your Venue Profile</h1>
          <p className="text-muted-foreground">
            Set up your venue in under a minute. It's free!
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: direction * 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 50 }}
                transition={{ duration: 0.2 }}
              >
                {currentStep === 0 && (
                  <Step1Basics formData={formData} updateField={updateField} />
                )}
                {currentStep === 1 && (
                  <VenueGoalsStep 
                    selectedGoals={formData.goals} 
                    onToggleGoal={toggleGoal} 
                  />
                )}
                {currentStep === 2 && (
                  <Step2Branding formData={formData} updateField={updateField} />
                )}
                {currentStep === 3 && (
                  <Step3Confirm venueName={formData.name} />
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={goNext}
              disabled={!isStep1Valid}
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isStep1Valid || isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create My Free Venue"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Step1Basics({ 
  formData, 
  updateField 
}: { 
  formData: FormData; 
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-1">Basic Information</h2>
        <p className="text-sm text-muted-foreground">Tell us about your venue</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">
            Venue Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g., Sunset Pickleball Club"
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              City
            </Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="e.g., Austin"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <select
              id="state"
              value={formData.state}
              onChange={(e) => updateField("state", e.target.value)}
              className="mt-1.5 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Select...</option>
              {US_STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="website" className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Website
          </Label>
          <Input
            id="website"
            type="url"
            value={formData.website}
            onChange={(e) => updateField("website", e.target.value)}
            placeholder="https://yourvenuewebsite.com"
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  );
}

function Step2Branding({ 
  formData, 
  updateField 
}: { 
  formData: FormData; 
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-1">Branding (Optional)</h2>
        <p className="text-sm text-muted-foreground">Make your venue stand out</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            value={formData.logoUrl}
            onChange={(e) => updateField("logoUrl", e.target.value)}
            placeholder="https://example.com/logo.png"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste a URL to your venue's logo image
          </p>
        </div>

        <div>
          <Label htmlFor="coverImageUrl">Cover Image URL</Label>
          <Input
            id="coverImageUrl"
            type="url"
            value={formData.coverImageUrl}
            onChange={(e) => updateField("coverImageUrl", e.target.value)}
            placeholder="https://example.com/cover.jpg"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            A wide image to showcase your venue
          </p>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Tell players what makes your venue special..."
            className="mt-1.5 min-h-[100px]"
          />
        </div>
      </div>
    </div>
  );
}

function Step3Confirm({ venueName }: { venueName: string }) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500/10 mb-4">
          <Gift className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold mb-1">Welcome to Your Free Venue Plan</h2>
        <p className="text-sm text-muted-foreground">
          Everything you need to host events on Pulse
        </p>
      </div>

      <div className="bg-muted/30 rounded-lg p-5 border border-border/50">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4">
          Included with your Free Plan
        </h3>
        <FreePlanBenefitsList showMicrocopy />
      </div>

      <div className="text-center text-sm text-muted-foreground border-t border-border/50 pt-4">
        Advanced venue tools and services may be available in the future. 
        You'll always be able to upgrade when it makes sense for your venue.
      </div>
    </div>
  );
}
