import { supabase } from './supabaseClient';
import { Match, MatchStatus, Team, Player, Game, Goal, GameStatus, GamePhase, Standing, PenaltyKick, PlayerPosition, PenaltyShootout } from '../types';
import { generateFixtures } from '../utils/fixtureGenerator';
import { playerService, OVR_WEIGHTS } from './playerService'; 

// --- HELPER: Calcula Stats do Time ---
const calculateTeamStats = (players: Player[]) => {
    const linePlayers = players.filter(p => p.position !== PlayerPosition.GOLEIRO);
    const totalOvr = players.reduce((acc, p) => acc + (p.initial_ovr || 0), 0);
    const avgOvr = linePlayers.length > 0 
        ? Math.round(linePlayers.reduce((acc, p) => acc + p.initial_ovr, 0) / linePlayers.length) 
        : 0;
    const styleCounts: Record<string, number> = {};
    players.forEach(p => {
        const style = p.playStyle || 'Unknown';
        styleCounts[style] = (styleCounts[style] || 0) + 1;
    });
    return { totalOvr, avgOvr, styleCounts };
};

// --- HELPER: Transforma dados do Banco com SEGURANÇA ---
const mapDatabaseToMatch = (dbMatch: any): Match => {
  const teams: Team[] = dbMatch.match_teams.map((t: any) => {
    const players: Player[] = t.team_players
      .map((tp: any) => {
        if (!tp.player) return null; 
        return {
            ...tp.player,
            playStyle: tp.player.play_style,
            attributes: {
                pace: tp.player.pace, shooting: tp.player.shooting, passing: tp.player.passing, defending: tp.player.defending
            },
            accumulators: {
                pace: Number(tp.player.pace_acc || 0), shooting: Number(tp.player.shooting_acc || 0),
                passing: Number(tp.player.passing_acc || 0), defending: Number(tp.player.defending_acc || 0)
            }
        };
      })
      .filter((p: any) => p !== null); 

    const { totalOvr, avgOvr, styleCounts } = calculateTeamStats(players);
    return { id: t.id, name: t.name, players, totalOvr, avgOvr, styleCounts };
  });

  return {
    id: dbMatch.id,
    created_at: dbMatch.created_at,
    date: dbMatch.date,
    location: dbMatch.location,
    type: dbMatch.type,
    status: dbMatch.status,
    teams: teams,
    games: dbMatch.games.map((g: any) => ({
      ...g,
      matchId: g.match_id,
      homeTeamId: g.home_team_id || 'TBD',
      awayTeamId: g.away_team_id || 'TBD',
      homeScore: g.home_score,
      awayScore: g.away_score,
      penaltyShootout: g.penalty_shootout
    })),
    goals: dbMatch.goals.map((gl: any) => ({
      id: gl.id,
      gameId: gl.game_id,
      teamId: gl.team_id,
      scorerId: gl.scorer_id,
      assistId: gl.assist_id,
      minute: gl.minute
    })),
    champion_photo_url: dbMatch.champion_photo_url
  };
};

