import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { marketingLinks, SIGNUP_URL } from "./marketingContent";
import "./marketing.css";

export const HomepageFooter = () => (
  <footer className="mkt-footer">
    <div className="mkt-container">
      <div className="mkt-footer-grid">
        <div className="mkt-footer-brand"><Link to="/" aria-label="PULSE home"><Logo className="mkt-logo" /></Link><p>For the games you play.<br />And the people you play them with.</p></div>
        <nav aria-label="Product links"><h2>Explore PULSE</h2>{marketingLinks.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        <nav aria-label="Account links"><h2>Your account</h2><Link to={SIGNUP_URL}>Join PULSE</Link><Link to="/auth">Sign in</Link><Link to="/delete-account">Delete account</Link></nav>
        <nav aria-label="Legal links"><h2>The details</h2><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms of service</Link></nav>
      </div>
      <div className="mkt-footer-bottom"><span>© {new Date().getFullYear()} PULSE. All rights reserved.</span><span>Pickleball, connected.</span></div>
    </div>
  </footer>
);
