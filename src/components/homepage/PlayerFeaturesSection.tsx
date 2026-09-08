import { Activity, CalendarDays, ClipboardList, MessagesSquare, RotateCcw, Trophy } from "lucide-react";

const features = [
  { icon: ClipboardList, title: "Keep every match in the picture", text: "Record singles and doubles, confirm scores with the other players, and revisit your match history." },
  { icon: Activity, title: "Get to know your game", text: "Follow your PULSE rating and results over time. Eligible, verified matches help build a clearer picture of your play." },
  { icon: CalendarDays, title: "Find a reason to get on court", text: "Explore available open play and events, see the details, and make your next pickleball plan." },
  { icon: MessagesSquare, title: "Make it more than a match", text: "Add friends, message your crew, and join community groups to keep the conversation going between games." },
  { icon: RotateCcw, title: "Give open play a game plan", text: "Host a round robin with player rotations, court assignments, score entry, and standings in one place." },
  { icon: Trophy, title: "Turn your crew into a league", text: "Organize a season, invite your players, and manage formats, schedules, results, and standings as you go." },
];

export const PlayerFeaturesSection = () => (
  <section id="features" className="mkt-section" aria-labelledby="features-heading">
    <div className="mkt-container">
      <div className="mkt-section-heading mkt-heading-split">
        <div><p className="mkt-eyebrow">ONE APP. YOUR WHOLE GAME.</p><h2 id="features-heading">Less scattered.<br />More connected.</h2></div>
        <p>The score you recorded. The friend you played with. The league you're building. Bring the pieces of your pickleball life together.</p>
      </div>
      <div className="mkt-feature-grid">
        {features.map(({ icon: Icon, title, text }, index) => (
          <article className="mkt-feature" key={title}>
            <div className="mkt-feature-top"><Icon aria-hidden="true" /><span>0{index + 1}</span></div>
            <h3>{title}</h3><p>{text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);
