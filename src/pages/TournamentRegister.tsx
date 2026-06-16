import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowLeft, Users, Trophy, Check, ChevronsUpDown, Loader2, Calendar, MapPin, DollarSign, AlertTriangle, UserCog } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatTournamentLabel, formatSkillLevelRange, formatGenderLabel } from "@/lib/formatLabels";
import { checkDivisionEligibility, type EligibilityResult } from "@/lib/tournamentValidation";
import { getDivisionPricing, type PricingInfo } from "@/lib/tournamentPricing";
import { checkTournamentReadiness, type TournamentRequirements } from "@/lib/profileCompleteness";
import logo from "@/assets/pulse-logo-premium.svg";

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  registration_fee: number;
}

interface Division {
  id: string;
  name: string;
  format: string;
  max_teams: number | null;
  description: string | null;
  skill_level_min?: number | null;
  skill_level_max?: number | null;
  gender?: string | null;
  registration_fee?: number | null;
  early_bird_fee?: number | null;
  early_bird_deadline?: string | null;
}

interface DivisionWithData extends Division {
  spotsRemaining: number;
  isFull: boolean;
  eligibility: EligibilityResult;
  pricing: PricingInfo;
}

interface PlayerProfile {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  current_rating?: number | null;
}

interface UserProfileComplete {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  town?: string | null;
  state?: string | null;
}

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export default function TournamentRegister() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const preselectedDivision = searchParams.get("division");
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Data
  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [divisions, setDivisions] = useState<DivisionWithData[]>([]);
  const [currentUser, setCurrentUser] = useState<PlayerProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileComplete | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  
  // Form fields
  const [divisionId, setDivisionId] = useState(preselectedDivision || "");
  const [teamName, setTeamName] = useState("");
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [shirtSizeCaptain, setShirtSizeCaptain] = useState("M");
  const [shirtSizePartner, setShirtSizePartner] = useState("M");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  
  // Partner search
  const [partnerSearchOpen, setPartnerSearchOpen] = useState(false);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState("");

  useEffect(() => {
    checkAuthAndFetchData();
  }, [eventId]);

  const checkAuthAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to register for tournaments",
        });
        navigate(`/auth?redirect=/tournament/${eventId}/register`);
        return;
      }

      await Promise.all([
        fetchEvent(),
        fetchCurrentUser(),
        fetchPlayers(),
      ]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvent = async () => {
    const { data: eventData, error: eventError } = await supabase
      .from("tournaments_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError) throw eventError;
    if (!eventData.registration_enabled) {
      throw new Error("Registration is not enabled for this tournament");
    }

    setEvent(eventData);

    // Fetch divisions with counts
    const { data: divisionsData, error: divisionsError } = await supabase
      .from("tournaments_divisions")
      .select("*")
      .eq("event_id", eventId);

    if (divisionsError) throw divisionsError;

    // Fetch current user profile for eligibility check
    const { data: { user } } = await supabase.auth.getUser();
    let playerProfile = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, current_rating, date_of_birth, gender")
        .eq("id", user.id)
        .single();
      playerProfile = profile;
    }

    // Enrich divisions with spot counts and eligibility
    const enrichedDivisions = await Promise.all(
      (divisionsData || []).map(async (division: Division) => {
        const { count: teamsCount } = await supabase
          .from("tournaments_teams")
          .select("*", { count: "exact", head: true })
          .eq("division_id", division.id);

        const { count: registrationsCount } = await supabase
          .from("tournament_registrations")
          .select("*", { count: "exact", head: true })
          .eq("division_id", division.id)
          .in("status", ["confirmed", "pending"]);

        const maxTeams = division.max_teams || 999;
        const currentTeams = (teamsCount || 0) + (registrationsCount || 0);
        const spotsRemaining = Math.max(0, maxTeams - currentTeams);

        const eligibility = playerProfile 
          ? checkDivisionEligibility(playerProfile, division, eventData.start_date)
          : { eligible: true, reasons: [] };

        const pricing = getDivisionPricing(division, eventData.registration_fee);

        return {
          ...division,
          spotsRemaining,
          isFull: spotsRemaining === 0,
          eligibility,
          pricing,
        };
      })
    );

    setDivisions(enrichedDivisions);
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, first_name, last_name, phone_number, date_of_birth, gender, emergency_contact_name, emergency_contact_phone, town, state")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);
      setUserProfile(profile);
    }
  };

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, current_rating")
      .order("display_name");
    setPlayers(data || []);
  };

  const selectedDivision = divisions.find((d) => d.id === divisionId);
  const selectedPartner = players.find((p) => p.id === partnerId);
  
  const filteredPlayers = partnerSearchQuery.trim() === ""
    ? []
    : players.filter((player) => {
        if (currentUser && player.id === currentUser.id) return false;
        const displayName = player.display_name || player.full_name || "";
        return displayName.toLowerCase().includes(partnerSearchQuery.toLowerCase());
      });

  // Check tournament readiness based on selected division
  const tournamentRequirements: TournamentRequirements = useMemo(() => {
    const hasGenderDivisions = divisions.some(d => d.gender && d.gender !== "open");
    const hasAgeDivisions = divisions.some(d => 
      (d.skill_level_min !== null && d.skill_level_min !== undefined) || 
      (d.skill_level_max !== null && d.skill_level_max !== undefined)
    );
    return {
      requireEmergencyContact: true, // Most tournaments require this
      hasGenderRestrictedDivisions: hasGenderDivisions,
      hasAgeRestrictedDivisions: hasAgeDivisions,
    };
  }, [divisions]);

  const profileReadiness = useMemo(() => {
    if (!userProfile) return { ready: true, missing: [] };
    return checkTournamentReadiness(userProfile, tournamentRequirements);
  }, [userProfile, tournamentRequirements]);

  const canSubmit = () => {
    if (!divisionId) return false;
    if (!teamName.trim()) return false;
    if (hasPartner && !partnerId) return false;
    if (!emergencyContact.trim() || !emergencyPhone.trim()) return false;
    if (!waiverAccepted) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    
    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const policyText = `
        ARRIVAL: Please arrive 15 minutes early for check-in.
        SPORTSMANSHIP: All players are expected to maintain respectful conduct.
        REFUND POLICY: Cancellations more than 48 hours before receive 50% refund.
        WEATHER: Tournament director will notify teams via email.
      `.trim();

      const { data: registration, error: regError } = await supabase
        .from("tournament_registrations")
        .insert({
          event_id: eventId,
          division_id: divisionId,
          team_name: teamName,
          captain_user_id: user.id,
          partner_user_id: partnerId,
          status: "pending",
          payment_status: "unpaid",
          additional_info: {
            shirt_sizes: {
              captain: shirtSizeCaptain,
              partner: shirtSizePartner,
            },
            emergency_contact: {
              name: emergencyContact,
              phone: emergencyPhone,
            },
            waiver_accepted: waiverAccepted,
            policy_text: policyText,
            policy_accepted: true,
            policy_timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (regError) throw regError;

      // Try to send confirmation email
      try {
        await supabase.functions.invoke("send-registration-confirmation", {
          body: { registrationId: registration.id },
        });
      } catch (emailError) {
        console.warn("Failed to send confirmation email:", emailError);
      }

      toast({
        title: "Registration submitted!",
        description: "You'll receive a confirmation email shortly.",
      });

      navigate(`/tournament/${eventId}`);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const StandardHeader = () => (
    <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
      <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
        <Link to={`/tournament/${eventId}`}>
          <img
            src={logo}
            alt="PULSE Logo"
            className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity"
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/tournament/${eventId}`)}
            className="text-white hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader />
        <div className="container max-w-2xl py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader />
        <div className="container max-w-2xl py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Tournament not found</p>
              <Button onClick={() => navigate("/tournaments")}>Browse Tournaments</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StandardHeader />
      
      <div className="container max-w-2xl py-8 px-4">
        {/* Event Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Register for {event.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Profile Readiness Warning */}
        {!profileReadiness.ready && (
          <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
            <UserCog className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <p className="font-medium text-amber-700 dark:text-amber-400">Complete your profile to register</p>
              <p className="text-sm mt-1 text-amber-600/80 dark:text-amber-400/80">
                This tournament requires: {profileReadiness.missing.map(m => m.label).join(", ")}
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-3 border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400" 
                asChild
              >
                <Link to={`/profile/edit?focus=tournament&return=/tournament/${eventId}/register`}>
                  <UserCog className="w-4 h-4 mr-2" />
                  Complete Profile
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-6 space-y-8">
            {/* Division Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Select Division *</Label>
              <RadioGroup value={divisionId} onValueChange={setDivisionId}>
                <div className="space-y-2">
                  {divisions.map((division) => {
                    const isDisabled = division.isFull || !division.eligibility.eligible;
                    
                    return (
                      <div
                        key={division.id}
                        className={cn(
                          "border rounded-lg p-4 transition-colors",
                          divisionId === division.id ? "border-primary bg-primary/5" : "border-border",
                          isDisabled ? "opacity-60" : "hover:border-primary/50 cursor-pointer"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <RadioGroupItem
                            value={division.id}
                            id={`div-${division.id}`}
                            disabled={isDisabled}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <Label
                                htmlFor={`div-${division.id}`}
                                className={cn("font-medium", isDisabled ? "cursor-not-allowed" : "cursor-pointer")}
                              >
                                {division.name}
                              </Label>
                              {division.pricing.currentPrice > 0 && (
                                <div className="flex items-center gap-2">
                                  {division.pricing.isEarlyBird ? (
                                    <>
                                      <span className="text-sm text-muted-foreground line-through">${division.pricing.regularPrice}</span>
                                      <span className="font-semibold text-green-600">${division.pricing.currentPrice}</span>
                                    </>
                                  ) : (
                                    <span className="font-semibold">${division.pricing.currentPrice}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {!division.eligibility.eligible && division.eligibility.reasons.length > 0 && (
                              <Alert variant="destructive" className="py-2 mt-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  {division.eligibility.reasons[0]}
                                </AlertDescription>
                              </Alert>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">{formatTournamentLabel(division.format)}</Badge>
                              {division.gender && division.gender !== "open" && (
                                <Badge variant="secondary" className="text-xs">{formatGenderLabel(division.gender)}</Badge>
                              )}
                              {(division.skill_level_min || division.skill_level_max) && (
                                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                                  <Trophy className="h-3 w-3 mr-1" />
                                  {formatSkillLevelRange(division.skill_level_min, division.skill_level_max)}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                <Users className="h-3 w-3 inline mr-1" />
                                {division.spotsRemaining} spots left
                              </span>
                              {division.isFull && <Badge variant="destructive">Full</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </div>

            {/* Team Name */}
            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-base font-semibold">Team Name *</Label>
              <Input
                id="teamName"
                placeholder="Enter your team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">Displayed on brackets and scoreboards</p>
            </div>

            {/* Partner Selection */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Partner</Label>
              <RadioGroup
                value={hasPartner ? "yes" : "no"}
                onValueChange={(value) => {
                  const has = value === "yes";
                  setHasPartner(has);
                  if (!has) setPartnerId(null);
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="partner-yes" />
                  <Label htmlFor="partner-yes" className="cursor-pointer font-normal">
                    I have a partner
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="partner-no" />
                  <Label htmlFor="partner-no" className="cursor-pointer font-normal">
                    I need a partner (will be assigned)
                  </Label>
                </div>
              </RadioGroup>

              {hasPartner && (
                <div className="space-y-2">
                  <Label>Search Partner *</Label>
                  <Popover open={partnerSearchOpen} onOpenChange={setPartnerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={partnerSearchOpen}
                        className="w-full justify-between"
                      >
                        {selectedPartner
                          ? selectedPartner.display_name || selectedPartner.full_name
                          : "Search for partner by name..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Type a name to search..."
                          value={partnerSearchQuery}
                          onValueChange={setPartnerSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {partnerSearchQuery.trim() ? "No players found." : "Start typing to search..."}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredPlayers.slice(0, 10).map((player) => (
                              <CommandItem
                                key={player.id}
                                value={player.id}
                                onSelect={() => {
                                  setPartnerId(player.id);
                                  setPartnerSearchOpen(false);
                                  setPartnerSearchQuery("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    partnerId === player.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{player.display_name || player.full_name}</span>
                                  {player.current_rating && (
                                    <span className="text-xs text-muted-foreground">
                                      Rating: {player.current_rating.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Partner must have a PULSE account</p>
                </div>
              )}
            </div>

            {/* Shirt Sizes */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Shirt Size</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shirtCaptain">Your Size</Label>
                  <Select value={shirtSizeCaptain} onValueChange={setShirtSizeCaptain}>
                    <SelectTrigger id="shirtCaptain">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIRT_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasPartner && (
                  <div className="space-y-2">
                    <Label htmlFor="shirtPartner">Partner's Size</Label>
                    <Select value={shirtSizePartner} onValueChange={setShirtSizePartner}>
                      <SelectTrigger id="shirtPartner">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIRT_SIZES.map((size) => (
                          <SelectItem key={size} value={size}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Emergency Contact *</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergencyName">Contact Name</Label>
                  <Input
                    id="emergencyName"
                    placeholder="Full name"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Phone Number</Label>
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
            </div>

            {/* Waiver */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="waiver"
                  checked={waiverAccepted}
                  onCheckedChange={(checked) => setWaiverAccepted(checked as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="waiver" className="cursor-pointer font-medium">
                    I accept the waiver and terms *
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    By checking this box, I acknowledge that I have read and agree to the tournament
                    waiver, rules, and code of conduct. I understand that pickleball involves physical
                    activity and I participate at my own risk.
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing Summary */}
            {selectedDivision && selectedDivision.pricing.currentPrice > 0 && (
              <div className="border rounded-lg p-4 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="font-medium">Registration Fee</span>
                  </div>
                  <div className="text-right">
                    {selectedDivision.pricing.isEarlyBird ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">${selectedDivision.pricing.regularPrice}</span>
                        <span className="text-lg font-bold text-green-600">${selectedDivision.pricing.currentPrice}</span>
                        <Badge variant="secondary" className="text-green-600 bg-green-500/10">
                          Save ${selectedDivision.pricing.savings.toFixed(0)}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-lg font-bold">${selectedDivision.pricing.currentPrice}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Payment will be collected after registration approval</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit() || submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Registration"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your registration will be marked as pending until approved by the tournament director.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}