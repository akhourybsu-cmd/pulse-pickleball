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
import { toast } from "sonner";
import { ExternalLink, Upload, X, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

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

      toast.success("Changes saved successfully");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    const newPublishedState = !isPublished;
    setIsPublished(newPublishedState);
    
    if (customizationId) {
      await supabase
        .from("tournament_customization")
        .update({ is_published: newPublishedState })
        .eq("id", customizationId);
      
      toast.success(newPublishedState ? "Page published!" : "Page unpublished");
    }
  };

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
          <h1 className="text-4xl font-bold mb-2">Customize Public Tournament Page</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Your changes control what players see before they register.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => window.open(publicUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview Public Page
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                checked={isPublished}
                onCheckedChange={handlePublishToggle}
              />
              <Label>{isPublished ? "Published" : "Unpublished"}</Label>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
          {isPublished && (
            <p className="mt-4 text-sm text-muted-foreground">
              Public URL: <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{publicUrl}</a>
            </p>
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

          <TabsContent value="hero" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Hero & Branding</CardTitle>
                <CardDescription>Customize the hero banner and main visual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Hero Banner Image</Label>
                  <div className="flex gap-4 items-start mt-2">
                    {heroImageUrl && (
                      <img src={heroImageUrl} alt="Hero" className="w-32 h-20 object-cover rounded" />
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setHeroImageUrl)}
                        disabled={uploading}
                      />
                      {heroImageUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHeroImageUrl("")}
                          className="mt-2"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove Image
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Short tagline for your event"
                  />
                </div>

                <div>
                  <Label>Accent / Overlay</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    {[
                      { value: "none", label: "None", bg: "bg-gradient-to-br from-primary to-accent" },
                      { value: "lime", label: "Lime", bg: "bg-gradient-to-br from-lime-400 to-lime-600" },
                      { value: "teal", label: "Teal", bg: "bg-gradient-to-br from-teal-600 to-teal-800" },
                      { value: "dark-teal-overlay", label: "Dark Overlay", bg: "bg-gradient-to-b from-gray-900/20 to-gray-900/60" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setHeroOverlayColor(option.value)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          heroOverlayColor === option.value ? "border-primary" : "border-border"
                        }`}
                      >
                        <div className={`w-full h-12 rounded ${option.bg} mb-2`} />
                        <p className="text-sm font-medium">{option.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Theme Accent</Label>
                  <div className="flex gap-4 mt-2">
                    {["lime", "teal", "dark-teal", "light-card"].map((accent) => (
                      <button
                        key={accent}
                        onClick={() => setThemeAccent(accent)}
                        className={`px-4 py-2 rounded border-2 transition-all ${
                          themeAccent === accent ? "border-primary" : "border-border"
                        }`}
                      >
                        {accent}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>About the Event</CardTitle>
                <CardDescription>Write a compelling description</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="aboutMarkdown">About Text (Markdown supported)</Label>
                  <Textarea
                    id="aboutMarkdown"
                    value={aboutMarkdown}
                    onChange={(e) => setAboutMarkdown(e.target.value)}
                    placeholder="Tell players about your tournament..."
                    rows={10}
                  />
                </div>

                <div>
                  <Label>About Image (optional)</Label>
                  <div className="flex gap-4 items-start mt-2">
                    {aboutImageUrl && (
                      <img src={aboutImageUrl} alt="About" className="w-32 h-20 object-cover rounded" />
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setAboutImageUrl)}
                        disabled={uploading}
                      />
                      {aboutImageUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAboutImageUrl("")}
                          className="mt-2"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove Image
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
