export enum PlayerPosition {
  GOLEIRO = 'Goleiro',
  DEFENSOR = 'Defensor',
  MEIO_CAMPO = 'Meio-campo',
  ATACANTE = 'Atacante'
}

export enum PlayStyle {
  ARTILHEIRO = 'Artilheiro',
  GARCOM = 'Garçom',
  PAREDAO = 'Paredão',
  MOTORZINHO = 'Motorzinho',
  MAESTRO = 'Maestro',
  LISO = 'Liso',
  XERIFE = 'Xerife',
  CORINGA = 'Coringa',
  MURALHA = 'Muralha',         // <--- NOVO
  GOLEIRO_LINHA = 'Goleiro Linha' // <--- NOVO
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
  featured_achievement_id?: string;
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

// --- RANKINGS & CONQUISTAS ---

export type RankingCategory = 'wins' | 'goals' | 'assists' | 'clean_sheets';

// Interface para um item da lista de ranking (ex: João, 10 gols)
export interface PlayerRankingStats {
  playerId: string;
  playerName: string;
  playerPhoto?: string;
  position: string; // Para mostrar ícone ou cor
  value: number;    // O número (gols, vitórias, etc)
}

// Interface que agrupa todos os rankings de um período
export interface RankingsData {
  wins: PlayerRankingStats[];
  goals: PlayerRankingStats[];
  assists: PlayerRankingStats[];
  cleanSheets: PlayerRankingStats[];
}

// Interface para o dado salvo no banco (Hall da Fama)
export interface MonthlyChampion {
  id: string;
  month_key: string; // "MM-YYYY"
  category: RankingCategory;
  player_id: string;
  stat_value: number;
  player?: Player; // Para o join ao exibir
}