import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SIGNUP_URL } from "./marketingContent";

export const SplitCTASection = () => (
  <section className="mkt-closing" aria-labelledby="closing-heading">
    <div className="mkt-container mkt-closing-grid"><div><p className="mkt-eyebrow">SEE YOU ON COURT</p><h2 id="closing-heading">The next good game<br />starts with your people.</h2><p>Bring them to PULSE. Make your next match, round robin, or season happen.</p></div><div className="mkt-closing-actions"><Link className="mkt-button mkt-button-gold" to={SIGNUP_URL}>Create your free account <ArrowRight aria-hidden="true" /></Link><span>Already part of PULSE? <Link to="/auth">Sign in</Link></span></div></div>
  </section>
);
