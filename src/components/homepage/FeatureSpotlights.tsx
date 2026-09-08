import { Link } from "react-router-dom";
import { ArrowRight, Check, RotateCcw, Trophy } from "lucide-react";
import { SIGNUP_URL } from "./marketingContent";

const CheckList = ({ items }: { items: string[] }) => (
  <ul className="mkt-check-list">{items.map(item => <li key={item}><Check aria-hidden="true" /><span>{item}</span></li>)}</ul>
);

export const FeatureSpotlights = () => (
  <section id="organizers" className="mkt-organizers mkt-section" aria-labelledby="organizers-heading">
    <div className="mkt-container">
      <div className="mkt-section-heading"><p className="mkt-eyebrow">FOR THE PERSON WHO MAKES PLAY HAPPEN</p><h2 id="organizers-heading">Bring the players.<br />PULSE brings the structure.</h2><p>From a casual group on two courts to a season-long competition, keep the details organized and the players in the loop.</p></div>
      <article className="mkt-spotlight">
        <div className="mkt-spotlight-copy">
          <span className="mkt-product-label"><RotateCcw aria-hidden="true" /> ROUND ROBINS</span>
          <h3>A better flow<br />for your next open play.</h3>
          <p>Set your roster and courts, generate the schedule, and see who's playing where. When the plan changes, review adjustments and keep the next round moving.</p>
          <CheckList items={["Player rotations, byes, and court assignments", "Guest players, score entry, and live standings", "Scheduling and fairness tools for the host"]} />
          <Link className="mkt-text-link" to={SIGNUP_URL}>Get started with round robins <ArrowRight aria-hidden="true" /></Link>
        </div>
        <figure className="mkt-rr-preview">
          <div className="mkt-product-preview-title"><RotateCcw aria-hidden="true" /><div><strong>Saturday round robin</strong><span>8 players · 2 courts · Doubles</span></div></div>
          <div className="mkt-round-strip" aria-label="Illustrative round progress"><span>Round 1 <Check aria-hidden="true" /></span><strong>Round 2</strong><span>Round 3</span></div>
          <div className="mkt-courts">
            <div className="mkt-court"><span>COURT 1</span><strong>Alex & Jamie</strong><span className="mkt-court-net">vs</span><strong>Morgan & Sam</strong></div>
            <div className="mkt-court"><span>COURT 2</span><strong>Riley & Casey</strong><span className="mkt-court-net">vs</span><strong>Taylor & Jordan</strong></div>
          </div>
          <div className="mkt-rr-preview-footer"><span><Check aria-hidden="true" /> Everyone has a court</span><span>Next: rotate partners</span></div>
          <figcaption>Illustrative round-robin schedule · Sample players</figcaption>
        </figure>
      </article>
      <article className="mkt-spotlight mkt-spotlight-reverse">
        <div className="mkt-spotlight-copy">
          <span className="mkt-product-label"><Trophy aria-hidden="true" /> LEAGUES</span>
          <h3>Give your weekly game<br />a bigger story.</h3>
          <p>Build a league around the way your group likes to compete. Organizers manage the season; members have a clear place to follow their games, results, and standings.</p>
          <CheckList items={["League formats for different ways to compete", "Invite codes and a shared home for your members", "Season settings, scheduling, and standings"]} />
          <Link className="mkt-text-link" to={SIGNUP_URL}>Get started with leagues <ArrowRight aria-hidden="true" /></Link>
        </div>
        <figure className="mkt-league-preview">
          <div className="mkt-product-preview-title"><Trophy aria-hidden="true" /><div><strong>The weeknight league</strong><span>A season worth showing up for</span></div></div>
          <div className="mkt-season-strip"><span>SUMMER SEASON</span><strong>Week 4 of 8</strong></div>
          <div className="mkt-standings">
            <div className="mkt-standings-heading"><span>Standings</span><span>W – L</span></div>
            {[{name:"Alex",record:"6 – 2"},{name:"Morgan",record:"5 – 3"},{name:"Riley",record:"4 – 4"}].map((player,index) => <div className="mkt-standing" key={player.name}><span className="mkt-standing-rank">0{index+1}</span><strong>{player.name}</strong><span>{player.record}</span></div>)}
          </div>
          <div className="mkt-league-note"><span className="mkt-preview-dot" aria-hidden="true" /> The next game is part of something bigger.</div>
          <figcaption>Illustrative league standings · Sample season and results</figcaption>
        </figure>
      </article>
    </div>
  </section>
);
