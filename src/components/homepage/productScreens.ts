/** Unedited browser captures of production components with local demo data.
 * Capture sources and refresh instructions: tests/marketing/browser/README.md.
 */
export const productScreens = [
  { key: 'assessment', label: 'Skill assessment', title: 'Know what to work on next.', description: 'Your level, your strengths, your next focus.', src: '/images/product/assessment.jpg', alt: 'PULSE self-assessment report with a provisional level, guide range and evidence support.', position: 'center 65%', accent: 'teal' },
  { key: 'profile', label: 'Your PULSE', title: 'Keep your game together.', description: 'Your rating, results, events and connections.', src: '/images/product/profile.jpg', alt: 'PULSE player profile showing a rating, match count, win–loss record and community links.', position: 'top', accent: 'gold' },
  { key: 'round-robin', label: 'Round robins', title: 'Less organizing. More playing.', description: 'Know your court, your partner and who’s up next.', src: '/images/product/round-robin.jpg', alt: 'PULSE live round-robin screen showing Court 1, both teams and the player’s next round.', position: 'center', accent: 'gold' },
  { key: 'league', label: 'Leagues', title: 'Give every game a bigger story.', description: 'Follow your season, scores and standings.', src: '/images/product/league.jpg', alt: 'PULSE league page with confirmed results and ranked player standings.', position: 'center 35%', accent: 'teal' },
] as const;
