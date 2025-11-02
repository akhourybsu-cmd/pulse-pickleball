import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Share2, DollarSign, Clock, Trophy, ExternalLink, Mail, Phone, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import ReactMarkdown from "react-markdown";

interface TournamentCustomization {
  id: string;
  event_id: string;
  is_published: boolean;
  hero_image_url: string | null;
  hero_overlay_color: string | null;
  tagline: string | null;
  about_markdown: string | null;
  about_image_url: string | null;
  map_embed: string | null;
  venue_photo_url: string | null;
  sponsors: any;
  policies_text: string | null;
  organizer_contact_name: string | null;
  organizer_contact_email: string | null;
  organizer_social_links: any;
  theme_accent: string;
  venue_details: any;
}

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string;
  start_date: string;
  end_date: string;
  status: string;
  registration_open_date: string | null;
  registration_close_date: string | null;
  registration_fee: number;
  divisions?: Array<{
    id: string;
    name: string;
    format: string;
    max_teams: number | null;
    description: string | null;
  }>;
}

export default function TournamentLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [customization, setCustomization] = useState<TournamentCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchTournamentData();
  }, [slug]);

  const fetchTournamentData = async () => {
    if (!slug) return;

    // Fetch event data
    const { data: eventData, error: eventError } = await supabase
      .from("tournaments_events")
      .select(`
        *,
        divisions:tournaments_divisions(id, name, format, max_teams, description)
      `)
      .eq("id", slug)
      .eq("public_view_enabled", true)
      .single();

    if (eventError || !eventData) {
      console.error("Error fetching event:", eventError);
      setLoading(false);
      return;
    }

    setEvent(eventData);

    // Fetch customization data
    const { data: customData, error: customError } = await supabase
      .from("tournament_customization")
      .select("*")
      .eq("event_id", slug)
      .eq("is_published", true)
      .single();

    if (!customError && customData) {
      setCustomization(customData);
    }

    setLoading(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.name,
          text: customization?.tagline || event?.description || "",
          url: url,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  const getStatusBadge = () => {
    const now = new Date();
    const closeDate = event?.registration_close_date ? new Date(event.registration_close_date) : null;

    if (closeDate && closeDate < now) {
      return <Badge variant="outline">Closed</Badge>;
    }
    return <Badge className="bg-green-600 text-white shadow-[0_0_6px_rgba(34,197,94,0.6)]">Open</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-xl text-muted-foreground">Loading tournament...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader userId={userId} />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Tournament Not Found</h1>
          <p className="text-xl text-muted-foreground mb-8">
            This tournament page is not available yet. Check back soon!
          </p>
          <Button onClick={() => navigate("/tournaments")}>
            Browse All Tournaments
          </Button>
        </div>
      </div>
    );
  }

  if (!customization?.is_published) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader userId={userId} />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">{event.name}</h1>
          <p className="text-xl text-muted-foreground mb-2">
            {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
          </p>
          <p className="text-lg text-muted-foreground mb-8">{event.location}</p>
          <p className="text-xl mb-8">Registration opens soon!</p>
          <Button size="lg" onClick={() => navigate(userId ? "/dashboard" : "/auth")}>
            {userId ? "Go to Dashboard" : "Create Your Pulse Player Profile"}
          </Button>
        </div>
      </div>
    );
  }

  const overlayGradient = customization.hero_overlay_color === 'dark-teal-overlay' 
    ? 'linear-gradient(to bottom, rgba(14,57,68,0.2), rgba(14,57,68,0.6))'
    : customization.hero_overlay_color === 'teal'
    ? 'linear-gradient(135deg, rgba(14,57,68,0.8), rgba(14,57,68,0.9))'
    : 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.3))';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={userId} />

      {/* SECTION 1: HERO BANNER */}
      <section className="relative min-h-[500px] flex items-center justify-center overflow-hidden">
        {customization.hero_image_url ? (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${customization.hero_image_url})`,
              transform: 'translateZ(0)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent" />
        )}
        
        <div 
          className="absolute inset-0"
          style={{ background: overlayGradient }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="container mx-auto px-4 relative z-10"
        >
          <Card className="max-w-3xl mx-auto bg-background/90 backdrop-blur-sm border-t-4 border-t-primary shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <CardTitle className="text-4xl md:text-5xl font-bold">
                  {event.name}
                </CardTitle>
                {getStatusBadge()}
              </div>
              {customization.tagline && (
                <p className="text-xl text-muted-foreground">{customization.tagline}</p>
              )}
              <div className="space-y-2 pt-4">
                <div className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
                </div>
                <div className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  {event.location}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button 
                size="lg"
                className="flex-1 hover:shadow-[0_0_20px_rgba(197,232,108,0.5)] hover:scale-[1.02] transition-all duration-200"
                onClick={() => navigate(`/tournament/${event.id}/register`)}
              >
                Register Team
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleShare}
                className="hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              >
                <Share2 className="h-5 w-5" />
                Share
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* SECTION 2: ABOUT THE EVENT */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="text-3xl font-bold mb-6">About This Tournament</h2>
              {customization.about_markdown ? (
                <div className="prose prose-lg max-w-none">
                  <ReactMarkdown>{customization.about_markdown}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-lg text-muted-foreground">{event.description}</p>
              )}
              {customization.about_image_url && (
                <img 
                  src={customization.about_image_url} 
                  alt="About" 
                  className="mt-6 rounded-lg shadow-md w-full"
                />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card className="hover:shadow-[0_0_18px_rgba(197,232,108,0.3)] transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl">Quick Facts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">Location</p>
                      <p className="text-muted-foreground">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">Dates</p>
                      <p className="text-muted-foreground">
                        {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {event.registration_fee > 0 && (
                    <div className="flex items-start gap-3">
                      <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-semibold">Entry Fee</p>
                        <p className="text-muted-foreground">${event.registration_fee}</p>
                      </div>
                    </div>
                  )}
                  {event.divisions && event.divisions.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-semibold">Divisions</p>
                        <p className="text-muted-foreground">
                          {event.divisions.length} {event.divisions.length === 1 ? "Division" : "Divisions"}
                        </p>
                      </div>
                    </div>
                  )}
                  {event.registration_close_date && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-semibold">Registration Deadline</p>
                        <p className="text-muted-foreground">
                          {format(new Date(event.registration_close_date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Trophy className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">Format</p>
                      <p className="text-muted-foreground">
                        {event.divisions?.[0]?.format || "Round Robin"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 3: DIVISIONS & FORMATS */}
      {event.divisions && event.divisions.length > 0 && (
        <section className="py-16 px-4 bg-secondary/20">
          <div className="container mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-center mb-12"
            >
              Divisions & Formats
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {event.divisions.map((division, index) => (
                <motion.div
                  key={division.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <Card className="h-full hover:border-primary hover:shadow-[0_0_18px_rgba(197,232,108,0.45)] transition-all duration-300 cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-xl">{division.name}</CardTitle>
                      <Badge variant="secondary" className="w-fit">{division.format}</Badge>
                      {division.description && (
                        <CardDescription className="mt-2">{division.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {division.max_teams && (
                        <p className="text-sm text-muted-foreground">
                          Max {division.max_teams} teams
                        </p>
                      )}
                      <Button 
                        className="w-full hover:shadow-[0_0_15px_rgba(197,232,108,0.5)] transition-all"
                        onClick={() => navigate(`/tournament/${event.id}/register?division=${division.id}`)}
                      >
                        Register in this Division
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4: VENUE & MAP */}
      {(customization.map_embed || customization.venue_photo_url || customization.venue_details) && (
        <section className="py-16 px-4 bg-[hsl(var(--secondary))] text-secondary-foreground">
          <div className="container mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-center mb-12"
            >
              <span className="border-b-4 border-primary pb-2">Venue Information</span>
            </motion.h2>
            <div className="grid md:grid-cols-2 gap-12">
              {customization.map_embed && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="rounded-lg overflow-hidden shadow-lg"
                >
                  <div 
                    dangerouslySetInnerHTML={{ __html: customization.map_embed }}
                    className="w-full h-[400px]"
                  />
                </motion.div>
              )}
              {(customization.venue_photo_url || customization.venue_details) && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="space-y-6"
                >
                  {customization.venue_photo_url && (
                    <img 
                      src={customization.venue_photo_url}
                      alt="Venue"
                      className="rounded-lg shadow-lg w-full"
                    />
                  )}
                  {customization.venue_details && customization.venue_details.length > 0 && (
                    <div className="space-y-3">
                      {customization.venue_details.map((detail, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-primary">✓</span>
                          <p className="text-lg">{detail.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4.5: POLICIES */}
      {customization && (
        (customization as any).refund_policy ||
        (customization as any).weather_policy ||
        (customization as any).conduct_policy ||
        (customization as any).liability_policy ||
        (customization as any).extra_notes
      ) && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="relative py-20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background" />
          <div className="relative max-w-4xl mx-auto px-6">
            <div className="text-center space-y-3 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Policies & Player Agreement
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Please review these policies before registering
              </p>
            </div>

            <Card className="rounded-2xl border-2 border-border shadow-lg">
              <CardContent className="p-8 space-y-8">
                {(customization as any).refund_policy && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-primary flex items-center gap-2">
                      Refund Policy
                    </h3>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {(customization as any).refund_policy}
                    </p>
                  </div>
                )}

                {(customization as any).weather_policy && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-primary flex items-center gap-2">
                      Weather / Cancellation
                    </h3>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {(customization as any).weather_policy}
                    </p>
                  </div>
                )}

                {(customization as any).conduct_policy && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-primary flex items-center gap-2">
                      Player Conduct & Sportsmanship
                    </h3>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {(customization as any).conduct_policy}
                    </p>
                  </div>
                )}

                {(customization as any).liability_policy && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-primary flex items-center gap-2">
                      Liability & Waiver
                    </h3>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {(customization as any).liability_policy}
                    </p>
                  </div>
                )}

                {(customization as any).extra_notes && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-primary flex items-center gap-2">
                      Additional Notes
                    </h3>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {(customization as any).extra_notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.section>
      )}

      {/* SECTION 5: SPONSORS */}
      {customization.sponsors && Array.isArray(customization.sponsors) && customization.sponsors.filter(s => s.logo_url || s.name).length > 0 && (
        <section className="py-16 px-4 bg-gradient-to-br from-background via-muted/10 to-background">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold mb-3">Proudly Supported By</h2>
              <p className="text-muted-foreground text-lg">These partners help bring this event to life.</p>
            </motion.div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {customization.sponsors
                .filter(sponsor => sponsor.logo_url || sponsor.name)
                .map((sponsor, index) => {
                  const Component = sponsor.link ? motion.a : motion.div;
                  
                  // Ensure URL has proper protocol
                  let sponsorUrl = sponsor.link || '';
                  if (sponsorUrl && !sponsorUrl.match(/^https?:\/\//i)) {
                    sponsorUrl = 'https://' + sponsorUrl;
                  }
                  
                  const linkProps = sponsor.link ? {
                    href: sponsorUrl,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    "aria-label": `Visit ${sponsor.name || 'sponsor'} website`
                  } : {};

                  return (
                    <Component
                      key={index}
                      {...linkProps}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      whileHover={{ 
                        y: -4,
                        boxShadow: "0 8px 24px rgba(197,232,108,0.35)"
                      }}
                      className={`group relative bg-background rounded-2xl p-6 border-2 border-border hover:border-primary/40 transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[180px] shadow-md hover:shadow-lg ${sponsor.link ? 'cursor-pointer' : ''}`}
                    >
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {sponsor.logo_url && (
                        <div className="relative z-10 mb-4 flex items-center justify-center h-20">
                          <img 
                            src={sponsor.logo_url}
                            alt={sponsor.name || "Sponsor logo"}
                            className="max-h-full max-w-[160px] object-contain"
                          />
                        </div>
                      )}
                      
                      {sponsor.name && (
                        <p className="relative z-10 font-bold text-sm text-foreground mb-1">
                          {sponsor.name}
                        </p>
                      )}
                      
                      {sponsor.tagline && (
                        <p className="relative z-10 text-xs text-muted-foreground">
                          {sponsor.tagline}
                        </p>
                      )}
                      
                      {sponsor.link && (
                        <p className="relative z-10 text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
                          Visit site <ExternalLink className="h-3 w-3" />
                        </p>
                      )}
                    </Component>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 6: CONTACT */}
      {customization && (customization.organizer_contact_name || customization.organizer_contact_email || (customization as any).organizer_phone) && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="relative py-20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/10 to-background" />
          <div className="relative max-w-3xl mx-auto px-6">
            <div className="text-center space-y-3 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Contact the Organizer
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Have questions about registration, scheduling, or venue details? Reach out below.
              </p>
            </div>

            <Card className="rounded-2xl border-2 border-primary/20 shadow-xl hover:shadow-2xl transition-shadow duration-300">
              <CardContent className="p-8 space-y-6">
                {customization.organizer_contact_name && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{customization.organizer_contact_name}</p>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {customization.organizer_contact_email && (
                    <a
                      href={`mailto:${customization.organizer_contact_email}`}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200 group ${
                        (customization as any).organizer_preferred_contact === 'email'
                          ? 'border-primary bg-primary/5 hover:bg-primary/10'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                      aria-label={`Send email to ${customization.organizer_contact_name || 'organizer'}`}
                    >
                      <Mail className={`h-5 w-5 ${
                        (customization as any).organizer_preferred_contact === 'email' ? 'text-primary' : 'text-muted-foreground'
                      } group-hover:text-primary transition-colors`} />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">{customization.organizer_contact_email}</p>
                        {(customization as any).organizer_preferred_contact === 'email' && (
                          <p className="text-xs text-primary font-semibold">Preferred contact method</p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  )}

                  {(customization as any).organizer_phone && (
                    <a
                      href={`tel:${(customization as any).organizer_phone}`}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200 group ${
                        (customization as any).organizer_preferred_contact === 'phone'
                          ? 'border-primary bg-primary/5 hover:bg-primary/10'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                      aria-label={`Call ${customization.organizer_contact_name || 'organizer'}`}
                    >
                      <Phone className={`h-5 w-5 ${
                        (customization as any).organizer_preferred_contact === 'phone' ? 'text-primary' : 'text-muted-foreground'
                      } group-hover:text-primary transition-colors`} />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">{(customization as any).organizer_phone}</p>
                        {(customization as any).organizer_preferred_contact === 'phone' && (
                          <p className="text-xs text-primary font-semibold">Preferred contact method</p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </a>
                  )}
                </div>

                {(customization as any).organizer_message && (
                  <div className="pt-4 border-t">
                    <div className="flex items-start gap-3">
                      <MessageCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm italic text-muted-foreground leading-relaxed">
                        "{(customization as any).organizer_message}"
                      </p>
                    </div>
                  </div>
                )}

                {Array.isArray(customization.organizer_social_links) && customization.organizer_social_links.length > 0 && (
                  <div className="pt-6 border-t">
                    <p className="text-sm font-semibold mb-4 text-center">Follow us</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {customization.organizer_social_links.map((link, i) => (
                        <motion.a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.05, y: -2 }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                          aria-label={`Open ${link.label}`}
                        >
                          <span className="font-medium text-sm">{link.label}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.section>
      )}

      {/* OLD POLICIES & CONTACT SECTION - Remove this */}
      <section className="py-16 px-4 bg-secondary/20">
        <div className="container mx-auto max-w-4xl space-y-12">
          {customization.policies_text && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold mb-6">Policies & Player Info</h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="prose prose-lg max-w-none whitespace-pre-wrap">
                    {customization.policies_text}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </section>

      {/* PULSE CTA FOOTER */}
      <section className="py-16 px-4 bg-gradient-to-r from-primary via-accent to-primary text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 animate-[gradient_8s_ease_infinite] bg-[length:200%_100%]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="container mx-auto max-w-2xl space-y-6 relative z-10"
        >
          <h2 className="text-5xl font-bold drop-shadow-lg">Ready to Rally?</h2>
          <p className="text-xl text-white/90">
            Create your free Pulse player profile to register, save your history, and get match updates.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300 text-lg px-12"
              onClick={() => navigate(userId ? "/dashboard" : "/auth")}
            >
              {userId ? "Go to Dashboard" : "Join Pulse Free"}
            </Button>
            {!userId && (
              <button
                onClick={() => navigate("/auth")}
                className="text-white/90 hover:text-white underline transition-colors text-lg"
              >
                I Already Have an Account
              </button>
            )}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