export const matchService = {
  getMonthMatchCounts: async (year: number, month: number): Promise<Record<string, number>> => {
    const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('matches')
      .select('id, match_teams (team_players (player_id))')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (error) {
      console.error('Erro ao buscar contagens de partidas do mês:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    if (data) {
      data.forEach((match: any) => {
        const playersInMatch = new Set<string>();
        match.match_teams?.forEach((team: any) => {
          team.team_players?.forEach((tp: any) => {
            if (tp.player_id) {
              playersInMatch.add(tp.player_id);
            }
          });
        });
        playersInMatch.forEach(playerId => {
          counts[playerId] = (counts[playerId] || 0) + 1;
        });
      });
    }
    return counts;
  },

  getAll: async (): Promise<Match[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`*, match_teams (*, team_players (player:players (*))), games (*), goals (*)`)
      .order('date', { ascending: false });

    if (error) { console.error('Erro:', error); return []; }
    return data.map(mapDatabaseToMatch);
  },

  getById: async (id: string): Promise<Match | undefined> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`*, match_teams (*, team_players (player:players (*))), games (*), goals (*)`)
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return mapDatabaseToMatch(data);
  },

  createDraft: async (teams: Team[], config: { type: 'Quadrangular' | 'Triangular', date: string, location: string }): Promise<Match> => {
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .insert([{ date: config.date, location: config.location, type: config.type, status: MatchStatus.DRAFT }])
      .select().single();
    if (matchError) throw matchError;

    for (const team of teams) {
      const { data: teamData, error: teamError } = await supabase
        .from('match_teams')
        .insert([{ match_id: matchData.id, name: team.name, avg_ovr: team.avgOvr }])
        .select().single();
      if (teamError) throw teamError;

      if (team.players.length > 0) {
        const teamPlayersInsert = team.players.map(p => ({ team_id: teamData.id, player_id: p.id }));
        const { error: tpError } = await supabase.from('team_players').insert(teamPlayersInsert);
        if (tpError) throw tpError;
      }
    }
    return (await matchService.getById(matchData.id))!;
  },

  updateMatch: async (updatedMatch: Match): Promise<void> => {
     await supabase.from('matches').update({ location: updatedMatch.location, date: updatedMatch.date, status: updatedMatch.status }).eq('id', updatedMatch.id);
  },

  deleteMatch: async (id: string): Promise<void> => {
    await supabase.from('matches').delete().eq('id', id);
  },

  removePlayerFromTeam: async (matchId: string, teamId: string, playerId: string): Promise<Match> => {
    const { error } = await supabase
        .from('team_players')
        .delete()
        .eq('team_id', teamId)
        .eq('player_id', playerId);
    
    if (error) throw error;
    
    return (await matchService.getById(matchId))!;
  },

  addPlayerToTeam: async (matchId: string, teamId: string, player: Player): Promise<Match> => {
    await supabase.from('team_players').insert([{ team_id: teamId, player_id: player.id }]);
    return (await matchService.getById(matchId))!;
  },

  publishMatch: async (matchId: string): Promise<void> => {
    const match = await matchService.getById(matchId);
    if (!match) return;
    const generatedGames = generateFixtures(match.id, match.teams, match.type as any);
    
    const gamesInsert = generatedGames.map(g => ({
      match_id: match.id,
      phase: g.phase,
      sequence: g.sequence,
      home_team_id: match.teams.find(t => t.id === g.homeTeamId)?.id || null, 
      away_team_id: match.teams.find(t => t.id === g.awayTeamId)?.id || null, 
      status: GameStatus.WAITING,
      home_score: 0,
      away_score: 0
    }));
    await supabase.from('matches').update({ status: MatchStatus.OPEN }).eq('id', matchId);
    await supabase.from('games').insert(gamesInsert);
  },

  createTieBreakerGame: async (matchId: string, homeTeamId: string, awayTeamId: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (!match) throw new Error("Match not found");

    const exists = match.games.some(g => g.phase === GamePhase.TIE_BREAKER);
    if (exists) return match;

    await supabase.from('games').insert([{
        match_id: matchId,
        phase: GamePhase.TIE_BREAKER,
        sequence: 99, 
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        status: GameStatus.WAITING,
        home_score: 0,
        away_score: 0,
        penalty_shootout: { homeScore: 0, awayScore: 0, history: [] } 
    }]);

    return (await matchService.getById(matchId))!;
  },

  revertToDraft: async (matchId: string): Promise<void> => {
    await supabase.from('matches').update({ status: MatchStatus.DRAFT }).eq('id', matchId);
    await supabase.from('games').delete().eq('match_id', matchId);
    await supabase.from('goals').delete().eq('match_id', matchId);
  },

  ensureFixtures: async (matchId: string): Promise<Match> => {
    const match = await matchService.getById(matchId);
    if (match && match.status === MatchStatus.OPEN && match.games.length === 0) {
        await matchService.publishMatch(matchId);
        return (await matchService.getById(matchId))!;
    }
    return match!;
  },

  startGame: async (matchId: string, gameId: string): Promise<Match> => {
    await supabase.from('games').update({ status: GameStatus.LIVE }).eq('id', gameId);
    return (await matchService.getById(matchId))!;
  },
  endMatch: async (matchId: string, gameId: string): Promise<Match> => {
    await supabase.from('games').update({ status: GameStatus.FINISHED }).eq('id', gameId);
    let match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const game = match.games.find(g => g.id === gameId);
    
    if (match.type === 'Quadrangular' && game) {
        const phase1Games = match.games.filter(g => g.phase === GamePhase.PHASE_1);
        const isPhase1Done = phase1Games.every(g => g.status === GameStatus.FINISHED);

        if (isPhase1Done) {
            const phase2Games = match.games.filter(g => g.phase === GamePhase.PHASE_2);
            const needsSeeding = phase2Games.some(g => g.homeTeamId === 'TBD');

            if (needsSeeding) {
                const standings = matchService.calculateStandings(match);
                if (phase2Games[0]) await supabase.from('games').update({ home_team_id: standings[0].teamId, away_team_id: standings[3].teamId }).eq('id', phase2Games[0].id);
                if (phase2Games[1]) await supabase.from('games').update({ home_team_id: standings[1].teamId, away_team_id: standings[2].teamId }).eq('id', phase2Games[1].id);
            }
        }
        
        const phase2Games = match.games.filter(g => g.phase === GamePhase.PHASE_2);
        const isPhase2Done = phase2Games.length > 0 && phase2Games.every(g => g.status === GameStatus.FINISHED);
        
        if (isPhase2Done) {
              const activeTieBreaker = match.games.find(g => g.phase === GamePhase.TIE_BREAKER && g.status !== GameStatus.FINISHED);
              
              if (!activeTieBreaker) {
                 const finalGame = match.games.find(g => g.phase === GamePhase.FINAL);
                 const thirdGame = match.games.find(g => g.phase === GamePhase.THIRD_PLACE);
                 
                 if (finalGame) {
                     const standings = matchService.calculateStandings(match);
                     await supabase.from('games').update({ home_team_id: standings[0].teamId, away_team_id: standings[1].teamId }).eq('id', finalGame.id);
                     if (thirdGame) await supabase.from('games').update({ home_team_id: standings[2].teamId, away_team_id: standings[3].teamId }).eq('id', thirdGame.id);
                 }
              }
        }
    }
    return (await matchService.getById(matchId))!;
  },

  scoreGoal: async (matchId: string, gameId: string, teamId: string, scorerId: string, assistId?: string | null): Promise<Match> => {
    const cleanAssistId = (assistId && assistId !== 'none') ? assistId : null;
    
    const { error: goalError } = await supabase.from('goals').insert([{ 
      match_id: matchId, 
      game_id: gameId, 
      team_id: teamId, 
      scorer_id: scorerId, 
      assist_id: cleanAssistId, 
      minute: new Date().getMinutes() 
    }]);

    if (goalError) {
      console.error('Erro ao registrar gol no Supabase:', goalError);
      throw new Error(`Erro ao salvar gol: ${goalError.message}`);
    }

    const { data: game, error: gameError } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (gameError || !game) {
      throw new Error('Partida não encontrada para atualizar placar.');
    }

    if (game.home_team_id === teamId) {
      const { error: scoreErr } = await supabase.from('games').update({ home_score: game.home_score + 1 }).eq('id', gameId);
      if (scoreErr) console.error('Erro ao atualizar placar da casa:', scoreErr);
    } else {
      const { error: scoreErr } = await supabase.from('games').update({ away_score: game.away_score + 1 }).eq('id', gameId);
      if (scoreErr) console.error('Erro ao atualizar placar visitante:', scoreErr);
    }

    return (await matchService.getById(matchId))!;
  },

  updateGoal: async (matchId: string, goalId: string, scorerId: string, assistId?: string | null): Promise<Match> => {
      const cleanAssistId = (assistId && assistId !== 'none') ? assistId : null;
      const { error } = await supabase.from('goals').update({ scorer_id: scorerId, assist_id: cleanAssistId }).eq('id', goalId);
      if (error) {
        console.error('Erro ao atualizar gol no Supabase:', error);
        throw new Error(`Erro ao atualizar gol: ${error.message}`);
      }
      return (await matchService.getById(matchId))!;
  },

  deleteGoal: async (matchId: string, gameId: string, goalId: string): Promise<Match> => {
    const { data: goal, error: getGoalError } = await supabase.from('goals').select('*').eq('id', goalId).single();
    if (getGoalError || !goal) {
      throw new Error('Gol não encontrado para exclusão.');
    }

    const { error: deleteError } = await supabase.from('goals').delete().eq('id', goalId);
    if (deleteError) {
      console.error('Erro ao deletar gol:', deleteError);
      throw new Error(`Erro ao deletar gol: ${deleteError.message}`);
    }

    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (game) {
      if (game.home_team_id === goal.team_id) {
        await supabase.from('games').update({ home_score: Math.max(0, game.home_score - 1) }).eq('id', gameId);
      } else if (game.away_team_id === goal.team_id) {
        await supabase.from('games').update({ away_score: Math.max(0, game.away_score - 1) }).eq('id', gameId);
      }
    }
    return (await matchService.getById(matchId))!;
  },

  reopenGame: async (matchId: string, gameId: string): Promise<Match> => {
    await supabase.from('games').update({ status: GameStatus.LIVE }).eq('id', gameId);
    await supabase.from('matches').update({ status: MatchStatus.IN_PROGRESS }).eq('id', matchId);
    return (await matchService.getById(matchId))!;
  },

  resetGame: async (matchId: string, gameId: string): Promise<Match> => {
    const { error: goalErr } = await supabase.from('goals').delete().eq('game_id', gameId);
    if (goalErr) console.error('Erro ao deletar gols no reset:', goalErr);

    const { error: gameErr } = await supabase.from('games').update({ 
      home_score: 0, 
      away_score: 0, 
      status: GameStatus.WAITING,
      penalty_shootout: null 
    }).eq('id', gameId);

    if (gameErr) {
      console.error('Erro ao resetar status do jogo:', gameErr);
      throw new Error(`Erro ao resetar partida: ${gameErr.message}`);
    }

    return (await matchService.getById(matchId))!;
  },

  reopenMatch: async (matchId: string): Promise<Match> => {
    await supabase.from('matches').update({ status: MatchStatus.IN_PROGRESS }).eq('id', matchId);
    return (await matchService.getById(matchId))!;
  },

  initializePenaltyShootout: async (matchId: string, gameId: string): Promise<Match> => {
      const initialShootout: PenaltyShootout = { homeScore: 0, awayScore: 0, history: [] };
      await supabase.from('games').update({ penalty_shootout: initialShootout }).eq('id', gameId);
      return (await matchService.getById(matchId))!;
  },

 registerPenalty: async (matchId: string, gameId: string, teamId: string, isGoal: boolean): Promise<Match> => {
      const { data: game } = await supabase.from('games').select('penalty_shootout, home_team_id').eq('id', gameId).single();
      
      if (game && game.penalty_shootout) {
          const shootout = game.penalty_shootout as PenaltyShootout;
          
          // --- CORREÇÃO: Calcular o Round ---
          // Se history tem 0 ou 1 item -> Round 1
          // Se history tem 2 ou 3 itens -> Round 2
          const currentRound = Math.floor(shootout.history.length / 2) + 1;

          shootout.history.push({ 
              teamId, 
              isGoal, 
              round: currentRound // <--- Propriedade que faltava!
          });

          if (isGoal) {
              if (teamId === game.home_team_id) shootout.homeScore += 1; 
              else shootout.awayScore += 1;
          }
          await supabase.from('games').update({ penalty_shootout: shootout }).eq('id', gameId);
      }
      return (await matchService.getById(matchId))!;
  },

  undoLastPenalty: async (matchId: string, gameId: string): Promise<Match> => {
      const { data: game } = await supabase.from('games').select('penalty_shootout, home_team_id').eq('id', gameId).single();
      if (game && game.penalty_shootout) {
          const shootout = game.penalty_shootout as PenaltyShootout;
          const lastKick = shootout.history.pop();
          if (lastKick && lastKick.isGoal) {
              if (lastKick.teamId === game.home_team_id) shootout.homeScore = Math.max(0, shootout.homeScore - 1);
              else shootout.awayScore = Math.max(0, shootout.awayScore - 1);
          }
          await supabase.from('games').update({ penalty_shootout: shootout }).eq('id', gameId);
      }
      return (await matchService.getById(matchId))!;
  },

  getFinalRankings: (match: Match): Standing[] => {
      const tableStandings = matchService.calculateStandings(match);
      if (match.type === 'Triangular') return tableStandings;

      if (match.type === 'Quadrangular') {
          const finalGame = match.games.find(g => g.phase === GamePhase.FINAL && g.status === GameStatus.FINISHED);
          const thirdPlaceGame = match.games.find(g => g.phase === GamePhase.THIRD_PLACE && g.status === GameStatus.FINISHED);

          let firstId = '', secondId = '', thirdId = '', fourthId = '';

          if (finalGame) {
              let homeWon = finalGame.homeScore > finalGame.awayScore;
              if (finalGame.homeScore === finalGame.awayScore && finalGame.penaltyShootout) {
                  homeWon = finalGame.penaltyShootout.homeScore > finalGame.penaltyShootout.awayScore;
              }
              if (homeWon) { firstId = finalGame.homeTeamId; secondId = finalGame.awayTeamId; }
              else { firstId = finalGame.awayTeamId; secondId = finalGame.homeTeamId; }
          } else {
              firstId = tableStandings[0]?.teamId;
              secondId = tableStandings[1]?.teamId;
          }

          if (thirdPlaceGame) {
              let homeWon = thirdPlaceGame.homeScore > thirdPlaceGame.awayScore;
              if (thirdPlaceGame.homeScore === thirdPlaceGame.awayScore && thirdPlaceGame.penaltyShootout) {
                  homeWon = thirdPlaceGame.penaltyShootout.homeScore > thirdPlaceGame.penaltyShootout.awayScore;
              }
              if (homeWon) { thirdId = thirdPlaceGame.homeTeamId; fourthId = thirdPlaceGame.awayTeamId; }
              else { thirdId = thirdPlaceGame.awayTeamId; fourthId = thirdPlaceGame.homeTeamId; }
          } else {
              thirdId = tableStandings[2]?.teamId;
              fourthId = tableStandings[3]?.teamId;
          }

          const ranked: Standing[] = [];
          const addIfExists = (id: string) => {
              const s = tableStandings.find(t => t.teamId === id);
              if (s) ranked.push(s);
          };
          addIfExists(firstId);
          addIfExists(secondId);
          addIfExists(thirdId);
          addIfExists(fourthId);
          
          return ranked;
      }
      return tableStandings;
  },

  finishMatch: async (matchId: string): Promise<Match> => {
    await supabase.from('matches').update({ status: MatchStatus.FINISHED }).eq('id', matchId);
    const match = await matchService.getById(matchId);
    if (!match) return match!; 

    const finalRankings = matchService.getFinalRankings(match);
    const championId = finalRankings[0]?.teamId;
    const lastPlaceId = finalRankings[finalRankings.length - 1]?.teamId;
    
    const allGoals = match.goals || [];
    
    const playerStats: Record<string, any> = {};
    match.teams.forEach(t => t.players.forEach(p => playerStats[p.id] = { matches: 0, wins: 0, losses: 0, goals: 0, assists: 0, cleanSheets: 0, goalsConceded: 0 }));

    match.teams.forEach(team => {
        const teamGames = match.games.filter(g => g.status === GameStatus.FINISHED && (g.homeTeamId === team.id || g.awayTeamId === team.id));
        teamGames.forEach(game => {
            const isHome = game.homeTeamId === team.id;
            const myScore = isHome ? game.homeScore : game.awayScore;
            const oppScore = isHome ? game.awayScore : game.homeScore;
            let isWin = myScore > oppScore;
            let isLoss = oppScore > myScore;
            if (myScore === oppScore && game.penaltyShootout) {
                 const p = game.penaltyShootout;
                 if ((isHome ? p.homeScore : p.awayScore) > (isHome ? p.awayScore : p.homeScore)) isWin = true; else isLoss = true;
            }
            team.players.forEach(p => {
                const s = playerStats[p.id];
                if(s) {
                    s.matches++;
                    if (isWin) s.wins++;
                    if (isLoss) s.losses++;
                    if (oppScore === 0) s.cleanSheets++;
                    s.goalsConceded += oppScore;
                }
            });
        });
    });
    allGoals.forEach(g => {
        if (g.scorerId && playerStats[g.scorerId]) playerStats[g.scorerId].goals++;
        if (g.assistId && playerStats[g.assistId]) playerStats[g.assistId].assists++;
    });

    const playerIds = match.teams.flatMap(t => t.players.map(p => p.id));
    const { data: playersCur, error: playersError } = await supabase
        .from('players')
        .select('id, monthly_delta')
        .in('id', playerIds);

    if (playersError) {
        console.error('Erro ao buscar dados atuais dos jogadores:', playersError);
        throw playersError;
    }

    const playersMap = new Map<string, any>();
    playersCur?.forEach(p => playersMap.set(p.id, p));

    const updatePromises: Promise<any>[] = [];

    for (const team of match.teams) {
        for (const player of team.players) {
            const s = playerStats[player.id];
            if (!s) continue;

            const cur = playersMap.get(player.id);
            if (!cur) continue;

            const dOvr = matchService.calculatePlayerMatchDelta(match, player, team.id, playerStats, championId, lastPlaceId);

            const updatePromise = supabase.from('players').update({
                monthly_delta: Number(cur.monthly_delta || 0) + dOvr,
                pace_acc: 0,
                shooting_acc: 0,
                passing_acc: 0,
                defending_acc: 0
            }).eq('id', player.id);

            updatePromises.push(updatePromise);
        }
    }

    if (updatePromises.length > 0) {
        const results = await Promise.all(updatePromises);
        const errorResult = results.find(r => r.error);
        if (errorResult) {
            console.error("Erro ao atualizar acumuladores de jogadores:", errorResult.error);
            throw errorResult.error;
        }
    }
    return match!;
  },

  calculatePlayerMatchDelta: (match: Match, player: Player, teamId: string, playerStats: any, championId?: string, lastPlaceId?: string): number => {
    let dOvr = 0;
    const s = playerStats[player.id];
    if (!s) return 0;

    // 1. Vitórias e Derrotas em partidas do evento
    if (player.position === PlayerPosition.GOLEIRO) {
        dOvr += (s.wins * 0.40);
    } else {
        dOvr += (s.wins * 0.30);
    }
    dOvr += (s.losses * -0.30);

    // 2. Colocação do Time no Evento
    if (teamId === championId) {
        dOvr += 0.50;
    }
    if (teamId === lastPlaceId) {
        dOvr -= 0.50;
    }

    // 3. Ataque
    dOvr += (s.goals * 0.20);
    dOvr += (s.assists * 0.10);

    // 4. Defesa e Posição
    if (player.position === PlayerPosition.GOLEIRO || player.position === PlayerPosition.DEFENSOR) {
        const teamGames = match.games.filter(g => g.status === GameStatus.FINISHED && (g.homeTeamId === teamId || g.awayTeamId === teamId));
        teamGames.forEach(game => {
            const isHome = game.homeTeamId === teamId;
            const oppScore = isHome ? game.awayScore : game.homeScore;
            
            // Banca de Solidez por partida: 0.25 menos 0.08 por gol sofrido (mínimo 0 por jogo)
            const gameBank = Math.max(0, 0.25 - (oppScore * 0.08));
            dOvr += gameBank;

            // Bônus de Clean Sheet
            if (oppScore === 0) {
                dOvr += (player.position === PlayerPosition.GOLEIRO ? 0.50 : 0.35);
            }
        });
    } else {
        // Meia / Atacante
        dOvr += (s.cleanSheets * 0.10);

        // Apagão Ofensivo
        if (s.goals === 0 && s.assists === 0 && s.matches > 0) {
            dOvr -= 0.25;
        }
    }

    return dOvr;
  },

  recalculateMonthlyDeltas: async (): Promise<void> => {
    const now = new Date();
    const isBeginningOfMonth = now.getDate() <= 10;
    const targetDate = isBeginningOfMonth 
        ? new Date(now.getFullYear(), now.getMonth() - 1, 15)
        : now;

    const monthKey = targetDate
      .toLocaleString("pt-BR", { month: "short" })
      .toUpperCase()
      .replace(".", "");

    // Trava de Segurança: Se os campeões deste mês já foram gravados no Hall da Fama, a virada do mês já foi encerrada!
    const { data: existingChampions } = await supabase.from('monthly_champions').select('id').eq('month_key', monthKey);
    if (existingChampions && existingChampions.length > 0) {
        console.log(`Virada do mês ${monthKey} já foi realizada. Recálculo ignorado.`);
        return;
    }

    const allMatches = await matchService.getAll();

    const currentMonthMatches = allMatches.filter(m => {
        if (m.status !== MatchStatus.FINISHED) return false;
        const mDate = new Date(m.date);
        return mDate.getMonth() === targetDate.getMonth() && mDate.getFullYear() === targetDate.getFullYear();
    });

    const { data: allPlayers } = await supabase.from('players').select('id');
    if (!allPlayers) return;

    const newDeltas: Record<string, number> = {};
    allPlayers.forEach(p => newDeltas[p.id] = 0);

    for (const match of currentMonthMatches) {
        const finalRankings = matchService.getFinalRankings(match);
        const championId = finalRankings[0]?.teamId;
        const lastPlaceId = finalRankings[finalRankings.length - 1]?.teamId;
        
        const allGoals = match.goals || [];
        const playerStats: Record<string, any> = {};
        match.teams.forEach(t => t.players.forEach(p => playerStats[p.id] = { matches: 0, wins: 0, losses: 0, goals: 0, assists: 0, cleanSheets: 0, goalsConceded: 0 }));

        match.teams.forEach(team => {
            const teamGames = match.games.filter(g => g.status === GameStatus.FINISHED && (g.homeTeamId === team.id || g.awayTeamId === team.id));
            teamGames.forEach(game => {
                const isHome = game.homeTeamId === team.id;
                const myScore = isHome ? game.homeScore : game.awayScore;
                const oppScore = isHome ? game.awayScore : game.homeScore;
                let isWin = myScore > oppScore;
                let isLoss = oppScore > myScore;
                if (myScore === oppScore && game.penaltyShootout) {
                     const p = game.penaltyShootout;
                     if ((isHome ? p.homeScore : p.awayScore) > (isHome ? p.awayScore : p.homeScore)) isWin = true; else isLoss = true;
                }
                team.players.forEach(p => {
                    const s = playerStats[p.id];
                    if(s) {
                        s.matches++;
                        if (isWin) s.wins++;
                        if (isLoss) s.losses++;
                        if (oppScore === 0) s.cleanSheets++;
                        s.goalsConceded += oppScore;
                    }
                });
            });
        });
        allGoals.forEach(g => {
            if (g.scorerId && playerStats[g.scorerId]) playerStats[g.scorerId].goals++;
            if (g.assistId && playerStats[g.assistId]) playerStats[g.assistId].assists++;
        });

        for (const team of match.teams) {
            for (const player of team.players) {
                const delta = matchService.calculatePlayerMatchDelta(match, player, team.id, playerStats, championId, lastPlaceId);
                newDeltas[player.id] = (newDeltas[player.id] || 0) + delta;
            }
        }
    }

    const updatePromises = Object.entries(newDeltas).map(([playerId, delta]) => 
        supabase.from('players').update({ monthly_delta: delta }).eq('id', playerId)
    );

    if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
    }
  },

  calculateStandings: (match: Match): Standing[] => {
    const standings: Record<string, Standing> = {};
    match.teams.forEach(t => {
        standings[t.id] = { teamId: t.id, teamName: t.name, played: 0, points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
    });
    match.games.forEach(game => {
        if (game.status === GameStatus.FINISHED && (game.phase === GamePhase.PHASE_1 || game.phase === GamePhase.PHASE_2)) {
             const home = standings[game.homeTeamId];
             const away = standings[game.awayTeamId];
             if (!home || !away) return; 
             home.played++; away.played++;
             home.goalsFor += game.homeScore; home.goalsAgainst += game.awayScore;
             away.goalsFor += game.awayScore; away.goalsAgainst += game.homeScore;
             if (game.homeScore > game.awayScore) { home.points += 3; home.wins++; away.losses++; }
             else if (game.awayScore > game.homeScore) { away.points += 3; away.wins++; home.losses++; }
             else { home.points += 1; home.draws++; away.points += 1; away.draws++; }
        }
    });
    
    const sortedStandings = Object.values(standings).map(s => ({ ...s, goalDiff: s.goalsFor - s.goalsAgainst })).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
    });

    const tieBreakerGame = match.games.find(g => g.phase === GamePhase.TIE_BREAKER && g.status === GameStatus.FINISHED);
    
    if (tieBreakerGame && tieBreakerGame.penaltyShootout) {
        const homeWon = tieBreakerGame.penaltyShootout.homeScore > tieBreakerGame.penaltyShootout.awayScore;
        const winnerId = homeWon ? tieBreakerGame.homeTeamId : tieBreakerGame.awayTeamId;
        const loserId = homeWon ? tieBreakerGame.awayTeamId : tieBreakerGame.homeTeamId;

        const winnerIndex = sortedStandings.findIndex(s => s.teamId === winnerId);
        const loserIndex = sortedStandings.findIndex(s => s.teamId === loserId);

        if (winnerIndex !== -1 && loserIndex !== -1 && loserIndex < winnerIndex) {
            const [winner] = sortedStandings.splice(winnerIndex, 1);
            sortedStandings.splice(loserIndex, 0, winner);
        }
    }

    return sortedStandings;
  },

  updateChampionPhoto: async (matchId: string, url: string): Promise<void> => {
    const { error } = await supabase.from('matches').update({ champion_photo_url: url }).eq('id', matchId);
    if (error) throw error;
  },
};