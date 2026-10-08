import { SUBSKILL_DOMAIN, isEssentialSubskill, type AnchorLevel, type AssessmentItem, type Dimension, type Subskill } from './model.ts';

/** Original PULSE questions. Anchors are provisional, not USAP/DUPR equivalents.
 * V1/V2 stay frozen. Each V3 question names its counting unit and one main outcome.
 * A broad skill group is NOT permission to compare unlike abilities for consistency.
 */
type Prompt = {
  anchor: AnchorLevel; situation: string; success: string; focus: string; cue: string;
  contacts?: 3; comparison?: string;
};
const p = (anchor: AnchorLevel, situation: string, success: string, focus: string, cue: string, extra: Pick<Prompt, 'contacts' | 'comparison'> = {}): Prompt =>
  ({ anchor, situation, success, focus, cue, ...extra });
// Classify what is actually observed; a question's position is not its measure.
const measures: Record<Subskill, readonly Dimension[]> = {
  serve: ['execution', 'consistency', 'application', 'pressure'], return: ['execution', 'consistency', 'execution', 'pressure'],
  forehand: ['execution', 'consistency', 'application', 'pressure'], backhand: ['execution', 'consistency', 'application', 'pressure'],
  drive: ['execution', 'consistency', 'application', 'application'], third_shot_drop: ['execution', 'consistency', 'application', 'pressure'],
  dinking: ['consistency', 'consistency', 'application', 'pressure'], dink_strategy: ['application', 'application', 'application', 'pressure'],
  speedups: ['execution', 'application', 'application', 'pressure'], counters: ['execution', 'consistency', 'application', 'pressure'],
  volleys: ['execution', 'consistency', 'application', 'pressure'], resets_defense: ['execution', 'consistency', 'execution', 'pressure'],
  transition_play: ['execution', 'consistency', 'application', 'pressure'], overheads_lobs: ['execution', 'application', 'application', 'pressure'],
  positioning: ['application', 'application', 'application', 'pressure'], strategy: ['application', 'application', 'application', 'pressure'],
};
const scenarios: Record<Subskill, [Prompt, Prompt, Prompt, Prompt]> = {
  serve: [
    p(2, 'You start a doubles point with your usual serve.', 'Your legal serve lands in the diagonal service box, beyond the kitchen line.', 'Legal serve', 'Start behind the baseline. The ball clears the net and bounces beyond the kitchen line in the diagonal box.'),
    p(3.5, 'Using your usual serve, you aim for the back third of the service box.', 'Your legal serve lands in that deep target.', 'Serve depth', 'The shaded target is the back third of the service box, not the whole half-court.', { comparison: 'serve-depth' }),
    p(4, 'The returner stands toward one side of the service box. You choose the open side.', 'Your legal serve lands in the side you chose.', 'Serve placement', 'The returner leaves a visible gap. The target stays inside the diagonal service box.'),
    p(4.5, 'On an important point, you use the same serve and deep target as in routine play.', 'Your legal serve still lands in the back third of the service box.', 'Serve depth under pressure', 'The target and serve stay the same; the close-score context changes.', { comparison: 'serve-depth' }),
  ],
  return: [
    p(2.5, 'A routine serve reaches you. You let it bounce before returning.', 'Your return clears the net and lands inside the opponents’ court.', 'Return control', 'Watch the serve bounce before your contact. A return can go to either side.'),
    p(3.5, 'You receive a medium-paced serve and aim for a generous deep target.', 'Your return lands in the back third of the opponents’ court.', 'Return depth', 'The target covers the back third of the entire opposite half-court.'),
    p(4, 'A serve with noticeable spin changes direction or speed after its bounce.', 'You adjust to that bounce and return the ball inside the court.', 'Handling spin', 'The ball changes direction after bouncing. Adjust to the actual bounce before contact.'),
    p(4.5, 'On an important point, a fast serve reaches your backhand.', 'Your backhand return lands in the back third of the opponents’ court.', 'Backhand return under pressure', 'Let the fast serve bounce, then use your backhand to reach the deep target.'),
  ],
  forehand: [
    p(2.5, 'A routine ball bounces to your forehand near the baseline.', 'Your forehand clears the net and lands inside the court.', 'Forehand control', 'The paddle contacts a bounced ball on the forehand side. Right-handed example.'),
    p(3.5, 'In a rally, you get three playable, medium-paced forehands near the baseline.', 'All three of your forehands land inside the court.', 'Forehand sequence', 'Count your three contacts, with an opponent’s reply between each one.', { contacts: 3 }),
    p(4, 'You are balanced near the baseline and see open space crosscourt.', 'Your forehand lands in the crosscourt space you chose.', 'Forehand placement', 'The target marks open space away from the opponents.'),
    p(4.5, 'A deep ball pushes you back on an important point.', 'Your forehand reply lands in the back third of the opposite court.', 'Deep forehand under pressure', 'Move back to the deep bounce, then send the forehand to a generous deep target.'),
  ],
  backhand: [
    p(2.5, 'A routine ball bounces to your backhand near the baseline.', 'Your backhand clears the net and lands inside the court.', 'Backhand control', 'The paddle reaches across the body to the backhand side. One or two hands are both valid.'),
    p(3.5, 'In a rally, you get three playable, medium-paced backhands near the baseline.', 'All three of your backhands land inside the court.', 'Backhand sequence', 'Count three backhand contacts, with an opponent’s reply between each one.', { contacts: 3 }),
    p(4, 'You are balanced on a bounced backhand ball and see open space crosscourt.', 'Your backhand lands in the crosscourt space you chose.', 'Backhand placement', 'The backhand contact and the open crosscourt target are shown separately.'),
    p(4.5, 'A deep ball reaches your backhand on an important point.', 'Your backhand reply lands in the back third of the opposite court.', 'Deep backhand under pressure', 'Use a backhand contact to reach the deep target; power alone is not the criterion.'),
  ],
  drive: [
    p(3, 'A comfortable, waist-high ball bounces to you near the baseline.', 'Your firm groundstroke clears the net and lands inside the court.', 'Drive control', 'A drive travels on a firmer, lower flight than a drop.'),
    p(3.5, 'You drive a playable ball toward opponents at the kitchen line.', 'Your drive reaches their contact area below net height.', 'Drive height', 'Follow the low flight and the below-net contact area in the height view.'),
    p(4, 'A short, high return gives you time to set up an attacking third shot.', 'You place your drive into the gap between the opponents.', 'Drive placement', 'Take the short ball from inside the baseline and aim between the defenders.'),
    p(4.5, 'Your third-shot drive draws a short block. You choose a fifth-shot drop.', 'Your fifth shot clears the net and lands softly in the kitchen.', 'Drive-to-drop sequence', 'Watch shot 3: drive, shot 4: block, and shot 5: drop. Judge only your fifth shot.'),
  ],
  third_shot_drop: [
    p(3, 'The return has bounced. You play a soft third shot from near the baseline.', 'Your drop clears the net and lands in the kitchen.', 'Drop control', 'The ball rises over the net, descends, and bounces inside the kitchen.'),
    p(3.5, 'You play a third-shot drop toward opponents at the kitchen line.', 'Your drop falls below net height before reaching their contact area.', 'Drop height', 'Watch the ball descend below the net-height guide before the opponent’s contact area.'),
    p(4, 'A deep, low return leaves you balanced but without a comfortable drive opportunity.', 'You choose a soft drop instead of forcing a hard attack from below net height.', 'Third-shot choice', 'A low contact and defenders at the kitchen favour a controlled soft ball. Count the decision, not the point won.'),
    p(4.5, 'On an important point, a deep return reaches your backhand.', 'Your backhand drop clears the net and falls below net height near the opponents.', 'Backhand drop under pressure', 'The backhand contact sends a soft arc down below net height at the receiving side.'),
  ],
  dinking: [
    p(3, 'During a kitchen rally, you receive three playable, bouncing dinks.', 'All three of your replies bounce in the opposing kitchen.', 'Dink sequence', 'Each incoming dink bounces before your contact. Count all three outgoing replies as one sequence.', { contacts: 3 }),
    p(3.5, 'You receive a neutral dink while balanced at the kitchen line.', 'Your reply descends below net height before reaching the opponent’s contact area.', 'Dink height', 'A kitchen landing alone is not enough: watch the height where the opponent could contact it.'),
    p(4, 'A crosscourt dink pulls you toward the sideline.', 'After your soft reply, you recover toward your ready position before the next opponent contact.', 'Dink recovery', 'Reply from the wide position, move back toward coverage, and get ready as the opponent hits.'),
    p(4.5, 'On a close point, you receive three playable backhand dinks in one rally.', 'All three replies fall below net height near the opponents.', 'Backhand dink sequence', 'Follow three backhand replies and their low receiving-side contact heights.', { contacts: 3 }),
  ],
  dink_strategy: [
    p(3, 'You receive a low dink while the opponents are ready at the kitchen.', 'You choose a soft reply rather than forcing a downward attack from below net height.', 'Low-ball decision', 'The ball is below the net at your contact. The controlled soft reply is the decision being assessed.'),
    p(3.5, 'A low dink is followed by a high ball within your comfortable reach.', 'You wait through the low ball and choose the high, balanced contact for a downward attack.', 'Attack selection', 'Compare the first low contact with the next high contact. Above-net height alone is not enough if you are off balance.'),
    p(4, 'After a wide dink, an opponent moves back toward the middle.', 'Your next dink lands in the space they just left.', 'Dink placement', 'Watch the opponent move inward, then target the newly open sideline space.'),
    p(4.5, 'On an important point, the opponents keep sending low dinks and offer no comfortable attack.', 'You keep choosing controlled soft replies instead of forcing a hard attack.', 'Patience under pressure', 'Two low exchanges show the repeated decision. Count one such rally as one opportunity.'),
  ],
  speedups: [
    p(3, 'At the kitchen line, a high ball reaches you while you are balanced.', 'Your faster attack stays inside the court.', 'Speedup control', 'The attack begins above net height and travels down into the court.'),
    p(3.5, 'After a legal speedup, the opponent is about to counter.', 'Your paddle is back in front and you are balanced by their contact.', 'Paddle readiness', 'Attack, return the paddle to ready position, and settle before the counter.'),
    p(4, 'You have a comfortable attackable ball and see space beside an opponent’s ready paddle.', 'Your speedup goes through the space you chose.', 'Speedup placement', 'The visible paddle marks the defended area; the target is beside it.'),
    p(4.5, 'An opponent counters your speedup on an important point.', 'Your next reply stays inside the court.', 'Speedup follow-up', 'Your attack, their counter, then your controlled reply. Judge the final reply.'),
  ],
  counters: [
    p(3, 'A medium-paced attack comes toward your body at the kitchen line.', 'Your block sends the ball back inside the court.', 'Block control', 'Absorb the incoming ball with a compact contact in front of the body.'),
    p(3.5, 'An opponent speeds up toward your body from the kitchen.', 'Your reply stays in court using a compact contact rather than a large backswing.', 'Compact counter', 'The short paddle action stays close to the ready position.'),
    p(4, 'An opponent’s fast ball is travelling high and long beyond your baseline.', 'You let it go untouched and it lands out.', 'Recognizing out balls', 'Track the ball past you to an out-of-court bounce. Do not count balls you leave that land in.'),
    p(4.5, 'On an important point, you face three playable balls in a fast volley exchange.', 'All three of your replies stay inside the court.', 'Counter sequence', 'Three incoming attacks alternate with your three controlled replies.', { contacts: 3 }),
  ],
  volleys: [
    p(2.5, 'A comfortable ball reaches you before bouncing while you stand outside the kitchen.', 'Your volley lands in court, and neither your feet nor your momentum enters the kitchen.', 'Legal volley', 'Contact before the bounce and stay outside the kitchen through the follow-through.'),
    p(3.5, 'You receive three playable, medium-paced volleys during an exchange.', 'All three of your legal volleys stay inside the court.', 'Volley sequence', 'Three contacts without a bounce on your side; feet remain outside the kitchen.', { contacts: 3 }),
    p(4, 'You receive a high volley while an opponent moves through midcourt.', 'Your volley reaches the court near their feet.', 'Volley placement', 'The opponent moves forward while the ball travels down toward their feet.'),
    p(4.5, 'A hard, low ball reaches your backhand on an important point.', 'Your soft backhand volley clears the net and falls below net height near the opponent.', 'Low backhand volley', 'Contact without a bounce on the backhand side, then soften the reply.'),
  ],
  resets_defense: [
    p(3, 'A firm ball reaches you while you are set at the kitchen line.', 'Your block returns the ball inside the court.', 'Defensive control', 'An incoming attack meets your compact block and returns inside the court.'),
    p(3.5, 'A hard ball reaches you while you are set at the kitchen line.', 'Your softened reply clears the net and descends into the kitchen.', 'Kitchen reset', 'The outgoing ball loses pace and drops into the kitchen.'),
    p(4, 'A ball reaches your feet in midcourt.', 'Your soft reset clears the net and falls below net height near the opponent.', 'Low transition reset', 'Low contact in midcourt, a soft arc over the net, and a low receiving-side contact area.'),
    p(4.5, 'A close point leaves you defending an attack from midcourt.', 'Your reset clears the net and descends into the kitchen.', 'Reset under pressure', 'Judge your ball’s height and placement, not whether the opponent chooses to attack again.'),
  ],
  transition_play: [
    p(3, 'Your deep return gives you time to move toward the kitchen.', 'You stop in a balanced ready position as the opponent contacts the next ball.', 'Balanced approach', 'Return deep, approach, then settle at the opponent’s contact—even if you have not reached the line.'),
    p(3.5, 'You move forward behind a low drop.', 'You make a balanced stop with your paddle ready as the opponent hits.', 'Split-step timing', 'The incoming reply and your stop happen together. Do not keep running through their contact.'),
    p(4, 'Your drop floats high enough for an opponent to attack downward.', 'You stop advancing and prepare to defend.', 'Hold or advance', 'The high ball is attackable. Hold your position rather than following it forward.'),
    p(4.5, 'Both partners are in midcourt. Your low reset creates time to advance.', 'You move forward together and are both ready as the opponent contacts the ball.', 'Team transition', 'Low reset first, both players advance, then both settle before the reply.'),
  ],
  overheads_lobs: [
    p(3, 'A high ball is within comfortable overhead reach.', 'Your overhead lands inside the court.', 'Overhead control', 'Contact the reachable ball above your head and direct it down into the court.'),
    p(3.5, 'A reachable lob gives you time to choose an overhead target.', 'Your overhead lands in the open side you chose.', 'Overhead placement', 'The lob arrives within reach. The overhead targets space away from the defenders.'),
    p(4, 'Both opponents are close to the kitchen. You are balanced on a soft ball.', 'Your offensive lob clears their reach and lands before the baseline.', 'Offensive lob', 'The high arc passes above the defenders’ reach, then descends inside the baseline.'),
    p(4.5, 'On an important point, a deep lob passes over you and your partner has the clearer retrieval path.', 'You call “switch” and cover the vacated side while your partner turns to chase the bounce.', 'Lob retrieval', 'Call switch, turn and run rather than backpedalling; the covering player clears the retrieval path. Judge your coverage decision.'),
  ],
  positioning: [
    p(2.5, 'Your team served and the return is coming back.', 'You let the return bounce before your team’s third-shot contact.', 'Two-bounce rule', 'The sequence shows serve bounce, return bounce, then the third shot.'),
    p(3.5, 'Your partner is pulled toward a sideline at the kitchen.', 'You shift toward them to reduce the open middle gap.', 'Shared coverage', 'As your partner moves wide, move with them without crowding their shot.'),
    p(4, 'A playable ball travels between you and your partner.', 'You make an early “mine” or “yours” call so one player takes it.', 'Middle communication', 'One player calls and contacts the ball while the other leaves a clear path.'),
    p(4.5, 'Your partner has been pulled wide during a fast rally.', 'You cover the middle until your partner recovers, then restore your spacing.', 'Team recovery', 'Your partner first moves wide, then returns inward. Your coverage adjusts in both directions.'),
  ],
  strategy: [
    p(2.5, 'You are off balance and must contact the ball below net height.', 'You choose a controlled soft reply instead of a hard winner attempt.', 'Risk selection', 'A low, stretched contact calls for margin. Count the choice separately from the point’s result.'),
    p(3.5, 'You have missed the same hard attack on a low ball twice.', 'At the next comparable opportunity, you choose a controlled soft reply.', 'Adjusting risk', 'The earlier misses provide context; the illustrated next decision is the one to count.'),
    p(4, 'Crosscourt attacks keep pulling your partner wide and opening the middle.', 'You choose a low reset to slow that pattern and give your partner time to recover.', 'Pattern adjustment', 'A wide partner and open middle establish the problem; your low reset creates recovery time.'),
    p(4.5, 'On an important point, you receive a low ball while off balance.', 'You choose a controlled soft reply with margin.', 'Risk under pressure', 'The close score does not turn a low, off-balance contact into a comfortable attack.'),
  ],
};

