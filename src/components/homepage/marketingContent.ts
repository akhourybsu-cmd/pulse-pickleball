export const SIGNUP_URL = "/auth?mode=signup";
export const MARKETING_TITLE = "PULSE — Your pickleball game, people, and plans";
export const MARKETING_DESCRIPTION = "Record matches, follow your PULSE rating, connect with friends, and organize round robins and leagues. Your pickleball life, together on mobile and desktop.";

// Discovery and community require authentication. Public navigation explains
// the product instead of suggesting those routes support logged-out browsing.
export const marketingLinks = [
  { label: "The app", href: "/#features" },
  { label: "For organizers", href: "/#organizers" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQs", href: "/#questions" },
] as const;

export const marketingFAQs = [
  { question: "Who is PULSE for?", answer: "PULSE is for pickleball players at any level, from a first-time player finding a crew to the person organizing weekly games. Use it to record matches, connect with people, and participate in or host organized play." },
  { question: "Is PULSE free to join?", answer: "Yes. You can create a player account for free without a credit card. Some organizer features and events may have separate costs; check the details in the app before purchasing or registering." },
  { question: "Do I need to download an app?", answer: "You can use PULSE directly in your phone, tablet, or desktop browser. Sign in with the same account to access your profile, matches, and communities across devices." },
  { question: "What is a PULSE rating?", answer: "Your PULSE rating helps you follow your skill within PULSE. Eligible, verified match results contribute to it, and it can move up or down as you play. It is a PULSE rating, not an official DUPR rating." },
  { question: "Can I bring my existing group?", answer: "Absolutely. Connect with your friends, create a community group, or invite players into a league. Round-robin hosts can also add guest players who don't have a PULSE account." },
] as const;
