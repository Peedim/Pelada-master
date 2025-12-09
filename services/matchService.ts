import { supabase } from './supabaseClient';
import { Match, MatchStatus, Team, Player, Game, Goal, GameStatus, GamePhase, Standing, PenaltyKick, PlayerPosition, PenaltyShootout } from '../types';
import { generateFixtures } from '../utils/fixtureGenerator';
import { playerService } from './playerService';

// --- HELPER: Transforma os dados do Banco (Relacional) para o objeto do Frontend (Aninhado) ---
const mapDatabaseToMatch = (dbMatch: any): Match => {
  const teams: Team[] = dbMatch.match_teams.map((t: any) => {
    // Mapeia jogadores do time
    const players: Player[] = t.team_players.map((tp: any) => ({
      ...tp.player,
      attributes: { // Garante que atributos existam
        pace: tp.player.pace, shooting: tp.player.shooting, passing: tp.player.passing,
        dribbling: tp.player.dribbling, defending: tp.player.defending, physical: tp.player.physical
      }
    }));

    // Recalcula totais derivados (não salvos no banco)
    const totalOvr = players.reduce((acc, p) => acc + (p.initial_ovr || 0), 0);
    const avgOvr = players.length > 0 ? Math.round(totalOvr / players.length) : 0;
    const styleCounts: Record<string, number> = {};
    players.forEach(p => {
      const style = p.playStyle || 'Unknown';
      styleCounts[style] = (styleCounts[style] || 0) + 1;
    });

    return {
      id: t.id,
      name: t.name,
      players,
      totalOvr,
      avgOvr,
      styleCounts
    };
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
      penaltyShootout: g.penalty_shootout // JSONB mapeia direto
    })),
    goals: dbMatch.goals.map((gl: any) => ({
      id: gl.id,
      gameId: gl.game_id,
      teamId: gl.team_id,
      scorerId: gl.scorer_id,
      assistId: gl.assist_id,
      minute: gl.minute
    }))
  };
};

