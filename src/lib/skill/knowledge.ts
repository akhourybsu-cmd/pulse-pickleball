import { bandForLevel, type Subskill } from './model';

export const GUIDE_PATH = '/pickleball-guide';
export const KNOWLEDGE_REVIEWED = '2026-09-22';
/** Public teaching references, not evidence validating PULSE's scoring model. */
export const KNOWLEDGE_SOURCES = {
  rules: { label: 'USA Pickleball · rules summary', url: 'https://usapickleball.org/rules/summary/' },
  play: { label: 'USA Pickleball · how to play', url: 'https://usapickleball.org/pickleball-skills/level-one/how-to-play-pickleball/' },
  matrix: { label: 'USA Pickleball · skill definitions', url: 'https://usapickleball.org/docs/skill-rating/USAP-Player-Skill-Level-Matrix.pdf' },
  developing: { label: 'USA Pickleball · developing skills', url: 'https://usapickleball.org/skill-level/level-three/' },
  advanced: { label: 'USA Pickleball · advanced skills', url: 'https://usapickleball.org/skill-level/level-four/' },
  terms: { label: 'USA Pickleball · shot terminology', url: 'https://usapickleball.org/blog-category/pickleball-basic-terms/' },
  returns: { label: 'USA Pickleball · return of serve', url: 'https://usapickleball.org/pickleball-skills/level-three/return-of-serve-tips/' },
  third: { label: 'USA Pickleball · third-shot choices', url: 'https://usapickleball.org/pickleball-skills/level-three/mastering-the-third-shot-in-pickleball/' },
  reset: { label: 'USA Pickleball · reset technique', url: 'https://usapickleball.org/pickleball-skills/level-three/what-is-a-pickleball-reset-shot-and-how-to-hit-it/' },
  transition: { label: 'USA Pickleball · transition play', url: 'https://usapickleball.org/pickleball-skills/level-four/pickleball-transition-area-and-reset-tips/' },
  positioning: { label: 'USA Pickleball · positioning and patience', url: 'https://usapickleball.org/pickleball-skills/level-two/pickleball-basics-positioning-tips/' },
  footwork: { label: 'USA Pickleball · kitchen-line movement', url: 'https://usapickleball.org/strategies/basic-kitchen-line-footwork-to-move-more-efficiently/' },
  attacks: { label: 'USA Pickleball · speedup placement', url: 'https://usapickleball.org/pickleball-skills/level-three/successful-speedups-using-a-target/' },
  overheads: { label: 'USA Pickleball · overhead and lob placement', url: 'https://usapickleball.org/pickleball-skills/level-three/where-to-hit-overheads-and-where-to-lob/' },
  lobs: { label: 'USA Pickleball · lob decisions', url: 'https://usapickleball.org/pickleball-skills/level-three/pickleball-lob-shots/' },
  wheelchair: { label: 'USA Pickleball · wheelchair rules', url: 'https://usapickleball.org/rules/wheelchair/' },
} as const;
export type KnowledgeSource = keyof typeof KNOWLEDGE_SOURCES;
export interface SkillKnowledge {
  definition: string;
  purpose: string;
  lookFor: string;
  misconception: string;
  practice: string;
  sources: KnowledgeSource[];
}

