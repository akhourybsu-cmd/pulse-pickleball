import { DIMENSIONS, SUBSKILL_DOMAIN, isEssentialSubskill, type AnchorLevel, type AssessmentItem, type Subskill } from './model.ts';

/** Original, behavior-based prompts informed by the USA Pickleball skill matrix.
 * Anchors and frequency calibration are PULSE hypotheses, not official ratings.
 * Each row assesses execution, repeatability, selection, then pressure separately.
 * V2 keeps the legacy storage keys; their values now mean 0/2/4/6/8/10 successes.
 */
type Prompt = [anchor: AnchorLevel, situation: string, success: string];
const scenarios: Record<Subskill, [Prompt, Prompt, Prompt, Prompt]> = {
  serve: [
    [2, 'You serve to start a point.', 'Your legal serve lands beyond the kitchen in the diagonal service box.'],
    [3.5, 'You aim a serve into the back third of the service box.', 'The serve lands in that deep target without a fault.'],
    [4, 'A returner leaves one side of the service box open.', 'You place a legal serve in the open side you chose.'],
    [4.5, 'At 9–9, you aim your serve deep.', 'Your serve reaches the back third of the service box without a fault.'],
  ],
  return: [
    [2.5, 'You receive a routine serve and let it bounce.', 'Your return clears the net and lands inside the court.'],
    [3.5, 'You receive a medium-paced serve and aim deep.', 'Your return lands in the back third of the opponents’ court.'],
    [4, 'The server stays deep after serving.', 'You hit a deep return with enough time to establish your position near the kitchen.'],
    [4.5, 'At 9–9, a fast serve comes to your backhand.', 'Your backhand return lands deep and gives you time to get set.'],
  ],
  forehand: [
    [2.5, 'A routine ball bounces to your forehand at the baseline.', 'Your forehand lands inside the opponents’ court.'],
    [3.5, 'You trade medium-paced forehands from the baseline.', 'You land three consecutive forehands in court during the exchange.'],
    [4, 'A gap opens crosscourt while you are balanced at the baseline.', 'You place a forehand into that gap without hitting out.'],
    [4.5, 'A deep ball pushes you back on an important point.', 'Your forehand reaches the back third of the opposite court.'],
  ],
  backhand: [
    [2.5, 'A routine ball bounces to your backhand at the baseline.', 'You return it in court with a backhand, without running around it.'],
    [3.5, 'An opponent keeps hitting medium-paced balls to your backhand.', 'You land three consecutive backhands in court during the exchange.'],
    [4, 'A gap opens crosscourt on a ball to your backhand.', 'You direct a backhand into that gap.'],
    [4.5, 'An opponent targets your backhand on an important point.', 'Your backhand reaches the back third of their court.'],
  ],
  drive: [
    [3, 'A waist-high ball bounces to you near the baseline.', 'Your firm groundstroke clears the net and stays in court.'],
    [3.5, 'You drive a ball at opponents waiting at the kitchen.', 'Your drive crosses low enough that they contact it below net height.'],
    [4, 'A short, high return gives you time to set up a drive.', 'You direct the drive at an opponent’s feet or the gap between players.'],
    [4.5, 'Your opponent blocks your drive back quickly.', 'You control the next shot in court while staying balanced.'],
  ],
  third_shot_drop: [
    [3, 'Your serve is returned. You try a soft third shot from the baseline.', 'The ball clears the net and lands in the kitchen.'],
    [3.5, 'You play a third-shot drop while opponents wait at the kitchen.', 'The ball drops below net height before they can volley it.'],
    [4, 'An opponent leaves a crosscourt opening near the kitchen.', 'Your third-shot drop lands in that opening.'],
    [4.5, 'At 9–9, a deep return reaches your backhand.', 'Your backhand drop forces the opponents to contact below net height.'],
  ],
  dinking: [
    [3, 'Both teams exchange soft, bouncing shots at the kitchen.', 'You land three consecutive dinks in the kitchen during the rally.'],
    [3.5, 'You receive a neutral dink while balanced at the kitchen line.', 'Your reply stays low enough to prevent a downward attack.'],
    [4, 'A crosscourt dink pulls you wide.', 'You return a low dink into the kitchen and recover your position.'],
    [4.5, 'A close point becomes a long dink rally to your backhand.', 'You keep three consecutive backhand dinks low during the rally.'],
  ],
  dink_strategy: [
    [3, 'A dink reaches you below the height of the net.', 'You choose a soft reply instead of forcing a fast attack.'],
    [3.5, 'Several low dinks arrive in the same rally.', 'You wait for a ball above net height before attempting a downward attack.'],
    [4, 'After a wide dink, your opponent moves back toward the middle.', 'You place the next dink into the space they left open.'],
    [4.5, 'At 9–9, your opponent keeps giving you low, unattackable dinks.', 'You keep the ball soft until an attackable ball arrives.'],
  ],
  speedups: [
    [3, 'A ball floats above net height while you are at the kitchen line.', 'You attack the high ball into the court.'],
    [3.5, 'You speed up a high ball from the kitchen line.', 'Your attack stays in court without a kitchen foot fault.'],
    [4, 'An opponent leaves a gap beside their ready paddle.', 'You direct a speedup through the gap you chose.'],
    [4.5, 'Your opponent counters your speedup on a close point.', 'You control the next ball in court without losing your balance.'],
  ],
  counters: [
    [3, 'A medium-paced volley comes toward your body at the kitchen.', 'You block the ball back inside the court.'],
    [3.5, 'An opponent speeds up toward your body from the kitchen.', 'Your compact block stays in court without a large backswing.'],
    [4, 'An opponent speeds up while leaving space beside them.', 'You redirect their ball into the open space.'],
    [4.5, 'A close point turns into a fast volley exchange.', 'You control three consecutive replies in court during the exchange.'],
  ],
  volleys: [
    [2.5, 'At the kitchen line, a comfortable ball reaches you before bouncing.', 'You volley it in court without touching the kitchen.'],
    [3.5, 'You exchange medium-paced volleys at the net.', 'You land three consecutive volleys in court during the exchange.'],
    [4, 'You receive a high volley. An opponent is moving through midcourt.', 'You place the volley toward their feet.'],
    [4.5, 'A hard, low ball comes to your backhand on an important point.', 'You volley it in court without giving up a high, easy attack.'],
  ],
  resets_defense: [
    [3, 'A firm ball comes to you while you are set at the kitchen line.', 'You block it back inside the court.'],
    [3.5, 'A hard ball reaches you while you are set at the kitchen line.', 'You soften it into the opponents’ kitchen instead of sending it high.'],
    [4, 'A ball arrives at your feet in midcourt.', 'You choose a soft reset that makes the opponent contact below net height.'],
    [4.5, 'You are defending repeated attacks on a close point.', 'Your reset lands softly in the kitchen and stops the attack.'],
  ],
  transition_play: [
    [3, 'Your deep return gives you time to approach the kitchen.', 'You reach the kitchen line and get balanced before the next shot arrives.'],
    [3.5, 'You move forward after a low drop.', 'You stop balanced as the opponent hits, instead of hitting while running.'],
    [4, 'Your drop floats high enough for an opponent to attack.', 'You stop advancing and prepare to defend the next ball.'],
    [4.5, 'Your team is moving through midcourt under pressure.', 'You advance together behind a low reset without leaving one partner behind.'],
  ],
  overheads_lobs: [
    [3, 'A high ball is within comfortable overhead reach.', 'Your overhead lands inside the court.'],
    [3.5, 'An opponent sends you a reachable lob.', 'You contact the overhead while balanced and keep it in court.'],
    [4, 'Both opponents crowd the kitchen. You are balanced on a soft ball.', 'Your chosen lob clears their reach and lands inside the baseline.'],
    [4.5, 'A lob passes over you on a close point.', 'You call a switch and your team returns the ball without colliding.'],
  ],
  positioning: [
    [2.5, 'You are the serving team and the return is coming back.', 'You let the return bounce before playing your team’s next shot.'],
    [3.5, 'Your partner is pulled toward a sideline at the kitchen.', 'You shift with them to cover the middle gap.'],
    [4, 'A ball travels between you and your partner.', 'You communicate who takes it and cover the space they leave.'],
    [4.5, 'Your partner is out of position during a fast rally.', 'You cover the open court until your team recovers its positions.'],
  ],
  strategy: [
    [2.5, 'Off balance, you must hit from below net height.', 'You choose a controlled reply instead of attempting a winner.'],
    [3.5, 'You have missed the same risky attack twice in a game.', 'You use a safer option the next time that situation occurs.'],
    [4, 'Your opponents keep winning points with the same pattern.', 'You change your placement or pace to stop giving them that pattern.'],
    [4.5, 'At 9–9, a rally offers both a risky attack and a controlled option.', 'You use the option that fits the ball’s height and your court position.'],
  ],
};

export const QUESTION_BANK_V2: readonly AssessmentItem[] = Object.freeze(
  Object.entries(scenarios).flatMap(([key, prompts], skillIndex) => {
    const subskill = key as Subskill;
    return prompts.map(([anchorLevel, situation, success], stage): AssessmentItem => ({
      itemKey: `v2_${subskill}_${stage}`, version: 2,
      text: 'Out of 10 opportunities like this, how often do you succeed?',
      situation, success, subskill, domain: SUBSKILL_DOMAIN[subskill],
      dimension: DIMENSIONS[stage], anchorLevel, weight: 1,
      isEssential: isEssentialSubskill(subskill), contradictionGroup: subskill,
      prerequisite: stage ? { itemKey: `v2_${subskill}_${stage >= 2 ? 1 : 0}` } : null,
      adaptive: null, phase: stage === 0 ? 'foundation' : 'targeted',
      order: stage * 16 + skillIndex, active: true,
    }));
  }).sort((a, b) => a.order - b.order),
);

export const MEASURE_LABELS = {
  execution: 'Shot execution', consistency: 'Repeatability',
  application: 'Decisions & placement', pressure: 'Under pressure',
} as const;
