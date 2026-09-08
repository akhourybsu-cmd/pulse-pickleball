import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PageSEO } from "@/components/seo/PageSEO";
import { HomepageNav } from "./HomepageNav";
import { HeroSection } from "./HeroSection";
import { PlayerFeaturesSection } from "./PlayerFeaturesSection";
import { FeatureSpotlights } from "./FeatureSpotlights";
import { HowItWorksSection } from "./HowItWorksSection";
import { FAQSection } from "./FAQSection";
import { SplitCTASection } from "./SplitCTASection";
import { HomepageFooter } from "./HomepageFooter";
import { MARKETING_DESCRIPTION, MARKETING_TITLE, marketingLinks } from "./marketingContent";

/** Public presentation only. Index retains session and deep-link redirects. */
export const PublicHomepage = () => {
  const { hash } = useLocation();
  useEffect(() => {
    // Cross-page anchors can arrive before Index's session check finishes.
    // Scroll when the section exists, without moving keyboard focus.
    if (marketingLinks.some(link => link.href === `/${hash}`)) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [hash]);

  return <div className="mkt-page">
    <PageSEO title={MARKETING_TITLE} description={MARKETING_DESCRIPTION} path="/" />
    <a className="mkt-skip-link" href="#main-content">Skip to content</a>
    <HomepageNav isLoggedIn={false} userMode="player" />
    <main id="main-content" tabIndex={-1}>
      <HeroSection /><PlayerFeaturesSection /><FeatureSpotlights /><HowItWorksSection /><FAQSection /><SplitCTASection />
    </main>
    <HomepageFooter />
  </div>;
};
