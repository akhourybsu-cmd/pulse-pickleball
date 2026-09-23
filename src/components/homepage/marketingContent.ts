import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';

export const SIGNUP_URL = "/auth?mode=signup";
export const MARKETING_TITLE = "PULSE — Your pickleball game, people, and plans";
export const MARKETING_DESCRIPTION = "Record matches, follow your PULSE rating, connect with friends, and organize round robins and leagues. Your pickleball life, together on mobile and desktop.";

// Discovery and community require authentication. Public navigation explains
// the product instead of suggesting those routes support logged-out browsing.
export const marketingLinks = [
  { label: "The app", href: "/#features" },
  ...(isSkillAssessmentEnabled() ? [{ label: 'Skill assessment', href: '/skill-assessment?source=nav' }] : []),
  { label: "For organizers", href: "/#organizers" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQs", href: "/#questions" },
] as const;

export const marketingFAQs = [
  ...(isSkillAssessmentEnabled() ? [{ question: 'Can I see my skill analysis before joining?', answer: 'Yes. Take the visual self-assessment and read the complete analysis without an account. Create a free account when you want to keep it and build your assessment history. Guest answers stay temporarily in the same browser for up to 7 days. The estimate is provisional and separate from your match-based rating.' }] : []),
  { question: "Who is PULSE for?", answer: "PULSE is for pickleball players at any level, from a first-time player finding a crew to the person organizing weekly games. Use it to record matches, connect with people, and participate in or host organized play." },
  { question: "Is PULSE free to join?", answer: "Yes. You can create a player account for free without a credit card. Some organizer features and events may have separate costs; check the details in the app before purchasing or registering." },
  { question: "Do I need to download an app?", answer: "You can use PULSE directly in your phone, tablet, or desktop browser. Sign in with the same account to access your profile, matches, and communities across devices." },
  { question: "What is a PULSE rating?", answer: "Your PULSE rating helps you follow your skill within PULSE. Eligible, verified match results contribute to it, and it can move up or down as you play. It is a PULSE rating, not an official DUPR rating." },
  { question: "Can I bring my existing group?", answer: "Absolutely. Connect with your friends, create a community group, or invite players into a league. Round-robin hosts can also add guest players who don't have a PULSE account." },
] as const;
