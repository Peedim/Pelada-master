
import { Team, Game, GameStatus, GamePhase } from '../types';

export const generateFixtures = (matchId: string, teams: Team[], type: 'Quadrangular' | 'Triangular'): Game[] => {
  const games: Game[] = [];
  let sequence = 1;

  const createGame = (homeId: string, awayId: string, phase: GamePhase): Game => ({
    id: crypto.randomUUID(),
    matchId,
    homeTeamId: homeId,
    awayTeamId: awayId,
    homeScore: 0,
    awayScore: 0,
    status: GameStatus.WAITING,
    phase,
    sequence: sequence++
  });

  if (type === 'Triangular') {
    // A vs B, B vs C, C vs A (x2)
    // Teams indices: 0, 1, 2
    if (teams.length < 3) return [];

    const rounds = [
        [0, 1], [1, 2], [2, 0], // Leg 1
        [0, 1], [1, 2], [2, 0]  // Leg 2
    ];
    rounds.forEach(([h, a]) => {
        games.push(createGame(teams[h].id, teams[a].id, GamePhase.PHASE_1)); // Reusing PHASE_1 for triangular basic
    });
  } else {
    // Quadrangular - New 4 Phase Structure
    if (teams.length < 4) return [];

    // --- FASE 1: Round Robin (Single Leg) ---
    // A vs B, C vs D
    // A vs C, B vs D
    // A vs D, B vs C
    const phase1Rounds = [
        [[0, 1], [2, 3]],
        [[0, 2], [1, 3]],
        [[0, 3], [1, 2]],
    ];
    
    phase1Rounds.forEach(round => {
        round.forEach(([h, a]) => {
            games.push(createGame(teams[h].id, teams[a].id, GamePhase.PHASE_1));
        });
    });

    // --- FASE 2: Intermediária (Valendo Pontos) ---
    // Placeholder: 1st vs 4th, 2nd vs 3rd (Based on Phase 1)
    games.push({
        ...createGame('TBD', 'TBD', GamePhase.PHASE_2),
        sequence: sequence++ // 7
    });
    games.push({
        ...createGame('TBD', 'TBD', GamePhase.PHASE_2),
        sequence: sequence++ // 8
    });

    // --- FASE 3: Disputa de 3º Lugar (Não vale pontos) ---
    // Placeholder: 3rd vs 4th (Based on Phase 1+2)
    games.push({
        ...createGame('TBD', 'TBD', GamePhase.THIRD_PLACE),
        sequence: sequence++ // 9
    });

    // --- FASE 4: Grande Final (Não vale pontos) ---
    // Placeholder: 1st vs 2nd (Based on Phase 1+2)
    games.push({
        ...createGame('TBD', 'TBD', GamePhase.FINAL),
        sequence: sequence++ // 10
    });
  }

  return games;
};
