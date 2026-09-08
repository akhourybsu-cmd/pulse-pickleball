import { Plus } from "lucide-react";
import { marketingFAQs } from "./marketingContent";

export const FAQSection = () => (
  <section id="questions" className="mkt-section mkt-faq-section" aria-labelledby="questions-heading">
    <div className="mkt-container mkt-faq-grid">
      <div className="mkt-section-heading"><p className="mkt-eyebrow">A FEW THINGS TO KNOW</p><h2 id="questions-heading">Before you<br />pick up your paddle.</h2><p>The essentials, without the guesswork.</p></div>
      <div className="mkt-faqs">{marketingFAQs.map(({question,answer}) => <details key={question}><summary>{question}<Plus aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
    </div>
  </section>
);
