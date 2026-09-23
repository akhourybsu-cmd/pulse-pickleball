const steps = [
  { title: 'Make it yours', text: 'Create your free player profile.' },
  { title: 'Find your crew', text: 'Connect with friends or join a group.' },
  { title: 'Keep playing', text: 'Record a match or organize the next one.' },
];
export const HowItWorksSection = () => <section id="how-it-works" className="mkt-section mkt-start" aria-labelledby="getting-started-heading"><div className="mkt-container"><div className="mkt-section-heading"><h2 id="getting-started-heading">Easy to start. Plenty to grow into.</h2></div><ol className="mkt-steps">{steps.map((step,index)=><li key={step.title}><span className="mkt-step-number">0{index+1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></div></section>;
