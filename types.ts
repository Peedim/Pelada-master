
export enum PlayerPosition {
  GOLEIRO = 'Goleiro',
  DEFENSOR = 'Defensor',
  MEIO_CAMPO = 'Meio-campo',
  ATACANTE = 'Atacante'
}

export enum PlayStyle {
  // Goleiros
  WALL = 'Muralha',
  SWEEPER_KEEPER = 'Goleiro Linha',
  
  // Defensores
  ANCHOR = 'Defensor Fixo',
  ALL_ROUNDER = 'Coringa', // Def/Meia
  
  // Meias
  PIVOT = 'Pivô',
  DRIBBLER = 'Driblador',
  PACER = 'Pace Certeiro', // Meia/Ata
  SUPPORT = 'Suporte', // Geral
  
  // Atacantes
  FINISHER = 'Finalizador',
  POACHER = 'Caça-Gols'
}

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface OvrHistoryEntry {
  date: string;
  ovr: number;
}

export interface Player {
  id: string;
  created_at?: string;
  name: string;
  email: string;
  position: PlayerPosition | string;
  playStyle: PlayStyle | string;
  shirt_number: number;
  initial_ovr: number;
  photo_url?: string;
  is_admin: boolean;
  attributes: PlayerAttributes;
  monthly_delta: number; // Acumulado invisível mensal
  ovr_history: OvrHistoryEntry[]; // Histórico de evolução
}

export interface PlayerFormData extends Omit<Player, 'id' | 'created_at' | 'attributes' | 'monthly_delta' | 'ovr_history'>, PlayerAttributes {
  // Flat structure for the form
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  totalOvr: number;
  avgOvr: number;
  styleCounts: Record<string, number>; // For debugging/analysis
}

export enum MatchStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  FINISHED = 'FINISHED'
}

export enum GameStatus {
  WAITING = 'WAITING',
  LIVE = 'LIVE',
  FINISHED = 'FINISHED'
}

export enum GamePhase {
  PHASE_1 = 'PHASE_1', // Round Robin (Points)
  PHASE_2 = 'PHASE_2', // 1st vs 4th, 2nd vs 3rd (Points)
  THIRD_PLACE = 'THIRD_PLACE', // 3rd vs 4th (No Points - Title)
  FINAL = 'FINAL' // 1st vs 2nd (No Points - Title)
}

export interface PenaltyKick {
  teamId: string;
  isGoal: boolean;
  kickerId?: string;
  round: number;
}

export interface PenaltyShootout {
  homeScore: number;
  awayScore: number;
  history: PenaltyKick[];
}

export interface Game {
  id: string;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string; // Can be 'TBD' for finals
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  phase: GamePhase;
  sequence: number;
  penaltyShootout?: PenaltyShootout;
}

export interface Goal {
  id: string;
  gameId: string;
  teamId: string;
  scorerId: string;
  assistId?: string;
  minute?: number;
}

export interface Match {
  id: string;
  created_at: string;
  date: string;
  location: string;
  type: 'Quadrangular' | 'Triangular';
  status: MatchStatus;
  teams: Team[];
  games: Game[]; // List of games
  goals: Goal[]; // Log of all goals
}

export interface Standing {
  teamId: string;
  teamName: string;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}