export const matchService = {
  // --- LEITURA ---
  getAll: async (): Promise<Match[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        match_teams (
          *,
          team_players (
            player:players (*)
          )
        ),
        games (*),
        goals (*)
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar matches:', error);
      return [];
    }
    
    // Mapeia e ordena games/goals localmente por segurança
    return data.map(mapDatabaseToMatch);
  },

  getById: async (id: string): Promise<Match | undefined> => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        match_teams (
          *,
          team_players (
            player:players (*)
          )
        ),
        games (*),
        goals (*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return undefined;
    return mapDatabaseToMatch(data);
  },

  // --- CRIAÇÃO (DRAFT) ---
  createDraft: async (teams: Team[], config: { type: 'Quadrangular' | 'Triangular', date: string, location: string }): Promise<Match> => {
    // 1. Cria o Match
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .insert([{
        date: config.date,
        location: config.location,
        type: config.type,
        status: MatchStatus.DRAFT
      }])
      .select()
      .single();

    if (matchError) throw matchError;

    // 2. Cria os Times (match_teams)
    for (const team of teams) {
      const { data: teamData, error: teamError } = await supabase
        .from('match_teams')
        .insert([{
          match_id: matchData.id,
          name: team.name,
          avg_ovr: team.avgOvr
        }])
        .select()
        .single();
      
      if (teamError) throw teamError;

      // 3. Vincula Jogadores aos Times (team_players)
      if (team.players.length > 0) {
        const teamPlayersInsert = team.players.map(p => ({
          team_id: teamData.id,
          player_id: p.id
        }));
        
        const { error: tpError } = await supabase.from('team_players').insert(teamPlayersInsert);
        if (tpError) throw tpError;
      }
    }

    // Retorna o match completo atualizado
    const createdMatch = await matchService.getById(matchData.id);
    if (!createdMatch) throw new Error("Erro ao recarregar match criado");
    return createdMatch;
  },

  updateMatch: async (updatedMatch: Match): Promise<void> => {
     // OBS: Com Supabase, atualizamos peças individuais. 
     // Essa função fica legada para atualizações genéricas de campos raiz (ex: local/data)
     await supabase
       .from('matches')
       .update({ 
         location: updatedMatch.location,
         date: updatedMatch.date,
         status: updatedMatch.status
       })
       .eq('id', updatedMatch.id);
  },

  deleteMatch: async (id: string): Promise<void> => {
    await supabase.from('matches').delete().eq('id', id);
  },

  // --- GERENCIAMENTO DE ELENCO ---
  removePlayerFromTeam: async (matchId: string, teamId: string, playerId: string): Promise<Match> => {
    // Precisamos achar o registro na tabela de ligação team_players
    // Como team_id é único por time no evento, basta deletar onde team_id e player_id batem
    await supabase
      .from('team_players')
      .delete()
      .match({ team_id: teamId, player_id: playerId });

    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');
    return match;
  },

  addPlayerToTeam: async (matchId: string, teamId: string, player: Player): Promise<Match> => {
    await supabase
      .from('team_players')
      .insert([{ team_id: teamId, player_id: player.id }]);

    const match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');
    return match;
  },

  // --- EVENTO: PUBLICAR / CANCELAR ---
  publishMatch: async (matchId: string): Promise<void> => {
    const match = await matchService.getById(matchId);
    if (!match) return;

    // Gera os jogos em memória
    const generatedGames = generateFixtures(match.id, match.teams, match.type as any);

    // Prepara para inserir no banco
    const gamesInsert = generatedGames.map(g => ({
      match_id: match.id,
      phase: g.phase,
      sequence: g.sequence,
      home_team_id: match.teams.find(t => t.id === g.homeTeamId)?.id, // Mapeia IDs frontend -> IDs backend se necessário (mas aqui devem ser iguais se getById vier do banco)
      away_team_id: match.teams.find(t => t.id === g.awayTeamId)?.id,
      status: GameStatus.WAITING,
      home_score: 0,
      away_score: 0
    }));

    // Atualiza Status e Insere Jogos
    await supabase.from('matches').update({ status: MatchStatus.OPEN }).eq('id', matchId);
    await supabase.from('games').insert(gamesInsert);
  },

  revertToDraft: async (matchId: string): Promise<void> => {
    // Status -> Draft. O Cascade no banco já limparia games/goals se deletassemos o match,
    // mas aqui queremos manter times e deletar jogos.
    await supabase.from('matches').update({ status: MatchStatus.DRAFT }).eq('id', matchId);
    
    // Limpar jogos e gols associados (gols tem cascade de game_id geralmente, mas por segurança limpamos)
    await supabase.from('games').delete().eq('match_id', matchId);
    await supabase.from('goals').delete().eq('match_id', matchId);
  },

  ensureFixtures: async (matchId: string): Promise<Match> => {
    // Verifica se já tem jogos
    const match = await matchService.getById(matchId);
    if (match && match.status === MatchStatus.OPEN && match.games.length === 0) {
        await matchService.publishMatch(matchId);
        const updated = await matchService.getById(matchId);
        return updated!;
    }
    return match!;
  },

  // --- JOGOS E PLACARES ---
  startGame: async (matchId: string, gameId: string): Promise<Match> => {
    await supabase.from('games').update({ status: GameStatus.LIVE }).eq('id', gameId);
    const match = await matchService.getById(matchId);
    return match!;
  },

  endMatch: async (matchId: string, gameId: string): Promise<Match> => {
    // 1. Finaliza o jogo atual
    await supabase.from('games').update({ status: GameStatus.FINISHED }).eq('id', gameId);

    // 2. Lógica de Torneio (Finais) - Recarrega para ter estado atual
    let match = await matchService.getById(matchId);
    if (!match) throw new Error('Match not found');

    const game = match.games.find(g => g.id === gameId);
    
    // Se for Quadrangular, verifica se precisa popular finais
    if (match.type === 'Quadrangular' && game) {
        // ... (Mesma lógica de seeding do seu código original)
        // A diferença é que ao decidir os times da final, fazemos UPDATE na tabela games
        
        const phase1Games = match.games.filter(g => g.phase === GamePhase.PHASE_1);
        const isPhase1Done = phase1Games.every(g => g.status === GameStatus.FINISHED);

        if (isPhase1Done) {
            const phase2Games = match.games.filter(g => g.phase === GamePhase.PHASE_2);
            // Verifica se Phase 2 precisa de seed (está TBD)
            const needsSeeding = phase2Games.some(g => g.homeTeamId === 'TBD');

            if (needsSeeding) {
                const standings = matchService.calculateStandings(match);
                // Atualiza Phase 2 (Semi/Intermediária) no banco
                if (phase2Games[0]) {
                     await supabase.from('games').update({ 
                         home_team_id: standings[0].teamId, away_team_id: standings[3].teamId 
                     }).eq('id', phase2Games[0].id);
                }
                if (phase2Games[1]) {
                     await supabase.from('games').update({ 
                         home_team_id: standings[1].teamId, away_team_id: standings[2].teamId 
                     }).eq('id', phase2Games[1].id);
                }
            }
        }
        
        // Verifica Final
        const phase2Games = match.games.filter(g => g.phase === GamePhase.PHASE_2);
        const isPhase2Done = phase2Games.length > 0 && phase2Games.every(g => g.status === GameStatus.FINISHED);
        
        if (isPhase2Done) {
             const finalGame = match.games.find(g => g.phase === GamePhase.FINAL);
             const thirdGame = match.games.find(g => g.phase === GamePhase.THIRD_PLACE);
             
             if (finalGame && finalGame.homeTeamId === 'TBD') {
                 // Recalcula standings considerando fase 2 se necessário, ou lógica de vencedores
                 // Simplificação: Assumindo vencedores da fase 2 vão pra final
                 // Precisaria saber quem ganhou os jogos da fase 2. 
                 // Como calculateStandings é genérico, vamos usar a lógica de "quem passou" manual aqui ou adaptar standings
                 
                 // Para simplificar a migração, vamos recarregar o match e deixar a UI ou próxima ação lidar, 
                 // OU implementar seeding básico aqui se a lógica for crítica.
                 // SEGUINDO SEU CÓDIGO ORIGINAL (Standings baseados em pontos gerais):
                 const standings = matchService.calculateStandings(match);
                 
                 await supabase.from('games').update({
                     home_team_id: standings[0].teamId, away_team_id: standings[1].teamId
                 }).eq('id', finalGame.id);

                 if (thirdGame) {
                     await supabase.from('games').update({
                         home_team_id: standings[2].teamId, away_team_id: standings[3].teamId
                     }).eq('id', thirdGame.id);
                 }
             }
        }
    }

    // Retorna estado final atualizado
    match = await matchService.getById(matchId);
    return match!;
  },

  scoreGoal: async (matchId: string, gameId: string, teamId: string, scorerId: string, assistId?: string): Promise<Match> => {
    // 1. Insere o Gol
    await supabase.from('goals').insert([{
        match_id: matchId,
        game_id: gameId,
        team_id: teamId,
        scorer_id: scorerId,
        assist_id: assistId,
        minute: new Date().getMinutes()
    }]);

    // 2. Atualiza Placar no Jogo
    // Primeiro descobrimos se o time é home ou away
    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (game) {
        if (game.home_team_id === teamId) {
            await supabase.from('games').update({ home_score: game.home_score + 1 }).eq('id', gameId);
        } else {
            await supabase.from('games').update({ away_score: game.away_score + 1 }).eq('id', gameId);
        }
    }

    const match = await matchService.getById(matchId);
    return match!;
  },

  updateGoal: async (matchId: string, goalId: string, scorerId: string, assistId?: string): Promise<Match> => {
      await supabase.from('goals').update({
          scorer_id: scorerId,
          assist_id: assistId
      }).eq('id', goalId);
      
      const match = await matchService.getById(matchId);
      return match!;
  },

  // --- PÊNALTIS ---
  initializePenaltyShootout: async (matchId: string, gameId: string): Promise<Match> => {
      const initialShootout: PenaltyShootout = { homeScore: 0, awayScore: 0, history: [] };
      await supabase.from('games').update({ penalty_shootout: initialShootout }).eq('id', gameId);
      
      const match = await matchService.getById(matchId);
      return match!;
  },

  registerPenalty: async (matchId: string, gameId: string, teamId: string, isGoal: boolean): Promise<Match> => {
      // 1. Busca estado atual
      const { data: game } = await supabase.from('games').select('penalty_shootout, home_team_id').eq('id', gameId).single();
      
      if (game && game.penalty_shootout) {
          const shootout = game.penalty_shootout as PenaltyShootout;
          
          // Atualiza histórico
          shootout.history.push({
              teamId,
              isGoal,
              round: shootout.history.length + 1
          });

          // Atualiza placar
          if (isGoal) {
              if (teamId === game.home_team_id) shootout.homeScore += 1;
              else shootout.awayScore += 1;
          }

          // Salva no banco
          await supabase.from('games').update({ penalty_shootout: shootout }).eq('id', gameId);
      }
      
      const match = await matchService.getById(matchId);
      return match!;
  },

  undoLastPenalty: async (matchId: string, gameId: string): Promise<Match> => {
      const { data: game } = await supabase.from('games').select('penalty_shootout, home_team_id').eq('id', gameId).single();
      
      if (game && game.penalty_shootout) {
          const shootout = game.penalty_shootout as PenaltyShootout;
          const lastKick = shootout.history.pop();
          
          if (lastKick && lastKick.isGoal) {
              if (lastKick.teamId === game.home_team_id) {
                  shootout.homeScore = Math.max(0, shootout.homeScore - 1);
              } else {
                  shootout.awayScore = Math.max(0, shootout.awayScore - 1);
              }
          }
          await supabase.from('games').update({ penalty_shootout: shootout }).eq('id', gameId);
      }
      
      const match = await matchService.getById(matchId);
      return match!;
  },

  finishMatch: async (matchId: string): Promise<void> => {
    // 1. Marca como finalizado
    await supabase.from('matches').update({ status: MatchStatus.FINISHED }).eq('id', matchId);

    // 2. Calcula Performance (Lógica original mantida, agora usando dados frescos)
    const match = await matchService.getById(matchId);
    if (!match) return;

    const standings = matchService.calculateStandings(match);
    const deltaUpdates: Record<string, number> = {};
    const rankBonuses = [1.0, 0.5, 0.0, -0.5];

    // Bônus de Posição
    standings.forEach((standing, index) => {
      const bonus = rankBonuses[index] !== undefined ? rankBonuses[index] : -0.5;
      const team = match.teams.find(t => t.id === standing.teamId);
      if (team) {
        team.players.forEach(p => {
          deltaUpdates[p.id] = (deltaUpdates[p.id] || 0) + bonus;
        });
      }
    });

    // Bônus Individuais (Gols, Clean Sheets)
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

  // Mantém a lógica de cálculo em memória (não precisa de DB para isso)
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