export const QUESTION_BANK_V3: readonly AssessmentItem[] = Object.freeze(
  Object.entries(scenarios).flatMap(([key, prompts], skillIndex) => {
    const subskill = key as Subskill;
    return prompts.map((prompt, stage): AssessmentItem => ({
      itemKey: `v3_${subskill}_${stage}`, version: 3, text: 'How often do you meet this success criterion?',
      situation: prompt.situation, success: prompt.success, focus: prompt.focus, visualCue: prompt.cue,
      observation: { unit: prompt.contacts === 3 ? 'rally' : 'opportunity', contacts: prompt.contacts ?? 1,
        note: prompt.contacts === 3 ? 'Out of 10 rallies where you receive all three playable balls. Count your full three-shot sequence as one success.'
          : 'Out of 10 comparable situations in recent doubles games. Count the stated action, not points won.' },
      subskill, domain: SUBSKILL_DOMAIN[subskill], dimension: measures[subskill][stage], anchorLevel: prompt.anchor,
      weight: 1, isEssential: isEssentialSubskill(subskill), contradictionGroup: prompt.comparison ?? null,
      prerequisite: stage ? { itemKey: `v3_${subskill}_${stage >= 2 ? 1 : 0}` } : null,
      adaptive: null, phase: stage === 0 ? 'foundation' : 'targeted', order: stage * 16 + skillIndex, active: true,
    }));
  }).sort((a, b) => a.order - b.order),
);
