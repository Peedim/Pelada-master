import { supabase } from './supabaseClient';
import { Player, RankingsData, MatchStatus, GameStatus } from '../types';

// Função auxiliar (Privada) que faz o cálculo pesado na memória
const calculateStatsFromMatches = (matches: any[], players: Player[]): RankingsData => {
    const stats: RankingsData = {};
    
    players.forEach(p => {
        stats[p.id] = { 
            wins: 0, 
            goals: 0, 
            assists: 0, 
            cleanSheets: 0, 
            playerId: p.id 
        };
    });

    matches.forEach(match => {
        const validGames = match.games.filter((g: any) => g.status === GameStatus.FINISHED);
        
        validGames.forEach((game: any) => {
            [game.homeTeamId, game.awayTeamId].forEach((teamId: string) => {
                if (teamId === 'TBD') return;

                const isHome = teamId === game.homeTeamId;
                const myScore = isHome ? game.homeScore : game.awayScore;
                const oppScore = isHome ? game.awayScore : game.homeScore;
                
                let isWin = myScore > oppScore;
                if (myScore === oppScore && game.penaltyShootout) {
                    const p = game.penaltyShootout;
                    if ((isHome ? p.homeScore : p.awayScore) > (isHome ? p.awayScore : p.homeScore)) isWin = true; 
                }

                const team = match.teams.find((t: any) => t.id === teamId);
                team?.players.forEach((player: any) => {
                    if (stats[player.id]) {
                        if (isWin) stats[player.id].wins++;
                        if (oppScore === 0) stats[player.id].cleanSheets++;
                    }
                });
            });
        });

        match.goals.forEach((g: any) => {
            if (g.scorerId && stats[g.scorerId]) stats[g.scorerId].goals++;
            if (g.assistId && stats[g.assistId]) stats[g.assistId].assists++;
        });
    });

    return stats;
};

export const rankingService = {
  // 1. Ranking MENSAL (Agora aceita targetDate)
  getMonthRankings: (players: Player[], allMatches: any[], targetDate: Date = new Date()): RankingsData => {
    const currentMonth = targetDate.getMonth();
    const currentYear = targetDate.getFullYear();

    const monthMatches = allMatches.filter(m => {
        const d = new Date(m.date);
        return m.status === MatchStatus.FINISHED && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    return calculateStatsFromMatches(monthMatches, players);
  },

  // 2. Ranking GERAL
  getAllTimeRankings: (players: Player[], allMatches: any[]): RankingsData => {
    const finishedMatches = allMatches.filter(m => m.status === MatchStatus.FINISHED);
    return calculateStatsFromMatches(finishedMatches, players);
  },

  // 3. Hall da Fama
  getHallOfFame: async (monthKey?: string) => {
    let query = supabase.from('monthly_champions').select('*, player:players(name, photo_url, position)');
    
    if (monthKey) {
        query = query.eq('month_key', monthKey);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) { console.error('Erro Hall da Fama:', error); return []; }
    return data;
  },

  // 4. Salvar Hall da Fama
  saveChampions: async (monthKey: string, champions: { category: string, playerId: string, value: number }[]) => {
      await supabase.from('monthly_champions').delete().eq('month_key', monthKey);
      
      const records = champions.map(c => ({
          month_key: monthKey,
          category: c.category,
          player_id: c.playerId,
          stat_value: c.value,
          created_at: new Date().toISOString()
      }));
      
      const { error } = await supabase.from('monthly_champions').insert(records);
      if (error) throw error;
  }
};