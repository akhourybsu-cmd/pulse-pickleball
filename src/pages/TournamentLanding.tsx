import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  TournamentPublicHeader,
  TournamentHeroSection,
  TournamentQuickFacts,
  TournamentDivisionsGrid,
  TournamentVenueModule,
  TournamentSocialProof,
  TournamentPoliciesAccordion,
  TournamentContactCard,
  TournamentStickyBar,
  TournamentFooterCTA,
  TournamentAboutSection,
  TournamentSponsorsGrid,
} from "@/components/tournament/landing";

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
  refund_policy?: string | null;
  weather_policy?: string | null;
  conduct_policy?: string | null;
  liability_policy?: string | null;
  extra_notes?: string | null;
  organizer_phone?: string | null;
  organizer_preferred_contact?: string | null;
  organizer_message?: string | null;
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

  const handleRegister = () => {
    if (event) {
      navigate(`/tournament/${event.id}/register`);
    }
  };

  // Check if registration is closed
  const isClosed = event?.registration_close_date 
    ? new Date(event.registration_close_date) < new Date() 
    : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20 text-center">
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
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl font-bold mb-4">{event.name}</h1>
          <p className="text-xl text-muted-foreground mb-2">
            {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
          </p>
          <p className="text-lg text-muted-foreground mb-8">{event.location}</p>
          <p className="text-xl mb-8">Registration opens soon!</p>
          <Button size="lg" onClick={() => navigate(userId ? "/player/dashboard" : "/auth")}>
            {userId ? "Go to Dashboard" : "Create Your Pulse Player Profile"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Public Header */}
      <TournamentPublicHeader 
        tournamentName={event.name}
        onShare={handleShare}
      />

      {/* Immersive Hero Section */}
      <TournamentHeroSection
        event={event}
        customization={customization}
        onRegister={handleRegister}
        onShare={handleShare}
      />

      {/* Quick Facts Grid */}
      <TournamentQuickFacts event={event} />

      {/* About Section */}
      {customization?.about_markdown && (
        <TournamentAboutSection 
          content={customization.about_markdown}
          imageUrl={customization.about_image_url}
        />
      )}

      {/* Divisions with Urgency */}
      {event.divisions && event.divisions.length > 0 && (
        <TournamentDivisionsGrid 
          divisions={event.divisions}
          eventId={event.id}
        />
      )}

      {/* Venue Experience */}
      <TournamentVenueModule
        location={event.location}
        mapEmbed={customization?.map_embed || null}
        venuePhotoUrl={customization?.venue_photo_url || null}
        venueDetails={customization?.venue_details || null}
      />

      {/* Social Proof */}
      <TournamentSocialProof 
        eventId={event.id}
        eventName={event.name}
        startDate={event.start_date}
        onShare={handleShare}
      />

      {/* Sponsors */}
      <TournamentSponsorsGrid sponsors={customization?.sponsors} />

      {/* Policies Accordion */}
      <TournamentPoliciesAccordion
        refundPolicy={customization?.refund_policy}
        weatherPolicy={customization?.weather_policy}
        conductPolicy={customization?.conduct_policy}
        liabilityPolicy={customization?.liability_policy}
        extraNotes={customization?.extra_notes}
        policiesText={customization?.policies_text}
      />

      {/* Contact Card */}
      <TournamentContactCard
        organizerName={customization?.organizer_contact_name}
        organizerEmail={customization?.organizer_contact_email}
        organizerPhone={customization?.organizer_phone}
        organizerMessage={customization?.organizer_message}
        preferredContact={customization?.organizer_preferred_contact}
        socialLinks={customization?.organizer_social_links}
      />

      {/* Footer CTA */}
      <TournamentFooterCTA 
        userId={userId}
        eventId={event.id}
        isClosed={isClosed}
      />

      {/* Sticky Registration Bar */}
      <TournamentStickyBar
        eventName={event.name}
        fee={event.registration_fee}
        onRegister={handleRegister}
        disabled={isClosed}
      />
    </div>
  );
}
