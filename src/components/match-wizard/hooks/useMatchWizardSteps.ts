export interface PlayerSlot {
  playerId: string | null;
  isGuest: boolean;
  guestName?: string;
  guestNotes?: string;
}

export interface MatchWizardFormData {
  // Tile 0: Date & Location
  matchDate: string; // YYYY-MM-DD
  locationId: string | null; // UUID from courts table
  customLocation: {
    id?: string;
    name: string;
    city: string;
    state: string;
  } | null;
  
  // Tile 1: Match Type
  matchFormat: 'singles' | 'doubles';
  
  // Tile 2: Player Selection
  team1: PlayerSlot[];
  team2: PlayerSlot[];
  
  // Tile 3: Score Entry
  winner: 1 | 2 | null;
  winnerScore: number | null;
  loserScore: number | null;
  
  // Tile 4: Review
  updateRatings: boolean;
}

export interface WizardStep {
  id: string;
  label: string;
  isOptional?: boolean;
}

// Natural flow: "What kind?" → "Who?" → "Score?" → "Where/When?" → "Review".
// Asking the player to set a venue before they've even picked singles vs doubles
// is the wrong mental order; this matches how a casual player narrates a match
// they just finished.
const ALL_STEPS: WizardStep[] = [
  { id: 'match-type', label: 'Match Type' },
  { id: 'players', label: 'Players' },
  { id: 'score', label: 'Score' },
  { id: 'date-location', label: 'When & Where' },
  { id: 'review', label: 'Review' },
];

export function useMatchWizardSteps(formData: MatchWizardFormData) {
  const steps = ALL_STEPS;
  const totalSteps = steps.length;

  const hasGuests = () => {
    const allPlayers = [...formData.team1, ...formData.team2];
    return allPlayers.some(p => p.isGuest);
  };

  const getRequiredPlayerCount = () => {
    return formData.matchFormat === 'singles' ? 1 : 2;
  };

  const isStepValid = (stepId: string): boolean => {
    switch (stepId) {
      case 'date-location':
        return !!(formData.matchDate && (formData.locationId || formData.customLocation));
      
      case 'match-type':
        return !!formData.matchFormat;
      
      case 'players': {
        const requiredCount = getRequiredPlayerCount();
        const team1Valid = formData.team1.filter(p => p.playerId || p.isGuest).length === requiredCount;
        const team2Valid = formData.team2.filter(p => p.playerId || p.isGuest).length === requiredCount;
        return team1Valid && team2Valid;
      }
      
      case 'score':
        return formData.winner !== null && 
               formData.winnerScore !== null && 
               formData.loserScore !== null &&
               formData.winnerScore > formData.loserScore;
      
      case 'review':
        return true;
      
      default:
        return false;
    }
  };

  const getStepIndex = (stepId: string): number => {
    return steps.findIndex(s => s.id === stepId);
  };

  const getStepById = (stepId: string): WizardStep | undefined => {
    return steps.find(s => s.id === stepId);
  };

  return {
    steps,
    totalSteps,
    isStepValid,
    getStepIndex,
    getStepById,
    hasGuests,
    getRequiredPlayerCount,
  };
}

export function getInitialFormData(): MatchWizardFormData {
  const today = new Date().toISOString().split('T')[0];
  const savedFormat = localStorage.getItem('pulse-last-match-format') as 'singles' | 'doubles' | null;
  
  return {
    matchDate: today,
    locationId: null,
    customLocation: null,
    matchFormat: savedFormat || 'doubles',
    team1: [
      { playerId: null, isGuest: false },
      { playerId: null, isGuest: false },
    ],
    team2: [
      { playerId: null, isGuest: false },
      { playerId: null, isGuest: false },
    ],
    winner: null,
    winnerScore: null,
    loserScore: null,
    updateRatings: true,
  };
}
