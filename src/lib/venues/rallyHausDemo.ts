import { addDays } from "date-fns";
import { venueCalendarNow, venueWallTime } from "./timezone";

export const RALLY_HAUS_VENUE_ID = "d99d7de3-2431-4ee2-a826-04cc293da1cd";
export const RALLY_HAUS_GROUP_ID = "d5b47d17-d217-441a-a62a-bcdd87307d62";
export const DEMO_TIME_ZONE = "America/New_York";

/** Only the explicitly requested venue gets the showcase. Live tools remain at ?demo=off. */
export function isRallyHausDemo(
  venueId: string | null | undefined,
  groupId: string,
  params: URLSearchParams
) {
  return (
    venueId === RALLY_HAUS_VENUE_ID &&
    groupId === RALLY_HAUS_GROUP_ID &&
    params.get("demo") !== "off"
  );
}

export const demoPhotos = [
  {
    id: "aerial",
    title: "Room for another game",
    alt: "Sunlight and shadows across a net on an outdoor court",
    author: "Frankie Lopez",
    source: "dA68yigQgSQ",
  },
  {
    id: "doubles",
    title: "Find your next rally",
    alt: "Pickleball player preparing a forehand on an outdoor court",
    author: "Jon Matthews",
    source: "FVhXFRkLcpA",
  },
  {
    id: "paddles",
    title: "Better together",
    alt: "Two players touching pickleball paddles together",
    author: "LUXE Pickleball",
    source: "VTKZwNXhaSc",
  },
  {
    id: "match",
    title: "A little friendly competition",
    alt: "Pickleball paddle and ball leaning against a court net",
    author: "Jon Matthews",
    source: "F57rci4H74E",
  },
  {
    id: "court",
    title: "Meet at the kitchen",
    alt: "Player holding a paddle and ball beside a court net",
    author: "Alex Saks",
    source: "kjJIswOh1ys",
  },
  {
    id: "action",
    title: "Keep the point alive",
    alt: "Black pickleball paddle resting over a yellow ball on a blue court",
    author: "Jon Matthews",
    source: "ajk3K-zgiPU",
  },
  {
    id: "courts",
    title: "Ready for your first game",
    alt: "Red pickleball paddle and yellow balls beside a net",
    author: "Brendan Sapp",
    source: "l5UX-BuRc3E",
  },
  {
    id: "community",
    title: "Every point starts here",
    alt: "Yellow pickleball resting on blue and green court lines",
    author: "Laura Tang",
    source: "9AwSPN41C8U",
  },
  {
    id: "play",
    title: "Bring a friend",
    alt: "Two blue paddles and yellow pickleballs leaning against a net",
    author: "Alex Saks",
    source: "KO6QJcddk28",
  },
  {
    id: "rally",
    title: "One more game",
    alt: "Pickleball and paddles in warm light",
    author: "Ben Hershey",
    source: "J0OKd9h_aLQ",
  },
] as const;
export type DemoPhoto = (typeof demoPhotos)[number];
export const demoPhotoUrl = (id: string) => `/demo/rally-haus/${id}.webp`;
export type DemoCategory =
  | "open_play"
  | "clinic"
  | "lesson"
  | "practice"
  | "league"
  | "tournament"
  | "round_robin"
  | "social"
  | "junior"
  | "special";
export const categoryLabels: Record<DemoCategory, string> = {
  open_play: "Open play",
  clinic: "Clinic",
  lesson: "Private lesson",
  practice: "Practice",
  league: "League",
  tournament: "Tournament",
  round_robin: "Round robin",
  social: "Social",
  junior: "Juniors",
  special: "Special event",
};
export interface DemoProgram {
  id: string;
  title: string;
  category: DemoCategory;
  image: string;
  level: string;
  price: number;
  capacity: number;
  attending: number;
  minutes: number;
  time: number;
  description: string;
  includes: string[];
  courts: string;
}

