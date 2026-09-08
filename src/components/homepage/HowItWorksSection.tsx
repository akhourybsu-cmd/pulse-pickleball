const steps = [
  { title: "Make it your game", text: "Create your free account and set up your player profile. Start with the level and interests that fit you." },
  { title: "Find your people", text: "Connect with friends, explore available play, or bring your own crew together for a round robin or league." },
  { title: "Keep the momentum", text: "Record your matches, follow your results, and stay connected with the people you'll play with next." },
];

export const HowItWorksSection = () => (
  <section id="how-it-works" className="mkt-section" aria-labelledby="getting-started-heading">
    <div className="mkt-container">
      <div className="mkt-section-heading mkt-heading-split"><div><p className="mkt-eyebrow">YOUR NEXT GAME STARTS HERE</p><h2 id="getting-started-heading">Easy to join.<br />Plenty to grow into.</h2></div><p>New to pickleball or already a regular? You don't need to run a league or know your rating to get started.</p></div>
      <ol className="mkt-steps">{steps.map((step,index) => <li key={step.title}><span className="mkt-step-number">0{index+1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </div>
  </section>
);
