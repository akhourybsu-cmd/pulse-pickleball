import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, ArrowRight, Check, ChevronLeft, ChevronRight, Coffee, ListOrdered, Maximize2, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { canScoreCommandMatch, commandSchedule, type CommandMatch } from '@/lib/roundRobin/commandCenter';
import './command-center.css';

type Mode = 'live' | 'next' | 'schedule';
interface Props {
  name: string;
  status: 'draft' | 'live' | 'completed' | 'voided';
  voided: boolean;
  currentRound: number;
  totalRounds: number;
  canStart: boolean;
  matches: CommandMatch[];
  scores: Record<string, { team1_score?: number; team2_score?: number }>;
  savingScore: string | null;
  busy: boolean;
  loadError: string | null;
  onRefresh: () => Promise<void>;
  onScoreChange: (id: string, team: 'team1' | 'team2', value: string) => void;
  onSaveScore: (id: string) => Promise<void>;
  onStart: () => Promise<void>;
  onAdvance: () => Promise<void>;
  onComplete: () => Promise<void>;
}

export function OrganizerCommandCenter(props: Props) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="rr-command-launch">
          <span className="rr-command-launch-icon"><Maximize2 size={20} /></span>
          <span><strong>Command center</strong><small>Full-screen courts & schedule</small></span>
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="rr-command-overlay" />
        <Dialog.Content className="rr-command" onOpenAutoFocus={event => event.preventDefault()}>
          <CommandPanel {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CommandPanel(props: Props) {
  const { name, status, voided, currentRound, totalRounds, scores, savingScore, busy, loadError } = props;
  const [mode, setMode] = useState<Mode>(status === 'completed' || status === 'voided' || voided ? 'schedule' : 'live');
  const [browsedRound, setBrowsedRound] = useState(currentRound);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const data = commandSchedule(props.matches, currentRound);
  const ended = voided || status === 'voided' || status === 'completed';
  const round = mode === 'live' ? currentRound : mode === 'next' ? ended ? null : status === 'draft' ? data.rounds[0] ?? null : data.nextRound
    : data.rounds.includes(browsedRound) ? browsedRound : data.rounds[0] ?? null;
  const roundIndex = round === null ? -1 : data.rounds.indexOf(round);
  const roundMatches = data.matches.filter(match => match.round_no === round);
  const courts = roundMatches.filter(match => !match.is_bye).sort((a, b) => a.court_no - b.court_no);
  const resting = roundMatches.filter(match => match.is_bye).flatMap(match => [...match.team1, ...match.team2]);
  const pages = courts.length + (resting.length > 0 ? 1 : 0);
  const selectedIndex = selectedCourt === 'rest' && resting.length ? courts.length : courts.findIndex(match => match.id === selectedCourt);
  const courtIndex = Math.max(0, selectedIndex);
  const match = courts[courtIndex];
  const waiting = busy || actionBusy;
  const canScore = !!match && canScoreCommandMatch(match, status, currentRound, voided) && !loadError;
  const result = !!match && match.team1_score !== null && match.team2_score !== null;

  useEffect(() => {
    closeRef.current?.focus();
    // Follow the visible area when a mobile score keyboard opens.
    const viewport = window.visualViewport;
    const resize = () => {
      const frame = panelRef.current?.parentElement;
      if (!frame || !viewport) return;
      frame.style.height = `${viewport.height}px`;
      frame.style.top = `${viewport.offsetTop}px`;
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
    };
  }, []);

  function changeRound(value: number) { setBrowsedRound(value); setSelectedCourt(null); }
  function changeCourt(index: number) { setSelectedCourt(courts[index]?.id ?? 'rest'); }
  async function runAction(action: () => Promise<void>) {
    if (waiting) return;
    setActionBusy(true);
    try { await action(); } finally { setActionBusy(false); }
  }

  const primaryAction = status === 'draft' ? props.onStart : currentRound < totalRounds ? props.onAdvance : props.onComplete;
  const primaryLabel = status === 'draft' ? 'Start event' : currentRound < totalRounds ? `Start round ${currentRound + 1}` : 'Complete event';

  return (
    <div ref={panelRef} className="rr-command-frame">
      <header className="rr-command-header">
        <div><p><Activity size={14} /> PULSE <span>COMMAND CENTER</span></p><Dialog.Title title={name}>{name}</Dialog.Title></div>
        <Dialog.Close asChild><button ref={closeRef} className="rr-command-close" aria-label="Close command center"><X size={20} /><span>Close</span></button></Dialog.Close>
        <Dialog.Description className="sr-only">Browse courts and rounds, enter live scores, and move play forward. Browsing the schedule does not advance the event.</Dialog.Description>
      </header>
      <Tabs className="rr-command-tabs" value={mode} onValueChange={value => { setMode(value as Mode); setSelectedCourt(null); }}>
        <div className="rr-command-roundbar">
          {mode === 'schedule' ? (
            <div className="rr-command-picker">
              <button aria-label="Previous round" disabled={roundIndex <= 0} onClick={() => changeRound(data.rounds[roundIndex - 1])}><ChevronLeft /></button>
              <select aria-label="Choose round" value={round ?? ''} onChange={event => changeRound(Number(event.target.value))}>
                {!data.rounds.length && <option value="">No rounds</option>}
                {data.rounds.map(value => <option key={value} value={value}>Round {value}{value === currentRound && status === 'live' && !voided ? ' · Live' : ''}</option>)}
              </select>
              <button aria-label="Next round" disabled={roundIndex < 0 || roundIndex >= data.rounds.length - 1} onClick={() => changeRound(data.rounds[roundIndex + 1])}><ChevronRight /></button>
            </div>
          ) : <div className="rr-command-round-title"><span>{mode === 'next' ? 'NEXT UP' : ended ? 'EVENT CLOSED' : status === 'draft' ? 'READY TO PLAY' : 'ON COURT'}</span><strong>{round === null ? 'All rounds covered' : `Round ${round}`}</strong></div>}
          <span className="rr-command-state">{ended ? voided || status === 'voided' ? 'Voided' : 'Complete' : status === 'draft' ? 'Preview' : round === currentRound ? <><i /> Live</> : 'Preview'}</span>
        </div>
        {loadError && <div className="rr-command-error" role="status">Could not refresh. Retry before scoring.<button onClick={() => void props.onRefresh()}>Retry</button></div>}
        {(['live', 'next', 'schedule'] as const).map(value => (
          <TabsContent key={value} value={value} className="rr-command-panel" tabIndex={-1}>
            <div className="rr-command-stage" key={`${round}-${match?.id ?? 'rest'}`}>
              {match ? (
                <article className="rr-command-court" aria-label={`Round ${round}, Court ${match.court_no}`}>
                  <div className="rr-command-court-heading"><h2>Court {match.court_no}</h2><span aria-live="polite">{match.abandoned ? 'Abandoned' : result ? <><Check size={14} /> Score saved</> : canScore ? 'Awaiting score' : ended ? 'No result' : 'Matchup'}</span></div>
                  <div className="rr-command-teams">
                    {([1, 2] as const).map(team => {
                      const names = team === 1 ? match.team1 : match.team2;
                      const score = team === 1 ? match.team1_score : match.team2_score;
                      const other = team === 1 ? match.team2_score : match.team1_score;
                      return <div key={team} className="rr-command-team" data-winner={result && score! > other!}>
                        <div><span className="rr-command-team-label">TEAM {team}</span>{names.map((player, index) => <p key={index}>{player}</p>)}</div>
                        {canScore ? <Input type="number" inputMode="numeric" min={0} max={99} placeholder="—" aria-label={`Court ${match.court_no}, team ${team} score`} value={scores[match.id]?.[team === 1 ? 'team1_score' : 'team2_score'] ?? ''} disabled={waiting} onChange={event => props.onScoreChange(match.id, team === 1 ? 'team1' : 'team2', event.target.value)} />
                          : <strong className="rr-command-score">{match.abandoned ? '—' : score ?? '—'}</strong>}
                      </div>;
                    })}
                    <span className="rr-command-versus" aria-hidden="true">VS</span>
                  </div>
                  <div className="rr-command-court-action">
                    {canScore ? <Button disabled={waiting || scores[match.id]?.team1_score === undefined || scores[match.id]?.team2_score === undefined} onClick={() => void runAction(() => props.onSaveScore(match.id))}>{savingScore === match.id ? 'Saving…' : 'Save score'}<Check size={16} /></Button>
                      : <p>{match.abandoned ? 'This game was stopped. It counts as resolved.' : result ? 'Result recorded. Browse the next court when ready.' : ended ? 'Event closed · schedule kept for reference.' : status === 'draft' ? 'Start the event when your players are ready.' : `Saved assignment · starts when round ${round} goes live.`}</p>}
                  </div>
                </article>
              ) : resting.length > 0 ? (
                <article className="rr-command-rest"><Coffee size={28} /><h2>Resting this round</h2><p>Check Schedule for their next assignment.</p><ul>{resting.map((player, index) => <li key={index}>{player}</li>)}</ul></article>
              ) : <div className="rr-command-empty"><Check size={32} /><h2>{round === null ? ended ? 'Event closed' : 'No next round' : 'No courts scheduled'}</h2><p>{ended ? 'Explore saved rounds in Schedule.' : round === null ? 'You’re on the final saved round. Finish the current games when ready.' : 'Close the command center to manage your schedule.'}</p></div>}
            </div>
            {pages > 0 && <nav className="rr-command-court-nav" aria-label="Court navigation">
              <button aria-label="Previous court" disabled={courtIndex === 0} onClick={() => changeCourt(courtIndex - 1)}><ChevronLeft size={20} /></button>
              <select aria-label="Choose court or resting players" value={courtIndex} onChange={event => changeCourt(Number(event.target.value))}>
                {courts.map((court, index) => <option key={court.id} value={index}>Court {court.court_no}{court.abandoned ? ' · Abandoned' : court.team1_score !== null && court.team2_score !== null ? ' · Scored' : ''} · {index + 1} of {pages}</option>)}
                {resting.length > 0 && <option value={courts.length}>Resting · {resting.length} players</option>}
              </select>
              <button aria-label="Next court" disabled={courtIndex >= pages - 1} onClick={() => changeCourt(courtIndex + 1)}><ChevronRight size={20} /></button>
            </nav>}
          </TabsContent>
        ))}
        <footer className="rr-command-footer">
          {!ended && <div className="rr-command-mission">
            <div aria-live="polite"><strong>{status === 'draft' ? props.canStart ? 'Your courts are ready' : 'Confirm at least 4 players' : `${data.progress.resolved} / ${data.progress.total} results recorded`}</strong><small>{status === 'draft' ? `${totalRounds} rounds planned` : `Live round ${currentRound}`}</small></div>
            {(status === 'draft' || data.progress.canClose) ? <Button disabled={waiting || !!loadError || !data.rounds.length || (status === 'draft' && !props.canStart)} onClick={() => void runAction(primaryAction)}>{waiting ? 'Working…' : primaryLabel}<ArrowRight size={16} /></Button>
              : <span className="rr-command-pending">{data.progress.pending} to go</span>}
          </div>}
          <TabsList className="rr-command-nav" aria-label="Command center views">
            <TabsTrigger value="live"><Activity size={18} /><span>{ended || status === 'draft' ? 'Courts' : 'Live courts'}</span></TabsTrigger>
            <TabsTrigger value="next"><ArrowRight size={18} /><span>Next up</span></TabsTrigger>
            <TabsTrigger value="schedule"><ListOrdered size={18} /><span>Schedule</span></TabsTrigger>
          </TabsList>
        </footer>
      </Tabs>
    </div>
  );
}