/** Original PULSE teaching copy. Observation suggestions are not rating cutoffs. */
export const SKILL_KNOWLEDGE: Record<Subskill, SkillKnowledge> = {
  serve: {
    definition: 'The serve starts the rally from behind the baseline into the diagonally opposite service box, beyond the kitchen line.',
    purpose: 'A dependable legal serve starts the point; intentional depth and placement make the return less comfortable.',
    lookFor: 'Separate simply getting the serve in from repeatedly finding a chosen target. A hard serve with frequent faults is not the same as controlled placement.',
    misconception: 'The volley serve and drop serve have different motion requirements. A drop serve is not a third-shot drop.',
    practice: 'Choose a generous deep target. Note legal serves, target hits and faults separately across 10 serves; repeat from both sides.',
    sources: ['rules', 'matrix'],
  },
  return: {
    definition: 'The return is the receiving team’s first shot, played after the serve bounces.',
    purpose: 'Depth and useful flight time keep the serving team back while helping the returner establish a balanced position near the kitchen.',
    lookFor: 'Observe placement and readiness for the next ball, including serves to the backhand. Arriving at the line out of control is not a complete success.',
    misconception: 'A return need not land in the diagonal service box. That restriction belongs to the serve.',
    practice: 'Observe 10 returns. Record in-court depth and whether you were ready for the next shot, rather than counting only points won.',
    sources: ['returns', 'play'],
  },
  forehand: {
    definition: 'A forehand groundstroke plays a bounced ball on your forehand side.',
    purpose: 'Reliable contact keeps you in the rally; direction and depth let you use available space.',
    lookFor: 'Distinguish one successful contact, repeated contacts and intentional placement under time pressure. The assessment asks these separately.',
    misconception: 'Hitting hard does not establish repeatable control. One highlight shot does not describe your usual forehand.',
    practice: 'Use a broad crosscourt target. Track in-court shots, intended placement and recovery on 10 comparable balls.',
    sources: ['matrix', 'developing'],
  },
  backhand: {
    definition: 'A backhand groundstroke plays a bounced ball on the opposite side from your forehand. One- and two-handed techniques can both be effective.',
    purpose: 'A usable backhand lets you cover your side without repeatedly exposing another gap.',
    lookFor: 'Count actual backhand opportunities, including consecutive balls and directional targets. Running around every backhand provides little evidence of that stroke.',
    misconception: 'A less powerful backhand can still be reliable. Judge its intended result and control, rather than comparing swing speed with your forehand.',
    practice: 'Ask for a comfortable backhand rally. Count controlled contacts and target hits; then observe whether that control carries into games.',
    sources: ['matrix', 'developing'],
  },
  drive: {
    definition: 'A drive is a firm attacking groundstroke, often used from deeper in the court.',
    purpose: 'A well-chosen drive can pressure an opponent or produce a softer reply that makes your next shot easier.',
    lookFor: 'Placement, height and readiness for the reply matter alongside pace. Notice whether the ball actually makes the opponent uncomfortable.',
    misconception: 'A third-shot drive does not have to win outright. It may create an easier fifth-shot drop; driving every low ball can give away control.',
    practice: 'For 10 appropriate drive opportunities, note in-court attacks and the quality of the reply. Choose the next shot from the reply you receive.',
    sources: ['third'],
  },
  third_shot_drop: {
    definition: 'After the serve and return, the serving team can play a soft third shot toward the opponents’ kitchen.',
    purpose: 'A low, controlled drop can reduce the opponents’ attacking advantage and create time to move forward.',
    lookFor: 'Look at the opponent’s contact height and your team’s ability to advance safely, rather than only whether the ball lands in the kitchen.',
    misconception: 'You should not rush forward behind every drop. A high, attackable reply may require you to stop and defend.',
    practice: 'Observe 10 drop attempts from comparable returns. Note unattackable balls, net errors and pop-ups; advance only when the reply permits it.',
    sources: ['third'],
  },
  dinking: {
    definition: 'A dink is a soft shot off a bounce near the kitchen, aimed into the opposing kitchen.',
    purpose: 'Controlled height and placement make it harder for an opponent to attack downward.',
    lookFor: 'Look for repeated low replies from both sides and recovery after contact. Easy feeds and stretched game situations are different evidence.',
    misconception: 'Landing in the kitchen alone does not make a dink effective. A floating ball can be attacked before it bounces.',
    practice: 'Rally cooperatively, then add movement. Observe how often each dink avoids giving up a comfortable downward attack.',
    sources: ['terms', 'developing'],
  },
  dink_strategy: {
    definition: 'Dink strategy is choosing where, when and how softly to play during a kitchen exchange.',
    purpose: 'Patient placement can move opponents and create a better ball to attack.',
    lookFor: 'Separate a low contact that calls for control from a ball you can attack with margin. Include recovery and the opponent’s position in the decision.',
    misconception: 'Patience is not passive play. You can change depth or direction while keeping the ball difficult to attack.',
    practice: 'During 10 dink decisions, describe the space or weakness you intended to use. Review risky attacks taken while off balance.',
    sources: ['terms', 'advanced'],
  },
  speedups: {
    definition: 'A speedup changes a soft exchange into a faster attack, usually near the kitchen line.',
    purpose: 'The aim is to exploit an opening and prepare for the counter that may follow.',
    lookFor: 'Ball height, your balance, target choice and readiness for the next ball all matter. Do not infer control from power alone.',
    misconception: 'An opponent’s body is not always the weakest target. Some players counter body balls comfortably; observe their responses.',
    practice: 'Review 10 attack opportunities with a partner. Name the target before practice, then count legal in-court attacks and controlled next replies.',
    sources: ['attacks', 'advanced'],
  },
  counters: {
    definition: 'A counter responds to an opponent’s fast attack; a compact block may neutralize it, while a controlled redirection can turn defense into offense.',
    purpose: 'Keeping the paddle ready and controlling contact helps you handle fast exchanges without a long swing.',
    lookFor: 'Notice consecutive controlled replies and whether you recover for the next ball. A reflex touch that pops up is different from a useful counter.',
    misconception: 'Every fast ball does not need a harder reply. A softer block may be the appropriate choice.',
    practice: 'Use comfortable, agreed pace. Count controlled replies in short exchanges, then record similar opportunities during games.',
    sources: ['attacks', 'reset'],
  },
  volleys: {
    definition: 'A volley contacts the ball before it bounces. The kitchen rules restrict where you can volley and where your momentum can carry you.',
    purpose: 'Volleys help maintain a strong court position and direct playable balls away from an opponent’s comfortable contact zone.',
    lookFor: 'Check legal positioning, useful placement and repeatability on both sides. High attacking volleys and low defensive ones call for different responses.',
    misconception: 'A volley is not necessarily a hard shot. A soft block is also a volley when played before the bounce.',
    practice: 'Count legal, controlled volleys in 10 comfortable exchanges. Separately note low backhand balls and foot faults.',
    sources: ['play', 'advanced'],
  },
  resets_defense: {
    definition: 'A reset softens an attacking ball into a controlled reply intended to reduce the opponent’s next attack.',
    purpose: 'It can turn a pressured rally back into a more neutral exchange.',
    lookFor: 'Observe whether the opponent must contact low and whether you regain readiness. Keeping a ball in play while floating it high is not the same as neutralizing it.',
    misconception: 'A reset is not just a slower drive. Relaxed contact and a compact motion help absorb incoming pace.',
    practice: 'Start with manageable feeds. Count replies that remove a comfortable downward attack; increase pace only when control holds.',
    sources: ['reset'],
  },
  transition_play: {
    definition: 'The transition zone is the space you move through between the baseline and kitchen line.',
    purpose: 'Good transition play combines movement with balanced stops and defensive shot choices.',
    lookFor: 'Observe readiness as opponents contact the ball, and whether partners advance together behind a useful shot.',
    misconception: 'Midcourt is not forbidden. You often have to play there; sprinting through it regardless of the next ball is not the goal.',
    practice: 'Move forward behind a controlled shot, settle as the opponent strikes, and choose to advance or defend from the reply. Review 10 such decisions.',
    sources: ['transition', 'footwork'],
  },
  overheads_lobs: {
    definition: 'An overhead attacks a reachable high ball. A lob sends the ball over opponents toward the backcourt.',
    purpose: 'Placement can move opponents, while sensible lob choices can create space or recovery time.',
    lookFor: 'Assess balanced overhead contact, useful lob depth and communication when a ball passes overhead.',
    misconception: 'A lob is not automatically defensive, and an overhead is not automatically a winner. A short lob or overhead hit directly to a ready opponent may concede the advantage.',
    practice: 'Agree on who covers lobs. Use reachable feeds and safe movement; turn to track a deep ball rather than backpedaling blindly. Count placement, not maximum power.',
    sources: ['overheads', 'lobs'],
  },
  positioning: {
    definition: 'Doubles positioning is sharing court coverage with your partner as the ball, opponents and available space change.',
    purpose: 'Good spacing, clear calls and coordinated recovery reduce gaps and confusion.',
    lookFor: 'Include the two-bounce rule, middle-ball communication, lateral coverage and readiness after a partner is pulled wide.',
    misconception: 'Standing at the kitchen line is not enough by itself. You must keep adjusting to the rally and your partner.',
    practice: 'Agree on middle-ball and lob calls. After 10 rallies, review one coverage decision each rather than blaming the player who made the final error.',
    sources: ['positioning', 'footwork'],
  },
  strategy: {
    definition: 'Strategy connects shot choice, placement, pace and risk to the situation and to your partner and opponents.',
    purpose: 'Recognizing patterns helps you make repeatable decisions rather than relying on isolated winners.',
    lookFor: 'Notice adjustments after repeated errors and choices under close-score pressure. A good decision can still lose a point; record the decision and outcome separately.',
    misconception: 'Knowing the right answer in theory is not proof of executing it in games. Close-score play is one source of evidence, not a personality test.',
    practice: 'Choose one game plan and a between-rally reset routine. After the game, note which opponent pattern you noticed and what you changed.',
    sources: ['advanced', 'positioning'],
  },
};

