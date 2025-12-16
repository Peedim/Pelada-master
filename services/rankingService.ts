import { supabase } from './supabaseClient';
import { Player, RankingsData, PlayerRankingStats, MatchStatus, GameStatus, PlayerPosition } from '../types';
import { matchService } from './matchService'; 

// Função auxiliar (Privada ao módulo) para calcular stats de uma lista de partidas
const calculateStatsFromMatches = (matches: any[], players: Player[]): RankingsData => {
    // Inicializa acumuladores
    const stats: Record<string, { wins: number, goals: number, assists: number, cleanSheets: number, playerId: string }> = {};
    
    players.forEach(p => {
        stats[p.id] = { wins: 0, goals: 0, assists: 0, cleanSheets: 0, playerId: p.id };
    });

    matches.forEach(match => {
        // A. Processar Jogos (Vitórias e Clean Sheets)
        const validGames = match.games.filter((g: any) => g.status === GameStatus.FINISHED);
        
        validGames.forEach((game: any) => {
            [game.homeTeamId, game.awayTeamId].forEach((teamId: string) => {
                if (teamId === 'TBD') return;

                const isHome = teamId === game.homeTeamId;
                const myScore = isHome ? game.homeScore : game.awayScore;
                const oppScore = isHome ? game.awayScore : game.homeScore;
                
                // Lógica de Vitória
                let isWin = myScore > oppScore;
                if (myScore === oppScore && game.penaltyShootout) {
                    const p = game.penaltyShootout;
                    const myPenScore = isHome ? p.homeScore : p.awayScore;
                    const oppPenScore = isHome ? p.awayScore : p.homeScore;
                    if (myPenScore > oppPenScore) isWin = true;
                }

                // Clean Sheet
                const isCleanSheet = oppScore === 0;

                const team = match.teams.find((t: any) => t.id === teamId);
                if (team) {
                    team.players.forEach((p: any) => {
                        if (stats[p.id]) {
                            if (isWin) stats[p.id].wins++;
                            if (isCleanSheet) stats[p.id].cleanSheets++;
                        }
                    });
                }
            });
        });

        // B. Processar Gols e Assistências
        match.goals.forEach((goal: any) => {
            if (goal.scorerId && stats[goal.scorerId]) stats[goal.scorerId].goals++;
            if (goal.assistId && stats[goal.assistId]) stats[goal.assistId].assists++;
        });
    });

    // Função de ordenação e FILTRAGEM
    const createSortedList = (statKey: 'wins' | 'goals' | 'assists' | 'cleanSheets'): PlayerRankingStats[] => {
        return Object.values(stats)
            .filter(s => {
                // 1. Remove quem tem zero
                if (s[statKey] <= 0) return false;

                // 2. [NOVO] Filtro Específico para Clean Sheets
                // Apenas Goleiros e Defensores entram no ranking de Muralha
                if (statKey === 'cleanSheets') {
                    const player = players.find(p => p.id === s.playerId);
                    return player?.position === PlayerPosition.GOLEIRO || player?.position === PlayerPosition.DEFENSOR;
                }

                return true;
            })
            .sort((a, b) => {
                if (b[statKey] !== a[statKey]) return b[statKey] - a[statKey];
                const pA = players.find(p => p.id === a.playerId)?.name || '';
                const pB = players.find(p => p.id === b.playerId)?.name || '';
                return pA.localeCompare(pB);
            })
            .map(s => {
                const player = players.find(p => p.id === s.playerId);
                return {
                    playerId: s.playerId,
                    playerName: player?.name || 'Desconhecido',
                    playerPhoto: player?.photo_url,
                    position: player?.position || '',
                    value: s[statKey]
                };
            });
    };

    return {
        wins: createSortedList('wins'),
        goals: createSortedList('goals'),
        assists: createSortedList('assists'),
        cleanSheets: createSortedList('cleanSheets')
    };
};

export const rankingService = {
  
  // 1. Ranking MENSAL (Zera a cada virada de mês automaticamente pela data)
  getCurrentMonthRankings: async (players: Player[]): Promise<RankingsData> => {
    const allMatches = await matchService.getAll();
    const now = new Date();
    
    // Filtra apenas partidas DESTE mês e ano
    const currentMonthMatches = allMatches.filter(m => {
      if (m.status !== MatchStatus.FINISHED) return false;
      const mDate = new Date(m.date);
      return mDate.getMonth() === now.getMonth() && 
             mDate.getFullYear() === now.getFullYear();
    });

    return calculateStatsFromMatches(currentMonthMatches, players);
  },

  // 2. Ranking GERAL (Todos os tempos)
  getAllTimeRankings: async (players: Player[]): Promise<RankingsData> => {
    const allMatches = await matchService.getAll();
    
    // Filtra apenas partidas FINALIZADAS (sem restrição de data)
    const finishedMatches = allMatches.filter(m => m.status === MatchStatus.FINISHED);

    return calculateStatsFromMatches(finishedMatches, players);
  },

  // 3. Hall da Fama (Histórico salvo no banco)
  getHallOfFame: async (monthKey?: string) => {
    let query = supabase.from('monthly_champions').select('*, player:players(name, photo_url, position)');
    
    if (monthKey) {
        query = query.eq('month_key', monthKey);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }); // Mês mais recente primeiro
    if (error) { console.error('Erro Hall da Fama:', error); return []; }
    return data;
  },

  saveChampions: async (monthKey: string, champions: { category: string, playerId: string, value: number }[]) => {
      await supabase.from('monthly_champions').delete().eq('month_key', monthKey);
      const records = champions.map(c => ({
          month_key: monthKey,
          category: c.category,
          player_id: c.playerId,
          stat_value: c.value
      }));
      const { error } = await supabase.from('monthly_champions').insert(records);
      if (error) throw error;
  }
};