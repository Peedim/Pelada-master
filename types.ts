export enum PlayerPosition {
  GOLEIRO = 'Goleiro',
  DEFENSOR = 'Defensor',
  MEIO_CAMPO = 'Meio-campo',
  ATACANTE = 'Atacante'
}

export enum PlayStyle {
  WALL = 'Muralha',
  SWEEPER_KEEPER = 'Goleiro Linha',
  ANCHOR = 'Defensor Fixo',
  ALL_ROUNDER = 'Coringa',
  PIVOT = 'Pivô',
  DRIBBLER = 'Driblador',
  PACER = 'Pace Certeiro',
  SUPPORT = 'Suporte',
  FINISHER = 'Finalizador',
  POACHER = 'Caça-Gols'
}

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
}

export interface PlayerAccumulators {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
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
  shirt_number?: number;
  initial_ovr: number;
  photo_url?: string;
  is_admin: boolean;
  attributes: PlayerAttributes;
  accumulators: PlayerAccumulators;
  monthly_delta: number;
  ovr_history: OvrHistoryEntry[];
}

export interface PlayerFormData extends Omit<Player, 'id' | 'created_at' | 'attributes' | 'accumulators' | 'monthly_delta' | 'ovr_history'>, PlayerAttributes {}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  totalOvr: number;
  avgOvr: number;
  styleCounts: Record<string, number>;
}

export enum MatchStatus { DRAFT = 'DRAFT', OPEN = 'OPEN', FINISHED = 'FINISHED' }
export enum GameStatus { WAITING = 'WAITING', LIVE = 'LIVE', FINISHED = 'FINISHED' }
export enum GamePhase { PHASE_1 = 'PHASE_1', PHASE_2 = 'PHASE_2', THIRD_PLACE = 'THIRD_PLACE', FINAL = 'FINAL' }

export interface PenaltyKick { teamId: string; isGoal: boolean; kickerId?: string; round: number; }
export interface PenaltyShootout { homeScore: number; awayScore: number; history: PenaltyKick[]; }

export interface Game {
  id: string;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
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
  games: Game[];
  goals: Goal[];
  champion_photo_url?: string; // <--- NOVO CAMPO
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