// Entirely fictional programming, prices and availability. No real player records.
export const demoPrograms: DemoProgram[] = [
  {
    id: "morning",
    title: "Rise & Rally Open Play",
    category: "open_play",
    image: "court",
    level: "All levels",
    price: 12,
    capacity: 24,
    attending: 18,
    time: 8 * 60,
    minutes: 120,
    courts: "Courts 1–3",
    description:
      "Start the day with easygoing doubles and fresh partners. Come solo or bring a friend; the host keeps everyone rotating and the games moving.",
    includes: [
      "Paddle-stack rotation",
      "Balls provided",
      "A host to help you find a game",
    ],
  },
  {
    id: "first-rally",
    title: "Your First Rally",
    category: "clinic",
    image: "courts",
    level: "New players · 2.0–2.5",
    price: 0,
    capacity: 12,
    attending: 8,
    time: 10 * 60,
    minutes: 60,
    courts: "Court 4",
    description:
      "Never picked up a paddle? Start here. Learn the serve, the kitchen and how scoring works, then play your first friendly game.",
    includes: ["Loaner paddle", "Small-group instruction", "Guided first game"],
  },
  {
    id: "dink",
    title: "Dinks, Drops & Resets",
    category: "clinic",
    image: "doubles",
    level: "Intermediate · 3.0–3.5",
    price: 28,
    capacity: 8,
    attending: 6,
    time: 12 * 60,
    minutes: 90,
    courts: "Court 4",
    description:
      "Build a calmer soft game. Work through cooperative dinks, third-shot drops and resets from the transition zone before putting it all into points.",
    includes: [
      "Coach-led progressions",
      "Partner drills",
      "Take-home practice plan",
    ],
  },
  {
    id: "lesson",
    title: "A Game Plan for Your Game",
    category: "lesson",
    image: "action",
    level: "All levels",
    price: 65,
    capacity: 1,
    attending: 0,
    time: 13 * 60 + 30,
    minutes: 60,
    courts: "Court 5",
    description:
      "A focused one-to-one lesson built around your next goal. Choose serve consistency, court positioning, doubles strategy or your transition game.",
    includes: [
      "Personal skill review",
      "One focused improvement",
      "Suggested next steps",
    ],
  },
  {
    id: "drill",
    title: "Drill Club: Serve + Return",
    category: "practice",
    image: "play",
    level: "Developing · 2.5–3.5",
    price: 10,
    capacity: 12,
    attending: 7,
    time: 15 * 60,
    minutes: 60,
    courts: "Courts 1–2",
    description:
      "Reps with a purpose. Follow simple partner stations for serve placement, deeper returns and recovering to the kitchen.",
    includes: [
      "Structured drill stations",
      "Practice balls",
      "Partner rotation",
    ],
  },
  {
    id: "juniors",
    title: "Junior Rally Academy",
    category: "junior",
    image: "community",
    level: "Ages 10–15 · Beginners",
    price: 18,
    capacity: 12,
    attending: 9,
    time: 16 * 60,
    minutes: 60,
    courts: "Courts 3–4",
    description:
      "Movement, teamwork and plenty of fun. A beginner-friendly junior session with paddle skills, short games and a team challenge to finish.",
    includes: [
      "Age-appropriate games",
      "Loaner equipment",
      "Parent or guardian check-in",
    ],
  },
  {
    id: "after-work",
    title: "After-Work Open Play",
    category: "open_play",
    image: "match",
    level: "Intermediate · 3.0–3.5",
    price: 15,
    capacity: 24,
    attending: 22,
    time: 17 * 60 + 30,
    minutes: 120,
    courts: "Courts 1–3",
    description:
      "Trade your desk for a doubles court. Enjoy evenly matched games, quick rotations and a welcoming host after the workday.",
    includes: [
      "Level-based games",
      "Paddle-stack rotation",
      "Two hours of play",
    ],
  },
  {
    id: "advanced",
    title: "The 4.0+ Challenge Court",
    category: "open_play",
    image: "action",
    level: "Advanced · 4.0+",
    price: 16,
    capacity: 12,
    attending: 12,
    time: 19 * 60 + 30,
    minutes: 120,
    courts: "Courts 1–2",
    description:
      "Fast points and competitive doubles for experienced players. Rotate through timed rounds with partners at a similar level.",
    includes: ["Competitive rotations", "Timed rounds", "Waitlist when full"],
  },
  {
    id: "round-robin",
    title: "Mix It Up Round Robin",
    category: "round_robin",
    image: "match",
    level: "Intermediate · 3.0–3.5",
    price: 20,
    capacity: 16,
    attending: 12,
    time: 18 * 60,
    minutes: 150,
    courts: "Courts 1–4",
    description:
      "A new partner, a new matchup, every round. Play six organized rotations and follow the leaderboard through a friendly final round.",
    includes: [
      "Six scheduled rotations",
      "Individual standings",
      "Host-led check-in",
    ],
  },
  {
    id: "league",
    title: "Rally Together Doubles League",
    category: "league",
    image: "paddles",
    level: "Intermediate · 3.0–3.5",
    price: 90,
    capacity: 24,
    attending: 18,
    time: 18 * 60 + 30,
    minutes: 120,
    courts: "Courts 1–3",
    description:
      "Six weeks of familiar faces and better doubles. Enter with a partner or use the sample free-agent option, play weekly matchups and finish with a playoff night.",
    includes: [
      "Six-week sample season",
      "Weekly standings",
      "End-of-season playoffs",
    ],
  },
  {
    id: "social",
    title: "Paddles & Pizza Social",
    category: "social",
    image: "paddles",
    level: "All levels",
    price: 22,
    capacity: 32,
    attending: 25,
    time: 18 * 60,
    minutes: 180,
    courts: "Courts 1–4 + social area",
    description:
      "Good games, good company and a slice between rounds. A relaxed mixer with short doubles games and plenty of time to meet the community.",
    includes: [
      "Hosted mixer",
      "Sample pizza package",
      "Beginner-friendly games",
    ],
  },
  {
    id: "ladder",
    title: "Climb the Ladder",
    category: "league",
    image: "doubles",
    level: "Competitive · 3.5–4.0",
    price: 75,
    capacity: 16,
    attending: 14,
    time: 18 * 60,
    minutes: 120,
    courts: "Courts 1–4",
    description:
      "A four-week individual ladder with new matchups each week. Move between courts based on results and keep working toward your next level.",
    includes: [
      "Four-week sample season",
      "Weekly court movement",
      "Individual standings",
    ],
  },
  {
    id: "tournament",
    title: "Rally Haus Weekend Classic",
    category: "tournament",
    image: "action",
    level: "3.0 / 3.5 / 4.0 divisions",
    price: 45,
    capacity: 48,
    attending: 40,
    time: 9 * 60,
    minutes: 360,
    courts: "All sample courts",
    description:
      "Make a day of it. Start with pool play, move into a medal bracket and cheer on the finals. Sample divisions include mixed, women’s and men’s doubles.",
    includes: [
      "Pool play + medal rounds",
      "Skill-based divisions",
      "Sample medal ceremony",
    ],
  },
  {
    id: "family",
    title: "Family Rally Day",
    category: "social",
    image: "play",
    level: "Families · All levels",
    price: 10,
    capacity: 24,
    attending: 14,
    time: 14 * 60,
    minutes: 120,
    courts: "Courts 3–4",
    description:
      "Bring your favorite people for a low-pressure afternoon. Try skill challenges, learn together and finish with short family doubles games.",
    includes: [
      "Family games",
      "Equipment to borrow",
      "Adults accompany juniors",
    ],
  },
  {
    id: "paddle-lab",
    title: "The Paddle Lab",
    category: "special",
    image: "rally",
    level: "All levels",
    price: 0,
    capacity: 20,
    attending: 11,
    time: 11 * 60,
    minutes: 120,
    courts: "Court 5 + welcome area",
    description:
      "Explore how weight, grip and paddle shape change the feel of your game. This sample equipment session pairs simple hitting drills with a guided gear discussion.",
    includes: [
      "Sample paddle comparison",
      "Guided hitting stations",
      "No purchase needed",
    ],
  },
  {
    id: "women",
    title: "Women’s Rally Night",
    category: "round_robin",
    image: "paddles",
    level: "Developing · 2.5–3.5",
    price: 18,
    capacity: 16,
    attending: 13,
    time: 18 * 60 + 30,
    minutes: 120,
    courts: "Courts 1–4",
    description:
      "A welcoming evening of partner rotations and supportive competition. Come on your own and leave with more people to play with.",
    includes: ["Rotating partners", "Hosted check-in", "Friendly round robin"],
  },
  {
    id: "seniors",
    title: "50+ Morning Mixer",
    category: "social",
    image: "court",
    level: "Ages 50+ · All levels",
    price: 12,
    capacity: 20,
    attending: 15,
    time: 9 * 60,
    minutes: 120,
    courts: "Courts 1–3",
    description:
      "A sociable morning with relaxed rotations and breaks between games. Choose a comfortable pace and meet your next regular doubles group.",
    includes: ["Flexible rotations", "Hosted introductions", "Social breaks"],
  },
  {
    id: "team",
    title: "Team Night at the Haus",
    category: "special",
    image: "aerial",
    level: "Teams & groups · All levels",
    price: 25,
    capacity: 32,
    attending: 20,
    time: 18 * 60,
    minutes: 180,
    courts: "All sample courts",
    description:
      "An example group event for a team outing or celebration. Learn the basics together, play a mini tournament and finish with a group social.",
    includes: ["Intro lesson", "Team mini tournament", "Sample event host"],
  },
];

