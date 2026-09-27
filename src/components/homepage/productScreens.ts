/** Browser captures of production screens with local demo data.
 * Capture sources and refresh instructions: tests/marketing/browser/README.md.
 */
export const productScreens = [
  { key: 'app-home', label: 'App home', title: 'Your game starts here.', description: 'Your stats, next games and quick actions.', src: '/images/product/app-home.jpg', alt: 'PULSE app home with player stats, quick actions and bottom navigation.' },
  { key: 'friends', label: 'Friends', title: 'Find your next doubles partner.', description: 'Keep your friends and playing partners close.', src: '/images/product/friends.jpg', alt: 'PULSE Friends page showing connected players, online status and message buttons.' },
  { key: 'chat', label: 'Chat', title: 'Turn a message into a match.', description: 'Make plans in a direct conversation.', src: '/images/product/chat.jpg', alt: 'PULSE direct chat showing a conversation arranging a Saturday doubles game.' },
  { key: 'communities', label: 'Communities', title: 'Make your crew feel connected.', description: 'One place for your groups, clubs and leagues.', src: '/images/product/communities.jpg', alt: 'PULSE Community page showing pickleball groups, member counts and unread updates.' },
  { key: 'assessment', label: 'Skill assessment', title: 'Know what to work on next.', description: 'Your level, your strengths, your next focus.', src: '/images/product/assessment.jpg', alt: 'PULSE self-assessment report with a provisional level, guide range and evidence support.' },
  { key: 'profile', label: 'Your PULSE', title: 'Keep your game together.', description: 'Your rating, results, events and connections.', src: '/images/product/profile.jpg', alt: 'PULSE player profile showing a rating, match count, win–loss record and community links.' },
  { key: 'round-robin', label: 'Round robins', title: 'Less organizing. More playing.', description: 'Know your court, your partner and who’s up next.', src: '/images/product/round-robin.jpg', alt: 'PULSE live round-robin screen showing Court 1, both teams and the player’s next round.' },
  { key: 'league', label: 'Leagues', title: 'Give every game a bigger story.', description: 'Follow your season, scores and standings.', src: '/images/product/league.jpg', alt: 'PULSE league overview showing the league name, season record and Standings navigation.' },
] as const;