export const FUNDAMENTALS: { id: string; title: string; text: string; source: KnowledgeSource }[] = [
  { id: 'serve', title: 'Start with a legal serve', text: 'Serve diagonally beyond the kitchen line. The volley serve has an upward swing, contact no higher than the waist, and paddle-head restrictions. The drop serve uses a bounce and different motion rules. Both require legal positioning.', source: 'rules' },
  { id: 'bounce', title: 'Let the first two shots bounce', text: 'Receive the serve after its bounce. The serving team must also let the return bounce. After those two bounces, either team can volley or play off a bounce, subject to the kitchen rules.', source: 'play' },
  { id: 'kitchen', title: 'Understand the kitchen', text: 'The non-volley zone extends seven feet from each side of the net and includes its line. You may enter it to play a bounced ball. You cannot volley from it or let volley momentum carry you into it.', source: 'play' },
  { id: 'lines', title: 'Know the lines and the scoring format', text: 'Lines are in, except the kitchen line on a serve. Traditional side-out scoring awards points to the serving team; rally scoring differs. Confirm the format, server and score before play. A match score is not your skill rating.', source: 'rules' },
  { id: 'ready', title: 'Get ready for the next ball', text: 'Prepare your paddle and establish balance as the opponent hits. Move with your partner and recover after contact. Efficient positioning supports every stroke; it is not a contest of who moves fastest.', source: 'footwork' },
  { id: 'inclusive', title: 'Use the rules and movement appropriate to your play', text: 'Wheelchair pickleball has specific adaptations, including bounce and kitchen provisions. Use that ruleset when applicable. This assessment has not been validated for adaptive play; use “Not enough game experience” for situations you cannot compare, and seek an adapted coach assessment.', source: 'wheelchair' },
];

