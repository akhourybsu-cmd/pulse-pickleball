import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Upload, X, Plus, Save, HelpCircle, Eye, CheckCircle2, Bold, Italic, Heading, Link2, List, Lightbulb, Wand2, MapPin, Droplet, Building2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Sponsor {
  logo_url: string;
  link?: string;
  name?: string;
  tagline?: string;
}

interface SocialLink {
  label: string;
  url: string;
}

interface VenueDetail {
  icon: string;
  text: string;
}

export default function TournamentCustomize() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  
  // Form state
  const [customizationId, setCustomizationId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroOverlayColor, setHeroOverlayColor] = useState("none");
  const [tagline, setTagline] = useState("");
  const [aboutMarkdown, setAboutMarkdown] = useState("");
  const [aboutImageUrl, setAboutImageUrl] = useState("");
  const [mapEmbed, setMapEmbed] = useState("");
  const [venuePhotoUrl, setVenuePhotoUrl] = useState("");
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [policiesText, setPoliciesText] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [weatherPolicy, setWeatherPolicy] = useState("");
  const [conductPolicy, setConductPolicy] = useState("");
  const [liabilityPolicy, setLiabilityPolicy] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [organizerContactName, setOrganizerContactName] = useState("");
  const [organizerContactEmail, setOrganizerContactEmail] = useState("");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [organizerPreferredContact, setOrganizerPreferredContact] = useState("email");
  const [organizerMessage, setOrganizerMessage] = useState("");
  const [organizerSocialLinks, setOrganizerSocialLinks] = useState<SocialLink[]>([]);
  const [themeAccent, setThemeAccent] = useState("lime");
  const [venueDetails, setVenueDetails] = useState<VenueDetail[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);
  const [mapEmbedValid, setMapEmbedValid] = useState<boolean | null>(null);
  const [validatingMap, setValidatingMap] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, eventId]);

  const fetchData = async () => {
    if (!eventId) return;

    // Check if user is admin or event creator
    const { data: eventData } = await supabase
      .from("tournaments_events")
      .select("name, created_by")
      .eq("id", eventId)
      .single();

    if (!eventData) {
      toast.error("Event not found");
      navigate("/tournament-admin");
      return;
    }

    setEventName(eventData.name);

    // Check permissions
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!roleData;
    const isCreator = eventData.created_by === userId;

    if (!isAdmin && !isCreator) {
      toast.error("You don't have permission to customize this event");
      navigate("/tournament-admin");
      return;
    }

    // Fetch customization data
    const { data: customData } = await supabase
      .from("tournament_customization")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (customData) {
      setCustomizationId(customData.id);
      setIsPublished(customData.is_published || false);
      setHeroImageUrl(customData.hero_image_url || "");
      setHeroOverlayColor(customData.hero_overlay_color || "none");
      setTagline(customData.tagline || "");
      setAboutMarkdown(customData.about_markdown || "");
      setAboutImageUrl(customData.about_image_url || "");
      setMapEmbed(customData.map_embed || "");
      setVenuePhotoUrl(customData.venue_photo_url || "");
      setSponsors(Array.isArray(customData.sponsors) ? customData.sponsors as unknown as Sponsor[] : []);
      setPoliciesText(customData.policies_text || "");
      setOrganizerContactName(customData.organizer_contact_name || "");
      setOrganizerContactEmail(customData.organizer_contact_email || "");
      setOrganizerPhone((customData as any).organizer_phone || "");
      setOrganizerPreferredContact((customData as any).organizer_preferred_contact || "email");
      setOrganizerMessage((customData as any).organizer_message || "");
      setOrganizerSocialLinks(Array.isArray(customData.organizer_social_links) ? customData.organizer_social_links as unknown as SocialLink[] : []);
      setThemeAccent(customData.theme_accent || "lime");
      setVenueDetails(Array.isArray(customData.venue_details) ? customData.venue_details as unknown as VenueDetail[] : []);
      setRefundPolicy((customData as any).refund_policy || "");
      setWeatherPolicy((customData as any).weather_policy || "");
      setConductPolicy((customData as any).conduct_policy || "");
      setLiabilityPolicy((customData as any).liability_policy || "");
      setExtraNotes((customData as any).extra_notes || "");
    }

    setLoading(false);
  };

  const uploadFile = async (file: File, path: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${eventId}/${path}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('tournament-assets')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('tournament-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadFile(file, 'images');
      setter(url);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!eventId) return;

    setSaving(true);
    try {
      const customizationData = {
        event_id: eventId,
        is_published: isPublished,
        hero_image_url: heroImageUrl || null,
        hero_overlay_color: heroOverlayColor,
        tagline: tagline || null,
        about_markdown: aboutMarkdown || null,
        about_image_url: aboutImageUrl || null,
        map_embed: mapEmbed || null,
        venue_photo_url: venuePhotoUrl || null,
        sponsors: sponsors.length > 0 ? JSON.parse(JSON.stringify(sponsors)) : null,
        policies_text: policiesText || null,
        refund_policy: refundPolicy || null,
        weather_policy: weatherPolicy || null,
        conduct_policy: conductPolicy || null,
        liability_policy: liabilityPolicy || null,
        extra_notes: extraNotes || null,
        organizer_contact_name: organizerContactName || null,
        organizer_contact_email: organizerContactEmail || null,
        organizer_phone: organizerPhone || null,
        organizer_preferred_contact: organizerPreferredContact || 'email',
        organizer_message: organizerMessage || null,
        organizer_social_links: organizerSocialLinks.length > 0 ? JSON.parse(JSON.stringify(organizerSocialLinks)) : null,
        theme_accent: themeAccent,
        venue_details: venueDetails.length > 0 ? JSON.parse(JSON.stringify(venueDetails)) : null,
        last_updated_by: userId,
      };

      if (customizationId) {
        const { error } = await supabase
          .from("tournament_customization")
          .update(customizationData)
          .eq("id", customizationId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tournament_customization")
          .insert(customizationData)
          .select()
          .single();

        if (error) throw error;
        if (data) setCustomizationId(data.id);
      }

      setHasUnsavedChanges(false);
      toast.success("Changes saved successfully");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPreview = async () => {
    await handleSave();
    window.open(publicUrl, '_blank');
  };

  const handlePublishToggle = async () => {
    const newPublishedState = !isPublished;
    setIsPublished(newPublishedState);
    
    if (customizationId) {
      await supabase
        .from("tournament_customization")
        .update({ is_published: newPublishedState })
        .eq("id", customizationId);
      
      const message = newPublishedState 
        ? `Your page is now live — view it at ${publicUrl}` 
        : "Page unpublished";
      toast.success(message);
      setHasUnsavedChanges(false);
    }
  };

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [heroImageUrl, heroOverlayColor, tagline, aboutMarkdown, aboutImageUrl, 
      mapEmbed, venuePhotoUrl, sponsors, policiesText, refundPolicy, weatherPolicy,
      conductPolicy, liabilityPolicy, extraNotes, organizerContactName, 
      organizerContactEmail, organizerPhone, organizerPreferredContact, organizerMessage,
      organizerSocialLinks, themeAccent, venueDetails]);

  const addSponsor = () => {
    if (sponsors.length >= 4) {
      toast.error("Maximum 4 sponsors allowed");
      return;
    }
    setSponsors([...sponsors, { logo_url: "" }]);
  };

  const removeSponsor = (index: number) => {
    setSponsors(sponsors.filter((_, i) => i !== index));
  };

  const updateSponsor = (index: number, field: keyof Sponsor, value: string) => {
    const updated = [...sponsors];
    updated[index] = { ...updated[index], [field]: value };
    setSponsors(updated);
  };

  const addSocialLink = () => {
    setOrganizerSocialLinks([...organizerSocialLinks, { label: "", url: "" }]);
  };

  const removeSocialLink = (index: number) => {
    setOrganizerSocialLinks(organizerSocialLinks.filter((_, i) => i !== index));
  };

  const updateSocialLink = (index: number, field: keyof SocialLink, value: string) => {
    const updated = [...organizerSocialLinks];
    updated[index] = { ...updated[index], [field]: value };
    setOrganizerSocialLinks(updated);
  };

  const addVenueDetail = () => {
    setVenueDetails([...venueDetails, { icon: "", text: "" }]);
  };

  const removeVenueDetail = (index: number) => {
    setVenueDetails(venueDetails.filter((_, i) => i !== index));
  };

  const updateVenueDetail = (index: number, field: keyof VenueDetail, value: string) => {
    const updated = [...venueDetails];
    updated[index] = { ...updated[index], [field]: value };
    setVenueDetails(updated);
  };

  const markdownTemplates = {
    competitive: `## Welcome to ${eventName || "Our Tournament"}!

Join us for an exciting weekend of competitive pickleball. Players from across the region will compete for prizes and bragging rights.

**What to Expect:**
- High-level competition across multiple divisions
- Professional officiating and scoring
- Prizes for division winners
- All-day tournament action

Whether you're aiming for the podium or testing your skills against top players, this tournament delivers the competitive experience you're looking for.`,
    
    social: `## Join Us for ${eventName || "Our Tournament"}!

Looking for a fun weekend of pickleball and community? This is the event for you!

**Event Highlights:**
- Friendly competition for all skill levels
- Great music and food throughout the day
- Meet new playing partners
- Raffles and giveaways
- Family-friendly atmosphere

Come for the games, stay for the connections. Everyone's welcome!`,
    
    charity: `## Play with Purpose at ${eventName || "Our Tournament"}

Join us for a special tournament benefiting [Your Cause/Organization]. Every game you play helps make a difference in our community.

**Event Details:**
- 100% of proceeds support [Cause Name]
- Competitive and recreational divisions
- Silent auction and raffle prizes
- Food, drinks, and entertainment
- Special guest appearances

Your participation helps us give back. Let's rally together for a great cause!`
  };

  const insertMarkdownSyntax = (syntax: string, placeholder: string = "") => {
    const textarea = document.getElementById("aboutMarkdown") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = aboutMarkdown.substring(start, end);
    const replacement = selectedText || placeholder;
    
    let newText = "";
    switch(syntax) {
      case "bold":
        newText = aboutMarkdown.substring(0, start) + `**${replacement}**` + aboutMarkdown.substring(end);
        break;
      case "italic":
        newText = aboutMarkdown.substring(0, start) + `*${replacement}*` + aboutMarkdown.substring(end);
        break;
      case "heading":
        newText = aboutMarkdown.substring(0, start) + `## ${replacement}` + aboutMarkdown.substring(end);
        break;
      case "link":
        newText = aboutMarkdown.substring(0, start) + `[${replacement || "link text"}](url)` + aboutMarkdown.substring(end);
        break;
      case "list":
        newText = aboutMarkdown.substring(0, start) + `- ${replacement || "list item"}` + aboutMarkdown.substring(end);
        break;
    }
    
    setAboutMarkdown(newText);
    setTimeout(() => textarea.focus(), 0);
  };

  const venueIconOptions = [
    { value: "parking", label: "🅿️ Parking", icon: "🅿️" },
    { value: "water", label: "💧 Water", icon: "💧" },
    { value: "indoor", label: "🏟️ Indoor", icon: "🏟️" },
    { value: "outdoor", label: "☀️ Outdoor", icon: "☀️" },
    { value: "food", label: "🍔 Food", icon: "🍔" },
    { value: "wifi", label: "📶 WiFi", icon: "📶" },
    { value: "restroom", label: "🚻 Restrooms", icon: "🚻" },
    { value: "accessible", label: "♿ Accessible", icon: "♿" },
  ];

  // Debounced map validation
  useEffect(() => {
    if (!mapEmbed) {
      setMapEmbedValid(null);
      return;
    }

    setValidatingMap(true);
    const timer = setTimeout(() => {
      const isIframe = mapEmbed.includes('<iframe') || mapEmbed.includes('iframe');
      const isGoogleMaps = mapEmbed.includes('google.com/maps') || mapEmbed.includes('maps.google.com');
      const valid = isIframe || isGoogleMaps;
      
      setMapEmbedValid(valid);
      setValidatingMap(false);
      
      if (!valid) {
        toast.error("This doesn't look like a map link — please check your URL.");
      } else {
        toast.success("Map added successfully");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [mapEmbed]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/tournament/${eventId}`;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={userId} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Customize Public Tournament Page</h1>
              <p className="text-lg text-muted-foreground">
                Design a beautiful landing page that drives registration
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              {showHelp ? "Hide" : "Show"} Tips
            </Button>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <Badge 
              variant={isPublished ? "default" : "secondary"}
              className="text-sm px-3 py-1.5"
            >
              {isPublished ? (
                <><CheckCircle2 className="h-3 w-3 mr-1.5" /> Published</>
              ) : (
                "Draft"
              )}
            </Badge>

            <Button
              onClick={handleSaveAndPreview}
              disabled={saving}
              size="lg"
              className={hasUnsavedChanges ? "animate-pulse shadow-lg shadow-primary/20" : ""}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : isPublished ? "Save & Update Live Page" : "Save Draft"}
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open(publicUrl, '_blank')}
              size="lg"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>

            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-sm text-muted-foreground">Publish Status:</Label>
              <Switch
                checked={isPublished}
                onCheckedChange={handlePublishToggle}
              />
            </div>
          </div>
          
          {isPublished && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20"
            >
              <p className="text-sm">
                <span className="font-medium">Public URL:</span>{" "}
                <a 
                  href={publicUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:underline font-mono"
                >
                  {publicUrl}
                </a>
                <span className="text-muted-foreground ml-2">— Share this with players</span>
              </p>
            </motion.div>
          )}
        </div>

        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="venue">Venue</TabsTrigger>
            <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="hero" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left: Controls */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Hero Banner Image</CardTitle>
                    {showHelp && (
                      <CardDescription className="text-sm">
                        This image fills the top section of your public event page. Recommended: 1600×600 px
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {heroImageUrl ? (
                      <div className="space-y-3">
                        <img 
                          src={heroImageUrl} 
                          alt="Hero preview" 
                          className="w-full h-40 object-cover rounded-lg border-2 border-border" 
                        />
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, setHeroImageUrl)}
                            disabled={uploading}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHeroImageUrl("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-3">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Preview will appear here</p>
                        </div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, setHeroImageUrl)}
                          disabled={uploading}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tagline</CardTitle>
                    {showHelp && (
                      <CardDescription className="text-sm">
                        A one-line statement that introduces your tournament to players
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      id="tagline"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Example: A weekend of competition and community at the Attleboro YMCA!"
                    />
                    {tagline && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3 bg-muted rounded-lg"
                      >
                        <p className="text-sm text-muted-foreground mb-1">Live Preview:</p>
                        <p className="font-medium">{eventName} — {tagline}</p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Hero Overlay</CardTitle>
                    {showHelp && (
                      <CardDescription className="text-sm">
                        Choose a color mood for your banner and highlights
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { 
                          value: "none", 
                          label: "Pulse Energy", 
                          description: "Bright & Vibrant",
                          bg: "bg-gradient-to-br from-primary to-accent" 
                        },
                        { 
                          value: "lime", 
                          label: "Lime Glow", 
                          description: "Fresh & Modern",
                          bg: "bg-gradient-to-br from-lime-400 to-lime-600" 
                        },
                        { 
                          value: "teal", 
                          label: "Teal Calm", 
                          description: "Professional",
                          bg: "bg-gradient-to-br from-teal-600 to-teal-800" 
                        },
                        { 
                          value: "dark-teal-overlay", 
                          label: "Dark Focus", 
                          description: "Focused on Photo",
                          bg: "bg-gradient-to-b from-gray-900/40 to-gray-900/80" 
                        },
                      ].map((option) => (
                        <motion.button
                          key={option.value}
                          onClick={() => setHeroOverlayColor(option.value)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            heroOverlayColor === option.value 
                              ? "border-primary shadow-lg shadow-primary/20" 
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className={`w-full h-16 rounded ${option.bg} mb-3 relative overflow-hidden`}>
                            {heroOverlayColor === option.value && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-semibold mb-1">{option.label}</p>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Theme Accent</CardTitle>
                    {showHelp && (
                      <CardDescription className="text-sm">
                        Select your overall color style. These are Pulse-approved palettes.
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "lime", label: "Pulse Lime", description: "Bright & Modern" },
                        { value: "teal", label: "Deep Teal", description: "Sleek & Professional" },
                        { value: "dark-teal", label: "Dark Teal", description: "Contrast & Focus" },
                        { value: "light-card", label: "Light", description: "Airy & Minimal" },
                      ].map((accent) => (
                        <motion.button
                          key={accent.value}
                          onClick={() => setThemeAccent(accent.value)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                            themeAccent === accent.value 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="text-sm font-semibold mb-1">{accent.label}</p>
                          <p className="text-xs text-muted-foreground">{accent.description}</p>
                          {themeAccent === accent.value && (
                            <CheckCircle2 className="h-3 w-3 text-primary mt-1" />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Live Preview */}
              <div className="lg:sticky lg:top-8 h-fit">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Live Hero Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div 
                      key={`${heroOverlayColor}-${themeAccent}`}
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-lg overflow-hidden border-2 border-border"
                    >
                      <div className="relative h-64">
                        {heroImageUrl ? (
                          <img 
                            src={heroImageUrl} 
                            alt="Hero" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-accent" />
                        )}
                        <div 
                          className={`absolute inset-0 ${
                            heroOverlayColor === "lime" ? "bg-gradient-to-b from-lime-500/30 to-lime-700/50" :
                            heroOverlayColor === "teal" ? "bg-gradient-to-b from-teal-600/40 to-teal-800/60" :
                            heroOverlayColor === "dark-teal-overlay" ? "bg-gradient-to-b from-gray-900/20 to-gray-900/60" :
                            ""
                          }`}
                        />
                        <div className="absolute inset-0 p-8 flex flex-col justify-end">
                          <div className="bg-white/95 backdrop-blur p-4 rounded-lg shadow-lg max-w-md">
                            <h2 className="text-2xl font-bold mb-1">{eventName || "Tournament Name"}</h2>
                            {tagline && (
                              <p className="text-sm text-muted-foreground">{tagline}</p>
                            )}
                            <div className="mt-3 flex gap-2">
                              <div className={`px-3 py-1 rounded text-xs font-medium ${
                                themeAccent === "lime" ? "bg-primary text-primary-foreground" :
                                themeAccent === "teal" ? "bg-teal-600 text-white" :
                                themeAccent === "dark-teal" ? "bg-gray-900 text-white" :
                                "bg-gray-100 text-gray-900"
                              }`}>
                                Sample Button
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      This preview updates as you make changes
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            {showGuidance && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/5 border border-primary/20 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      <p className="font-semibold text-sm">Need ideas? Try including:</p>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                      <li>What makes this tournament special</li>
                      <li>Who should join (skill levels or divisions)</li>
                      <li>Any prizes, raffles, or fun extras</li>
                      <li>What last year&apos;s turnout was like</li>
                    </ul>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGuidance(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left: Editor */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Event Story</CardTitle>
                        <CardDescription>
                          Tell players why they should join
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Wand2 className="h-4 w-4" />
                            Use Template
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => setAboutMarkdown(markdownTemplates.competitive)}>
                            <span className="font-medium">Competitive Event</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAboutMarkdown(markdownTemplates.social)}>
                            <span className="font-medium">Community Mixer</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAboutMarkdown(markdownTemplates.charity)}>
                            <span className="font-medium">Charity / Fundraiser</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Markdown Toolbar */}
                    <div className="flex items-center gap-1 p-2 bg-muted rounded-md border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdownSyntax("bold", "bold text")}
                        title="Bold"
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdownSyntax("italic", "italic text")}
                        title="Italic"
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdownSyntax("heading", "Heading")}
                        title="Heading"
                      >
                        <Heading className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdownSyntax("link")}
                        title="Add Link"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => insertMarkdownSyntax("list", "list item")}
                        title="Bullet List"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>

                    <Textarea
                      id="aboutMarkdown"
                      value={aboutMarkdown}
                      onChange={(e) => setAboutMarkdown(e.target.value)}
                      placeholder="Tell your tournament story here... Use the toolbar above for formatting."
                      rows={16}
                      className="font-mono text-sm bg-background/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Supports Markdown formatting. Changes appear instantly in the preview →
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>About Image</CardTitle>
                    {showHelp && (
                      <CardDescription className="text-sm">
                        This image appears alongside your description. Landscape images (16:9) look best.
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {aboutImageUrl ? (
                      <div className="space-y-3">
                        <img 
                          src={aboutImageUrl} 
                          alt="About preview" 
                          className="w-full h-48 object-cover rounded-lg border-2 border-border" 
                        />
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, setAboutImageUrl)}
                            disabled={uploading}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAboutImageUrl("")}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label 
                          htmlFor="aboutImageUpload"
                          className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all block"
                        >
                          <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <p className="text-sm font-medium mb-1">Drop image here or click to upload</p>
                          <p className="text-xs text-muted-foreground">Recommended: 16:9 landscape format</p>
                        </label>
                        <Input
                          id="aboutImageUpload"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, setAboutImageUrl)}
                          disabled={uploading}
                          className="hidden"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Live Preview */}
              <div className="lg:sticky lg:top-8 h-fit">
                <Card className="border-2">
                  <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Live Preview
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Shows how it will look on your public page
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <motion.div
                      key={aboutMarkdown}
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-strong:font-bold prose-em:text-foreground prose-em:italic prose-ul:text-foreground prose-li:text-foreground"
                    >
                      {aboutMarkdown ? (
                        <ReactMarkdown
                          components={{
                            strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                            em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                            h2: ({ children }) => <h2 className="text-2xl font-bold text-foreground mt-6 mb-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-xl font-bold text-foreground mt-4 mb-2">{children}</h3>,
                            p: ({ children }) => <p className="text-foreground mb-3 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc ml-6 mb-3 space-y-1">{children}</ul>,
                            li: ({ children }) => <li className="text-foreground">{children}</li>,
                          }}
                        >
                          {aboutMarkdown}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-muted-foreground italic">
                          Your event description will appear here...
                        </p>
                      )}
                    </motion.div>

                    {aboutImageUrl && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6"
                      >
                        <img
                          src={aboutImageUrl}
                          alt="About"
                          className="rounded-lg w-full object-cover shadow-md"
                        />
                      </motion.div>
                    )}

                    {!aboutMarkdown && !aboutImageUrl && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Start writing or use a template to see your preview
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="venue" className="space-y-6">
            {/* Top Helper Box */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  💡 Help players know exactly where they're going. Add your map, venue photo, and a few quick details (like parking or surface type).
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Venue Editor */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Venue Information</CardTitle>
                    <CardDescription>Map, photos, and facility details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Google Map */}
                    <div className="space-y-2">
                      <Label htmlFor="mapEmbed">Google Map (optional)</Label>
                      {showGuidance && (
                        <p className="text-xs text-muted-foreground">
                          You can paste a full Google Maps embed code or just a location URL — we'll format it automatically.
                        </p>
                      )}
                      <div className="relative">
                        <Textarea
                          id="mapEmbed"
                          value={mapEmbed}
                          onChange={(e) => setMapEmbed(e.target.value)}
                          placeholder="Paste Google Maps embed code or location link..."
                          rows={4}
                          className="font-mono text-xs"
                        />
                        {validatingMap && (
                          <div className="absolute top-2 right-2">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          </div>
                        )}
                        {mapEmbedValid !== null && (
                          <div className="absolute top-2 right-2">
                            {mapEmbedValid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        )}
                      </div>
                      {mapEmbedValid === false && (
                        <p className="text-xs text-destructive">
                          This doesn't look like a valid map link — please check your URL.
                        </p>
                      )}
                    </div>

                    {/* Venue Photo */}
                    <div className="space-y-2">
                      <Label>Venue Photo (optional)</Label>
                      {showGuidance && (
                        <p className="text-xs text-muted-foreground">
                          A photo of your courts, gym, or outdoor area — shown on your public page.
                        </p>
                      )}
                      <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-4 hover:border-primary/50 transition-colors">
                        {venuePhotoUrl ? (
                          <div className="space-y-3">
                            <img 
                              src={venuePhotoUrl} 
                              alt="Venue" 
                              className="w-full max-w-md mx-auto rounded-lg object-cover"
                            />
                            <div className="flex gap-2 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e: any) => handleFileUpload(e, setVenuePhotoUrl);
                                  input.click();
                                }}
                                disabled={uploading}
                              >
                                Replace
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setVenuePhotoUrl("")}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                            <p className="text-xs text-center text-muted-foreground">
                              Tip: Landscape (16:9) looks best on desktop and mobile
                            </p>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-3">Add a photo of your facility or event area</p>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, setVenuePhotoUrl)}
                              disabled={uploading}
                              className="max-w-xs mx-auto"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Facts (Venue Details) */}
                    <div className="space-y-2">
                      <Label>Quick Facts</Label>
                      {showGuidance && (
                        <p className="text-xs text-muted-foreground">
                          Add short bullet points about amenities, parking, or surfaces.
                        </p>
                      )}
                      <div className="space-y-2">
                        {venueDetails.map((detail, index) => (
                          <div key={index} className="flex gap-2 items-center p-2 rounded-lg border bg-card hover:border-primary/40 transition-colors">
                            <Select
                              value={detail.icon}
                              onValueChange={(value) => updateVenueDetail(index, "icon", value)}
                            >
                              <SelectTrigger className="w-[60px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {venueIconOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Detail text"
                              value={detail.text}
                              onChange={(e) => updateVenueDetail(index, "text", e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVenueDetail(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {venueDetails.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Add 2–5 quick details to help players prepare
                          </p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addVenueDetail}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add another detail
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Venue Preview */}
              <div className="space-y-4">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Venue Preview</CardTitle>
                    <CardDescription>Your venue section will look like this</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-background to-muted/20 border-2 border-border">
                      {/* Map Preview */}
                      {mapEmbed && mapEmbedValid && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="rounded-lg overflow-hidden border-2 border-border"
                        >
                          <div
                            className="w-full h-48"
                            dangerouslySetInnerHTML={{
                              __html: mapEmbed.includes('<iframe')
                                ? mapEmbed
                                : `<iframe src="${mapEmbed}" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`
                            }}
                          />
                        </motion.div>
                      )}

                      {/* Venue Photo Preview */}
                      {venuePhotoUrl && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="rounded-lg overflow-hidden border-2 border-border"
                        >
                          <img
                            src={venuePhotoUrl}
                            alt="Venue"
                            className="w-full h-48 object-cover"
                          />
                        </motion.div>
                      )}

                      {/* Details Preview */}
                      {venueDetails.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-2"
                        >
                          {venueDetails.map((detail, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded bg-background/50">
                              <span className="text-xl">{detail.icon}</span>
                              <span className="text-sm text-muted-foreground">{detail.text}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}

                      {!mapEmbed && !venuePhotoUrl && venueDetails.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No venue information added yet. Fill in the fields on the left to see your preview.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Sponsors Tab */}
          <TabsContent value="sponsors" className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Sponsors & Partners</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Show appreciation for your event supporters. Add their logos, websites, and taglines. Your sponsors will appear in a clean, scrollable grid on your public page.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left: Sponsor Editor */}
              <div className="space-y-4">
                {sponsors.map((sponsor, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Card className="hover:shadow-[0_0_12px_rgba(197,232,108,0.25)] transition-all duration-200 border-l-4 border-l-primary/30">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <Label className="text-sm font-medium">Logo Upload</Label>
                              <div className="mt-2 border-2 border-dashed border-muted-foreground/30 rounded-xl p-4 hover:border-primary/50 transition-colors">
                                {sponsor.logo_url ? (
                                  <div className="space-y-2">
                                    <img 
                                      src={sponsor.logo_url} 
                                      alt={sponsor.name || "Sponsor"}
                                      className="mx-auto max-h-20 max-w-[200px] object-contain"
                                    />
                                    <div className="flex gap-2 justify-center">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => updateSponsor(index, "logo_url", "")}
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setUploading(true);
                                          try {
                                            const url = await uploadFile(file, 'sponsors');
                                            updateSponsor(index, "logo_url", url);
                                            toast.success("Logo added");
                                          } catch (error) {
                                            toast.error("Failed to upload logo");
                                          } finally {
                                            setUploading(false);
                                          }
                                        }
                                      }}
                                      disabled={uploading}
                                      className="mt-2"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                removeSponsor(index);
                                toast.success("Sponsor removed");
                              }}
                              className="ml-2"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Sponsor Name</Label>
                            <Input
                              value={sponsor.name || ""}
                              onChange={(e) => updateSponsor(index, "name", e.target.value)}
                              placeholder="Acme Pickleball Co."
                              className="mt-1.5"
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Website URL (optional)</Label>
                            <Input
                              value={sponsor.link || ""}
                              onChange={(e) => updateSponsor(index, "link", e.target.value)}
                              placeholder="https://sponsor-website.com"
                              className="mt-1.5"
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Tagline (optional)</Label>
                            <Input
                              value={sponsor.tagline || ""}
                              onChange={(e) => updateSponsor(index, "tagline", e.target.value)}
                              placeholder="Official Court Partner"
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                <Button
                  variant="outline"
                  onClick={() => {
                    if (sponsors.length >= 4) {
                      toast.error("Maximum 4 sponsors allowed");
                      return;
                    }
                    addSponsor();
                  }}
                  className="w-full border-2 border-dashed hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Sponsor {sponsors.length > 0 && `(${sponsors.length}/4)`}
                </Button>
              </div>

              {/* Right: Live Preview */}
              <div className="lg:sticky lg:top-8 h-fit">
                <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Preview (how it appears on your public page)</p>
                  </div>
                  
                  {sponsors.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">No sponsors added yet</p>
                      <p className="text-xs mt-1">Add sponsors to see preview</p>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      <div className="text-center">
                        <h3 className="text-2xl font-bold mb-2">Proudly Supported By</h3>
                        <p className="text-sm text-muted-foreground">These partners help bring this event to life.</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {sponsors.filter(s => s.logo_url || s.name).map((sponsor, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="group"
                          >
                            <Card className="p-4 text-center hover:shadow-[0_4px_12px_rgba(197,232,108,0.3)] hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                              {sponsor.logo_url && (
                                <img 
                                  src={sponsor.logo_url}
                                  alt={sponsor.name || "Sponsor"}
                                  className="mx-auto max-h-16 max-w-[140px] object-contain mb-3"
                                />
                              )}
                              {sponsor.name && (
                                <p className="font-semibold text-sm">{sponsor.name}</p>
                              )}
                              {sponsor.tagline && (
                                <p className="text-xs text-muted-foreground mt-1">{sponsor.tagline}</p>
                              )}
                              {sponsor.link && (
                                <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Visit site →
                                </p>
                              )}
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Policy Editor */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Policies & Legal</CardTitle>
                    <CardDescription>
                      This will be shown publicly, added to your registration confirmation email, and saved for audit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Refund Policy */}
                    <div className="space-y-2">
                      <Label htmlFor="refundPolicy" className="text-base font-semibold">
                        Refund Policy
                      </Label>
                      {showGuidance && (
                        <p className="text-sm text-muted-foreground">
                          If a player backs out, do they get a refund? Until when? Are weather cancellations refunded?
                        </p>
                      )}
                      <Textarea
                        id="refundPolicy"
                        placeholder="Full refunds available until 48 hours before event start. After that, no refunds."
                        value={refundPolicy}
                        onChange={(e) => setRefundPolicy(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    </div>

                    {/* Weather / Cancellation */}
                    <div className="space-y-2">
                      <Label htmlFor="weatherPolicy" className="text-base font-semibold">
                        Weather / Cancellation
                      </Label>
                      {showGuidance && (
                        <p className="text-sm text-muted-foreground">
                          What happens if play stops due to rain or unsafe courts?
                        </p>
                      )}
                      <Textarea
                        id="weatherPolicy"
                        placeholder="Outdoor play is weather-dependent. In case of unsafe conditions, matches may be delayed, relocated, or rescheduled. No cash refunds due to weather, but we will offer credit toward future events."
                        value={weatherPolicy}
                        onChange={(e) => setWeatherPolicy(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    {/* Player Conduct */}
                    <div className="space-y-2">
                      <Label htmlFor="conductPolicy" className="text-base font-semibold">
                        Player Conduct & Sportsmanship
                      </Label>
                      {showGuidance && (
                        <p className="text-sm text-muted-foreground">
                          How should players/spectators behave? Consequences?
                        </p>
                      )}
                      <Textarea
                        id="conductPolicy"
                        placeholder="All players are expected to show respect to officials, opponents, and facility staff. Harassment, intimidation, or abusive language may result in removal from the event without refund."
                        value={conductPolicy}
                        onChange={(e) => setConductPolicy(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    {/* Liability & Waiver */}
                    <div className="space-y-2">
                      <Label htmlFor="liabilityPolicy" className="text-base font-semibold flex items-center gap-2">
                        Liability & Waiver
                        <span className="text-destructive">*</span>
                      </Label>
                      {showGuidance && (
                        <p className="text-sm text-muted-foreground">
                          Your "play at your own risk" waiver. This will always be shown publicly and emailed.
                        </p>
                      )}
                      <Textarea
                        id="liabilityPolicy"
                        placeholder="By registering, you acknowledge the inherent risk of sport participation and agree that the event organizers, facility, and sponsors are not responsible for injury, loss, or damage."
                        value={liabilityPolicy}
                        onChange={(e) => setLiabilityPolicy(e.target.value)}
                        rows={4}
                        className="resize-none border-primary/40"
                      />
                    </div>

                    {/* Additional Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="extraNotes" className="text-base font-semibold">
                        Additional Notes <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      {showGuidance && (
                        <p className="text-sm text-muted-foreground">
                          Parking, what door to check in at, paddle rules, ID requirements, etc.
                        </p>
                      )}
                      <Textarea
                        id="extraNotes"
                        placeholder="Please arrive 20 minutes early to check in at Court 3. Parking is free in the north lot. USA Pickleball-approved paddles only."
                        value={extraNotes}
                        onChange={(e) => setExtraNotes(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-4">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Public Policy Preview</CardTitle>
                    <CardDescription>How this will appear to players</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6 p-6 rounded-xl bg-gradient-to-br from-background to-muted/20 border-2 border-border">
                      <div className="text-center space-y-2 pb-4 border-b">
                        <h3 className="text-xl font-bold text-foreground">
                          Policies & Player Agreement
                        </h3>
                      </div>

                      {refundPolicy && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-primary">Refund Policy</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {refundPolicy}
                          </p>
                        </div>
                      )}

                      {weatherPolicy && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-primary">Weather / Cancellation</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {weatherPolicy}
                          </p>
                        </div>
                      )}

                      {conductPolicy && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-primary">Player Conduct & Sportsmanship</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {conductPolicy}
                          </p>
                        </div>
                      )}

                      {liabilityPolicy && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-primary">Liability & Waiver</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {liabilityPolicy}
                          </p>
                        </div>
                      )}

                      {extraNotes && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-primary">Additional Notes</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {extraNotes}
                          </p>
                        </div>
                      )}

                      {!refundPolicy && !weatherPolicy && !conductPolicy && !liabilityPolicy && !extraNotes && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No policies added yet. Fill in the fields on the left to see your preview.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <Card className="mb-4 border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  💡 This information will appear publicly on your tournament landing page and in confirmation emails.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Contact Form */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Organizer Contact</CardTitle>
                    <CardDescription>How players can reach you for questions or updates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Organizer Name</Label>
                      {showGuidance && (
                        <p className="text-xs text-muted-foreground">Displayed as the main point of contact for this event</p>
                      )}
                      <Input
                        id="contactName"
                        value={organizerContactName}
                        onChange={(e) => setOrganizerContactName(e.target.value)}
                        placeholder="Alex Khoury"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      {showGuidance && (
                        <p className="text-xs text-muted-foreground">Replies will go to this address. Players may contact you for registration questions</p>
                      )}
                      <Input
                        id="contactEmail"
                        type="email"
                        value={organizerContactEmail}
                        onChange={(e) => setOrganizerContactEmail(e.target.value)}
                        placeholder="support@pulsepb.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Phone Number (optional)</Label>
                      {showGuidance && (
                        <p className="text-xs text-muted-foreground">Include if you want players to call or text for urgent questions</p>
                      )}
                      <Input
                        id="contactPhone"
                        type="tel"
                        value={organizerPhone}
                        onChange={(e) => setOrganizerPhone(e.target.value)}
                        placeholder="(508) 555-1234"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferredContact">Preferred Contact Method</Label>
                      <Select value={organizerPreferredContact} onValueChange={setOrganizerPreferredContact}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="either">Either</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organizerMessage">Organizer Message (optional)</Label>
                      {showGuidance && (
                        <p className="text-xs text-muted-foreground">Add a friendly message for your players</p>
                      )}
                      <Textarea
                        id="organizerMessage"
                        value={organizerMessage}
                        onChange={(e) => setOrganizerMessage(e.target.value)}
                        placeholder="Can't wait to see everyone at the Fall Classic! Email me if you need to update your registration."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Social Links (max 3)</Label>
                      <div className="space-y-2 mt-2">
                        {organizerSocialLinks.map((link, index) => (
                          <div key={index} className="flex gap-2">
                            <Select
                              value={link.label}
                              onValueChange={(value) => updateSocialLink(index, "label", value)}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Platform" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Facebook">Facebook</SelectItem>
                                <SelectItem value="Instagram">Instagram</SelectItem>
                                <SelectItem value="X (Twitter)">X (Twitter)</SelectItem>
                                <SelectItem value="YouTube">YouTube</SelectItem>
                                <SelectItem value="TikTok">TikTok</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="URL"
                              value={link.url}
                              onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSocialLink(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addSocialLink}
                          disabled={organizerSocialLinks.length >= 3}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Social Link {organizerSocialLinks.length > 0 && `(${organizerSocialLinks.length}/3)`}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-4">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Preview</CardTitle>
                    <CardDescription>How this will appear to players</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-6 rounded-xl bg-gradient-to-br from-background to-muted/20 border-2 border-primary/20">
                      <h3 className="text-xl font-bold text-center mb-6">Contact the Organizer</h3>
                      
                      {(organizerContactName || organizerContactEmail || organizerPhone) ? (
                        <div className="space-y-4">
                          {organizerContactName && (
                            <div>
                              <p className="text-lg font-semibold text-foreground">{organizerContactName}</p>
                            </div>
                          )}
                          
                          {organizerContactEmail && (
                            <div className="flex items-center gap-2 text-primary">
                              <span className="text-xl">📧</span>
                              <span className="text-sm">{organizerContactEmail}</span>
                            </div>
                          )}
                          
                          {organizerPhone && (
                            <div className="flex items-center gap-2 text-primary">
                              <span className="text-xl">📞</span>
                              <span className="text-sm">{organizerPhone}</span>
                            </div>
                          )}
                          
                          {organizerPreferredContact && (
                            <p className="text-xs text-muted-foreground">
                              Preferred: {organizerPreferredContact === 'email' ? 'Email' : organizerPreferredContact === 'phone' ? 'Phone' : 'Either'}
                            </p>
                          )}
                          
                          {organizerMessage && (
                            <p className="text-sm italic text-muted-foreground border-l-2 border-primary pl-3 mt-4">
                              "{organizerMessage}"
                            </p>
                          )}
                          
                          {organizerSocialLinks.length > 0 && (
                            <div className="pt-4 border-t">
                              <p className="text-xs font-semibold mb-2">Follow us:</p>
                              <div className="flex flex-wrap gap-2">
                                {organizerSocialLinks.map((link, i) => link.label && (
                                  <span key={i} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                                    {link.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No contact information added yet. Fill in the fields on the left to see your preview.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
