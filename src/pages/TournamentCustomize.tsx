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
import { ExternalLink, Upload, X, Plus, Save, HelpCircle, Eye, CheckCircle2, Bold, Italic, Heading, Link2, List, Lightbulb, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Sponsor {
  logo_url: string;
  link?: string;
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
  const [organizerContactName, setOrganizerContactName] = useState("");
  const [organizerContactEmail, setOrganizerContactEmail] = useState("");
  const [organizerSocialLinks, setOrganizerSocialLinks] = useState<SocialLink[]>([]);
  const [themeAccent, setThemeAccent] = useState("lime");
  const [venueDetails, setVenueDetails] = useState<VenueDetail[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);

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
      setOrganizerSocialLinks(Array.isArray(customData.organizer_social_links) ? customData.organizer_social_links as unknown as SocialLink[] : []);
      setThemeAccent(customData.theme_accent || "lime");
      setVenueDetails(Array.isArray(customData.venue_details) ? customData.venue_details as unknown as VenueDetail[] : []);
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
        organizer_contact_name: organizerContactName || null,
        organizer_contact_email: organizerContactEmail || null,
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
      mapEmbed, venuePhotoUrl, sponsors, policiesText, organizerContactName, 
      organizerContactEmail, organizerSocialLinks, themeAccent, venueDetails]);

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
                      className="prose prose-sm max-w-none"
                    >
                      {aboutMarkdown ? (
                        <ReactMarkdown>{aboutMarkdown}</ReactMarkdown>
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

          <TabsContent value="venue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Venue Information</CardTitle>
                <CardDescription>Map, photos, and details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="mapEmbed">Map Embed Code</Label>
                  <Textarea
                    id="mapEmbed"
                    value={mapEmbed}
                    onChange={(e) => setMapEmbed(e.target.value)}
                    placeholder="Paste Google Maps embed code or iframe..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Venue Photo</Label>
                  <div className="flex gap-4 items-start mt-2">
                    {venuePhotoUrl && (
                      <img src={venuePhotoUrl} alt="Venue" className="w-32 h-20 object-cover rounded" />
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setVenuePhotoUrl)}
                        disabled={uploading}
                      />
                      {venuePhotoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVenuePhotoUrl("")}
                          className="mt-2"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove Photo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Venue Details</Label>
                  <div className="space-y-2 mt-2">
                    {venueDetails.map((detail, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Icon (emoji)"
                          value={detail.icon}
                          onChange={(e) => updateVenueDetail(index, "icon", e.target.value)}
                          className="w-20"
                        />
                        <Input
                          placeholder="Detail text"
                          value={detail.text}
                          onChange={(e) => updateVenueDetail(index, "text", e.target.value)}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addVenueDetail}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Detail
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sponsors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sponsors & Partners</CardTitle>
                <CardDescription>Up to 4 sponsors (logos will auto-scale)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sponsors.map((sponsor, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Sponsor {index + 1}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSponsor(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {sponsor.logo_url && (
                      <img src={sponsor.logo_url} alt="Sponsor" className="w-32 h-16 object-contain bg-white rounded border" />
                    )}
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
                          } catch (error) {
                            toast.error("Failed to upload logo");
                          } finally {
                            setUploading(false);
                          }
                        }
                      }}
                      disabled={uploading}
                    />
                    <Input
                      placeholder="Website URL (optional)"
                      value={sponsor.link || ""}
                      onChange={(e) => updateSponsor(index, "link", e.target.value)}
                    />
                  </div>
                ))}
                {sponsors.length < 4 && (
                  <Button onClick={addSponsor} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sponsor
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Policies & Legal</CardTitle>
                <CardDescription>This text will be shown publicly and included in confirmation emails</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={policiesText}
                  onChange={(e) => setPoliciesText(e.target.value)}
                  placeholder="Refund policy, cancellation terms, code of conduct, liability waiver..."
                  rows={10}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organizer Contact</CardTitle>
                <CardDescription>How players can reach you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={organizerContactName}
                    onChange={(e) => setOrganizerContactName(e.target.value)}
                    placeholder="Tournament Director Name"
                  />
                </div>

                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={organizerContactEmail}
                    onChange={(e) => setOrganizerContactEmail(e.target.value)}
                    placeholder="contact@example.com"
                  />
                </div>

                <div>
                  <Label>Social Links</Label>
                  <div className="space-y-2 mt-2">
                    {organizerSocialLinks.map((link, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Platform (e.g. Instagram)"
                          value={link.label}
                          onChange={(e) => updateSocialLink(index, "label", e.target.value)}
                          className="flex-1"
                        />
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
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Social Link
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