export const GLOSSARY = [
  ['Kitchen / NVZ', 'The non-volley zone beside the net, including its boundary line.'],
  ['Groundstroke', 'A shot played after the ball bounces.'],
  ['Volley', 'A shot played before the ball bounces.'],
  ['Third shot', 'The serving team’s shot after the serve and return.'],
  ['Drop vs. dink', 'Both are soft shots; a drop travels from farther back, while a dink is played near the kitchen.'],
  ['Reset', 'A controlled soft reply intended to reduce an opponent’s attack.'],
  ['Speedup / counter', 'An attack that accelerates play / a response to that attack.'],
  ['Unforced error', 'A missed playable ball without severe immediate pressure; interpretation depends on the situation.'],
  ['Opportunity', 'One occurrence of the exact situation being asked about, not necessarily one rally or one point.'],
  ['Success', 'Meeting the question’s stated criterion, whether or not your team wins the point.'],
] as const;

// PULSE-specific learning directions, not USAP labels or a validated crosswalk.
const BAND_CONTEXT: Record<string, { meaning: string; next: string }> = {
  new: { meaning: 'Your reported situations suggest starting with comfortable contact and the structure of a rally.', next: 'Practise legal serves, returns after the bounce and simple cooperative rallies. Learn kitchen boundaries before chasing pace.' },
  beginner: { meaning: 'Routine play is the useful starting point; reliability across opportunities needs attention.', next: 'Build repeatable serves and returns, then add controlled forehand and backhand placement.' },
  adv_beginner: { meaning: 'The useful question is whether routine shots stay reliable when placement or movement changes.', next: 'Observe depth, a low soft reply and recovery. Bring the serving team forward behind a useful third shot.' },
  low_intermediate: { meaning: 'Your report can help identify where isolated shot skills do not yet connect into a reliable rally pattern.', next: 'Compare execution with repeatability. Work on drop-to-transition sequences and a calm response to an attack.' },
  intermediate: { meaning: 'Consistency and decision-making deserve separate attention at this point on the PULSE scale.', next: 'Choose attacks with margin, keep low-ball replies controlled and coordinate coverage with your partner.' },
  high_intermediate: { meaning: 'Use the breakdown to examine whether control holds during movement, fast exchanges and close scores.', next: 'Observe reset quality, purposeful placement and readiness for a counter. Review one recurring opponent pattern.' },
  advanced: { meaning: 'Stronger reported skills call for more demanding observation to establish how well they transfer across opponents.', next: 'Vary opponents and pressure situations, then ask a coach to check placement, shot selection and partnership coverage.' },
  expert: { meaning: 'You have reached the upper end of this assessment. The model cannot establish a higher level or confirm expert status.', next: 'Use independent observation and eligible match results. Do not interpret the ceiling as proof of tournament or professional ability.' },
};
export function getLevelContext(raw: number) { return { ...bandForLevel(raw), ...BAND_CONTEXT[bandForLevel(raw).key] }; }
