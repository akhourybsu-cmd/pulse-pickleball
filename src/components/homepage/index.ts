export { HomepageNav } from "./HomepageNav";
export { HeroSection } from "./HeroSection";
export { PlayerFeaturesSection } from "./PlayerFeaturesSection";
export { FeatureSpotlights } from "./FeatureSpotlights";
export { HowItWorksSection } from "./HowItWorksSection";
export { SplitCTASection } from "./SplitCTASection";
export { HomepageFooter } from "./HomepageFooter";
// QuickActionTiles retired from the composition — on a logged-out page its
// tiles all just routed to /auth (and one to a sunsetted /round-robin
// route). The feature grid + spotlights carry the story now. Source file
// retained but no longer exported.
// TrustBandSection removed — displayed fabricated metrics that didn't
// reflect real data. DualLaneSection + TournamentSpotlight removed
// during the player-first refocus. Source files retained for potential
// rollback; orphaned and tree-shaken out of the build.
