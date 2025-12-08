import { Match, MatchStatus, Team, Player, Game, Goal, GameStatus, GamePhase, Standing, PenaltyKick, PlayerPosition } from '../types';
import { generateFixtures } from '../utils/fixtureGenerator';
import { playerService } from './playerService';

const STORAGE_KEY = 'pelada_manager_matches';

export const matchService = {
  getAll: async (): Promise<Match[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  getById: async (id: string): Promise<Match | undefined> => {
    const matches = await matchService.getAll();
    return matches.find(m => m.id === id);
  },

  createDraft: async (teams: Team[], config: { type: 'Quadrangular' | 'Triangular', date: string, location: string }): Promise<Match> => {
    const matches = await matchService.getAll();
    
    const newMatch: Match = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      date: config.date,
      location: config.location,
      type: config.type,
      status: MatchStatus.DRAFT,
      teams: teams,
      games: [],
      goals: []
    };

    matches.unshift(newMatch);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    return newMatch;
  },

  updateMatch: async (updatedMatch: Match): Promise<void> => {
    const matches = await matchService.getAll();
    const index = matches.findIndex(m => m.id === updatedMatch.id);
    if (index !== -1) {
      matches[index] = updatedMatch;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    }
  },

  deleteMatch: async (id: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    let matches = await matchService.getAll();
    const initialLength = matches.length;
    matches = matches.filter(m => m.id !== id);
    
    if (matches.length !== initialLength) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    }
  },

  removePlayerFromTeam: async (matchId: string, teamId: string, playerId: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const team = match.teams.find(t => t.id === teamId);
    if (team) {
      const playerIndex = team.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const removedPlayer = team.players[playerIndex];
        team.players.splice(playerIndex, 1);
        team.totalOvr -= removedPlayer.initial_ovr;
        team.avgOvr = team.players.length > 0 ? Math.round(team.totalOvr / team.players.length) : 0;
        if (removedPlayer.playStyle) {
             team.styleCounts[removedPlayer.playStyle as string] = Math.max(0, (team.styleCounts[removedPlayer.playStyle as string] || 1) - 1);
        }
      }
    }
    await matchService.updateMatch(match);
    return match;
  },

  addPlayerToTeam: async (matchId: string, teamId: string, player: Player): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const team = match.teams.find(t => t.id === teamId);
    if (team) {
      team.players.push(player);
      team.totalOvr += player.initial_ovr;
      team.avgOvr = Math.round(team.totalOvr / team.players.length);
      const style = player.playStyle || 'Unknown';
      team.styleCounts[style] = (team.styleCounts[style] || 0) + 1;
    }
    await matchService.updateMatch(match);
    return match;
  },

  publishMatch: async (matchId: string): Promise<void> => {
    const match = await matchService.getById(matchId);
    if (match) {
      match.status = MatchStatus.OPEN;
      match.games = generateFixtures(match.id, match.teams, match.type);
      await matchService.updateMatch(match);
    }
  },

  // --- NOVA FUNÇÃO: Cancelar Evento (Voltar para Rascunho) ---
  revertToDraft: async (matchId: string): Promise<void> => {
    const match = await matchService.getById(matchId);
    if (match) {
      match.status = MatchStatus.DRAFT;
      match.games = []; // Limpa os jogos gerados para evitar inconsistências
      match.goals = []; // Limpa gols se houver algum perdido
      await matchService.updateMatch(match);
    }
  },

  finishMatch: async (matchId: string): Promise<void> => {
    const match = await matchService.getById(matchId);
    if (!match) return;

    match.status = MatchStatus.FINISHED;
    await matchService.updateMatch(match);

    const standings = matchService.calculateStandings(match);
    const deltaUpdates: Record<string, number> = {};
    const rankBonuses = [1.0, 0.5, 0.0, -0.5];

    standings.forEach((standing, index) => {
      const bonus = rankBonuses[index] !== undefined ? rankBonuses[index] : -0.5;
      const team = match.teams.find(t => t.id === standing.teamId);
      if (team) {
        team.players.forEach(p => {
          deltaUpdates[p.id] = (deltaUpdates[p.id] || 0) + bonus;
        });
      }
    });

    const allGoals = match.goals || [];
    
    for (const team of match.teams) {
      const teamGames = match.games.filter(g => 
        g.status === GameStatus.FINISHED && 
        (g.homeTeamId === team.id || g.awayTeamId === team.id)
      );

      for (const player of team.players) {
        const goals = allGoals.filter(g => g.scorerId === player.id).length;
        const assists = allGoals.filter(g => g.assistId === player.id).length;
        
        let cleanSheets = 0;
        let goalsConceded = 0;

        teamGames.forEach(g => {
           let opponentScore = 0;
           if (g.homeTeamId === team.id) opponentScore = g.awayScore;
           else opponentScore = g.homeScore;

           goalsConceded += opponentScore;
           if (opponentScore === 0) cleanSheets++;
        });

        let individualPoints = 0;

        switch (player.position) {
          case PlayerPosition.ATACANTE:
            individualPoints = (goals * 0.3) + (assists * 0.2);
            break;
          case PlayerPosition.MEIO_CAMPO:
            individualPoints = (goals * 0.2) + (assists * 0.3);
            break;
          case PlayerPosition.DEFENSOR:
            individualPoints = (cleanSheets * 0.4) + (goals * 0.3) + (assists * 0.2) - (goalsConceded * 0.1);
            break;
          case PlayerPosition.GOLEIRO:
            individualPoints = (cleanSheets * 1.0) - (goalsConceded * 0.1);
            break;
        }
        deltaUpdates[player.id] = (deltaUpdates[player.id] || 0) + individualPoints;
      }
    }
    await playerService.updatePlayerDeltas(deltaUpdates);
  },

  ensureFixtures: async (matchId: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    if (match.status === MatchStatus.OPEN && (!match.games || match.games.length === 0)) {
        match.games = generateFixtures(match.id, match.teams, match.type);
        await matchService.updateMatch(match);
    }
    return match;
  },

  startGame: async (matchId: string, gameId: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');
    
    const game = match.games.find(g => g.id === gameId);
    if (game && game.status === GameStatus.WAITING) {
        game.status = GameStatus.LIVE;
        await matchService.updateMatch(match);
    }
    return match;
  },

  endMatch: async (matchId: string, gameId: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');
    
    const game = match.games.find(g => g.id === gameId);
    if (game && game.status === GameStatus.LIVE) {
        game.status = GameStatus.FINISHED;
        
        let homeWon = game.homeScore > game.awayScore;
        let awayWon = game.awayScore > game.homeScore;

        if (game.homeScore === game.awayScore && game.penaltyShootout) {
             if (game.penaltyShootout.homeScore > game.penaltyShootout.awayScore) homeWon = true;
             else if (game.penaltyShootout.awayScore > game.penaltyShootout.homeScore) awayWon = true;
        }

        if (match.type === 'Quadrangular') {
            const phase1Games = match.games.filter(g => g.phase === GamePhase.PHASE_1);
            const isPhase1Done = phase1Games.every(g => g.status === GameStatus.FINISHED);

            if (isPhase1Done) {
                const phase2Games = match.games.filter(g => g.phase === GamePhase.PHASE_2);
                const needsSeeding = phase2Games.some(g => g.homeTeamId === 'TBD');

                if (needsSeeding) {
                    const standings = matchService.calculateStandings(match);
                    if (phase2Games[0]) {
                        phase2Games[0].homeTeamId = standings[0].teamId;
                        phase2Games[0].awayTeamId = standings[3].teamId;
                    }
                    if (phase2Games[1]) {
                        phase2Games[1].homeTeamId = standings[1].teamId;
                        phase2Games[1].awayTeamId = standings[2].teamId;
                    }
                }
            }

            const phase2Games = match.games.filter(g => g.phase === GamePhase.PHASE_2);
            const isPhase2Done = phase2Games.length > 0 && phase2Games.every(g => g.status === GameStatus.FINISHED);

            if (isPhase2Done) {
                 const finalGame = match.games.find(g => g.phase === GamePhase.FINAL);
                 const thirdGame = match.games.find(g => g.phase === GamePhase.THIRD_PLACE);

                 if (finalGame && finalGame.homeTeamId === 'TBD') {
                      const standings = matchService.calculateStandings(match);
                      finalGame.homeTeamId = standings[0].teamId;
                      finalGame.awayTeamId = standings[1].teamId;
                      
                      if (thirdGame) {
                          thirdGame.homeTeamId = standings[2].teamId;
                          thirdGame.awayTeamId = standings[3].teamId;
                      }
                 }
            }
        }
        await matchService.updateMatch(match);
    }
    return match;
  },

  scoreGoal: async (matchId: string, gameId: string, teamId: string, scorerId: string, assistId?: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const game = match.games.find(g => g.id === gameId);
    if (game && game.status === GameStatus.LIVE) {
        const goal: Goal = {
            id: crypto.randomUUID(),
            gameId,
            teamId,
            scorerId,
            assistId,
            minute: new Date().getMinutes()
        };
        match.goals = match.goals || [];
        match.goals.push(goal);

        if (game.homeTeamId === teamId) {
            game.homeScore += 1;
        } else {
            game.awayScore += 1;
        }

        await matchService.updateMatch(match);
    }
    return match;
  },

  updateGoal: async (matchId: string, goalId: string, scorerId: string, assistId?: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const goal = match.goals?.find(g => g.id === goalId);
    if (goal) {
        goal.scorerId = scorerId;
        goal.assistId = assistId;
        await matchService.updateMatch(match);
    }
    return match;
  },

  initializePenaltyShootout: async (matchId: string, gameId: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const game = match.games.find(g => g.id === gameId);
    if (game && game.status === GameStatus.LIVE) {
        if (!game.penaltyShootout) {
            game.penaltyShootout = {
                homeScore: 0,
                awayScore: 0,
                history: []
            };
            await matchService.updateMatch(match);
        }
    }
    return match;
  },

  registerPenalty: async (matchId: string, gameId: string, teamId: string, isGoal: boolean): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const game = match.games.find(g => g.id === gameId);
    if (game && game.status === GameStatus.LIVE) {
        if (!game.penaltyShootout) {
            game.penaltyShootout = { homeScore: 0, awayScore: 0, history: [] };
        }

        const kick: PenaltyKick = {
            teamId,
            isGoal,
            round: game.penaltyShootout.history.length + 1
        };

        game.penaltyShootout.history.push(kick);

        if (isGoal) {
            if (teamId === game.homeTeamId) game.penaltyShootout.homeScore += 1;
            else game.penaltyShootout.awayScore += 1;
        }
        await matchService.updateMatch(match);
    }
    return match;
  },

  // --- NOVA FUNÇÃO: Desfazer Pênalti ---
  undoLastPenalty: async (matchId: string, gameId: string): Promise<Match> => {
      const match = await matchService.getById(matchId);
      if (!match) throw new Error('Match not found');

      const game = match.games.find(g => g.id === gameId);
      if (game && game.status === GameStatus.LIVE && game.penaltyShootout) {
          const lastKick = game.penaltyShootout.history.pop();
          
          if (lastKick && lastKick.isGoal) {
              if (lastKick.teamId === game.homeTeamId) {
                  game.penaltyShootout.homeScore = Math.max(0, game.penaltyShootout.homeScore - 1);
              } else {
                  game.penaltyShootout.awayScore = Math.max(0, game.penaltyShootout.awayScore - 1);
              }
          }
          await matchService.updateMatch(match);
      }
      return match;
  },

  calculateStandings: (match: Match): Standing[] => {
    const standings: Record<string, Standing> = {};

    match.teams.forEach(t => {
        standings[t.id] = {
            teamId: t.id,
            teamName: t.name,
            played: 0,
            points: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0
        };
    });

    match.games.forEach(game => {
        const isPointBased = game.phase === GamePhase.PHASE_1 || game.phase === GamePhase.PHASE_2;
        
        if (game.status === GameStatus.FINISHED && isPointBased) {
             const home = standings[game.homeTeamId];
             const away = standings[game.awayTeamId];

             if (!home || !away) return; 

             home.played++;
             away.played++;
             home.goalsFor += game.homeScore;
             home.goalsAgainst += game.awayScore;
             away.goalsFor += game.awayScore;
             away.goalsAgainst += game.homeScore;

             if (game.homeScore > game.awayScore) {
                 home.points += 3;
                 home.wins++;
                 away.losses++;
             } else if (game.awayScore > game.homeScore) {
                 away.points += 3;
                 away.wins++;
                 home.losses++;
             } else {
                 home.points += 1;
                 home.draws++;
                 away.points += 1;
                 away.draws++;
             }
        }
    });

    return Object.values(standings).map(s => ({
        ...s,
        goalDiff: s.goalsFor - s.goalsAgainst
    })).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
    });
  }
};