import { supabase } from './supabaseClient';
import { Match, MatchStatus, Team, Player, Game, Goal, GameStatus, GamePhase, Standing, PenaltyKick, PlayerPosition, PenaltyShootout } from '../types';
import { generateFixtures } from '../utils/fixtureGenerator';
import { playerService, OVR_WEIGHTS } from './playerService'; // <--- Importando PESOS

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

const mapDatabaseToMatch = (dbMatch: any): Match => {
  const teams: Team[] = dbMatch.match_teams.map((t: any) => {
    const players: Player[] = t.team_players.map((tp: any) => ({
      ...tp.player,
      playStyle: tp.player.play_style,
      attributes: {
        pace: tp.player.pace, shooting: tp.player.shooting, passing: tp.player.passing, defending: tp.player.defending
      },
      accumulators: {
        pace: Number(tp.player.pace_acc || 0), shooting: Number(tp.player.shooting_acc || 0),
        passing: Number(tp.player.passing_acc || 0), defending: Number(tp.player.defending_acc || 0)
      }
    }));
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
  getAll: async (): Promise<Match[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`*, match_teams (*, team_players (player:players (*))), games (*), goals (*)`)
      .order('date', { ascending: false });
    if (error) { console.error('Erro:', error); return []; }
    // @ts-ignore
    return data.map(mapDatabaseToMatch);
  },
  
  getById: async (id: string): Promise<Match | undefined> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`*, match_teams (*, team_players (player:players (*))), games (*), goals (*)`)
      .eq('id', id).single();
    if (error || !data) return undefined;
    // @ts-ignore
    return mapDatabaseToMatch(data);
  },

  createDraft: async (teams: Team[], config: { type: 'Quadrangular' | 'Triangular', date: string, location: string }): Promise<Match> => {
      const { data: matchData, error: matchError } = await supabase.from('matches').insert([{ date: config.date, location: config.location, type: config.type, status: MatchStatus.DRAFT }]).select().single();
      if (matchError) throw matchError;
      for (const team of teams) {
        const { data: teamData, error: teamError } = await supabase.from('match_teams').insert([{ match_id: matchData.id, name: team.name, avg_ovr: team.avgOvr }]).select().single();
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
      await supabase.from('team_players').delete().match({ team_id: teamId, player_id: playerId });
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
        home_team_id: match.teams.find(t => t.id === g.homeTeamId)?.id,
        away_team_id: match.teams.find(t => t.id === g.awayTeamId)?.id,
        status: GameStatus.WAITING,
        home_score: 0,
        away_score: 0
      }));
      await supabase.from('matches').update({ status: MatchStatus.OPEN }).eq('id', matchId);
      await supabase.from('games').insert(gamesInsert);
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
                 const finalGame = match.games.find(g => g.phase === GamePhase.FINAL);
                 const thirdGame = match.games.find(g => g.phase === GamePhase.THIRD_PLACE);
                 if (finalGame && finalGame.homeTeamId === 'TBD') {
                     const standings = matchService.calculateStandings(match);
                     await supabase.from('games').update({ home_team_id: standings[0].teamId, away_team_id: standings[1].teamId }).eq('id', finalGame.id);
                     if (thirdGame) await supabase.from('games').update({ home_team_id: standings[2].teamId, away_team_id: standings[3].teamId }).eq('id', thirdGame.id);
                 }
            }
        }
        return (await matchService.getById(matchId))!;
      },
      scoreGoal: async (matchId: string, gameId: string, teamId: string, scorerId: string, assistId?: string): Promise<Match> => {
        await supabase.from('goals').insert([{ match_id: matchId, game_id: gameId, team_id: teamId, scorer_id: scorerId, assist_id: assistId, minute: new Date().getMinutes() }]);
        const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
        if (game) {
            if (game.home_team_id === teamId) await supabase.from('games').update({ home_score: game.home_score + 1 }).eq('id', gameId);
            else await supabase.from('games').update({ away_score: game.away_score + 1 }).eq('id', gameId);
        }
        return (await matchService.getById(matchId))!;
      },
      updateGoal: async (matchId: string, goalId: string, scorerId: string, assistId?: string): Promise<Match> => {
          await supabase.from('goals').update({ scorer_id: scorerId, assist_id: assistId }).eq('id', goalId);
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
              shootout.history.push({ teamId, isGoal, round: shootout.history.length + 1 });
              if (isGoal) {
                  if (teamId === game.home_team_id) shootout.homeScore += 1; else shootout.awayScore += 1;
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

  finishMatch: async (matchId: string): Promise<void> => {
    await supabase.from('matches').update({ status: MatchStatus.FINISHED }).eq('id', matchId);
    const match = await matchService.getById(matchId);
    if (!match) return;

    const standings = matchService.calculateStandings(match);
    const championId = standings[0]?.teamId;
    const lastPlaceId = standings[standings.length - 1]?.teamId;
    const allGoals = match.goals || [];
    
    // Preparar stats
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
                s.matches++;
                if (isWin) s.wins++;
                if (isLoss) s.losses++;
                if (oppScore === 0) s.cleanSheets++;
                s.goalsConceded += oppScore;
            });
        });
    });
    allGoals.forEach(g => {
        if (g.scorerId && playerStats[g.scorerId]) playerStats[g.scorerId].goals++;
        if (g.assistId && playerStats[g.assistId]) playerStats[g.assistId].assists++;
    });

    // APLICAÇÃO DOS MODIFICADORES
    for (const team of match.teams) {
        for (const player of team.players) {
            const s = playerStats[player.id];
            if (!s) continue;

            const { data: cur } = await supabase.from('players').select('pace_acc, shooting_acc, passing_acc, defending_acc').eq('id', player.id).single();
            if (!cur) continue;

            // Busca os pesos da posição deste jogador
            const posKey = Object.values(PlayerPosition).includes(player.position as PlayerPosition) ? player.position as PlayerPosition : 'default';
            const w = OVR_WEIGHTS[posKey] || OVR_WEIGHTS['default'];

            let dPace = 0, dShoot = 0, dPass = 0, dDef = 0;

            // 1. RITMO E BÔNUS GERAIS
            dPace += (s.wins * 0.3);
            dPace += (s.losses * -0.2);

            // Campeão do Dia: +1.0 distribuído
            if (team.id === championId) {
                dPace += (1.0 * w.pace);
                dShoot += (1.0 * w.shooting);
                dPass += (1.0 * w.passing);
                dDef += (1.0 * w.defending);
            }
            // Último Lugar: -1.0 distribuído (PUNIÇÃO CORRIGIDA)
            if (team.id === lastPlaceId) {
                dPace -= (1.0 * w.pace);
                dShoot -= (1.0 * w.shooting);
                dPass -= (1.0 * w.passing);
                dDef -= (1.0 * w.defending);
            }

            // 2. DEFESA
            if (player.position === PlayerPosition.GOLEIRO) dDef += (s.cleanSheets * 0.5);
            else if (player.position === PlayerPosition.DEFENSOR) dDef += (s.cleanSheets * 0.3);
            else if (player.position === PlayerPosition.MEIO_CAMPO) dDef += (s.cleanSheets * 0.2);
            else if (player.position === PlayerPosition.ATACANTE) dDef += (s.cleanSheets * 0.1);

            dDef += (s.goalsConceded * -0.2);

            // 3. FINALIZAÇÃO & PASSE
            let golBonus = 0;
            if (player.position === PlayerPosition.GOLEIRO) golBonus = 0.1;
            else if (player.position === PlayerPosition.DEFENSOR) golBonus = 0.2;
            else if (player.position === PlayerPosition.MEIO_CAMPO) golBonus = 0.3;
            else if (player.position === PlayerPosition.ATACANTE) golBonus = 0.5;
            dShoot += (s.goals * golBonus);

            let astBonus = 0;
            if (player.position === PlayerPosition.GOLEIRO) astBonus = 0.1;
            else if (player.position === PlayerPosition.DEFENSOR) astBonus = 0.2;
            else if (player.position === PlayerPosition.MEIO_CAMPO) astBonus = 0.5;
            else if (player.position === PlayerPosition.ATACANTE) astBonus = 0.3;
            dPass += (s.assists * astBonus);

            // 4. PUNIÇÃO: ATAQUE EM BRANCO
            if (s.goals === 0 && s.assists === 0 && s.matches > 0) {
                if (player.position === PlayerPosition.GOLEIRO || player.position === PlayerPosition.DEFENSOR) {
                    dPass -= 0.1; dShoot -= 0.1;
                } else if (player.position === PlayerPosition.MEIO_CAMPO) {
                    dPass -= 0.2; dShoot -= 0.1;
                } else if (player.position === PlayerPosition.ATACANTE) {
                    dShoot -= 0.2; dPass -= 0.1;
                }
            }

            await supabase.from('players').update({
                pace_acc: Number(cur.pace_acc) + dPace,
                shooting_acc: Number(cur.shooting_acc) + dShoot,
                passing_acc: Number(cur.passing_acc) + dPass,
                defending_acc: Number(cur.defending_acc) + dDef,
            }).eq('id', player.id);
        }
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
    return Object.values(standings).map(s => ({ ...s, goalDiff: s.goalsFor - s.goalsAgainst })).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
    });
  },

  updateChampionPhoto: async (matchId: string, url: string): Promise<void> => {
    const { error } = await supabase.from('matches').update({ champion_photo_url: url }).eq('id', matchId);
    if (error) throw error;
  },
};