export interface DemoSession extends DemoProgram {
  key: string;
  start: string;
  end: string;
  day: string;
}
export const demoDayKey = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
    day.getDate()
  ).padStart(2, "0")}`;
const weeklyEvents = [
  ["family", "paddle-lab"],
  ["round-robin"],
  ["league", "team"],
  ["ladder"],
  ["women"],
  ["social"],
  ["tournament", "seniors"],
];

export function rallyHausSchedule(now = new Date()): DemoSession[] {
  const today = venueCalendarNow(DEMO_TIME_ZONE, now);
  return Array.from({ length: 14 }, (_, offset) => {
    const day = addDays(today, offset);
    const ids = [
      ...demoPrograms.slice(0, 8).map((p) => p.id),
      ...weeklyEvents[day.getDay()],
    ];
    return ids.map((id) => {
      const program = demoPrograms.find((p) => p.id === id)!;
      const start = venueWallTime(day, program.time, DEMO_TIME_ZONE);
      const end = venueWallTime(
        day,
        program.time + program.minutes,
        DEMO_TIME_ZONE
      );
      return {
        ...program,
        key: `${demoDayKey(day)}-${program.id}`,
        day: demoDayKey(day),
        start: start.toISOString(),
        end: end.toISOString(),
      };
    });
  })
    .flat()
    .sort((a, b) => a.start.localeCompare(b.start));
}

export const occasionCategories: DemoCategory[] = [
  "league",
  "tournament",
  "round_robin",
  "social",
  "special",
];
export function nextDemoOccasions(sessions: DemoSession[], now = new Date()) {
  const seen = new Set<string>();
  return sessions.filter((s) => {
    if (
      !occasionCategories.includes(s.category) ||
      Date.parse(s.end) <= now.getTime() ||
      seen.has(s.id)
    )
      return false;
    seen.add(s.id);
    return true;
  });
}
