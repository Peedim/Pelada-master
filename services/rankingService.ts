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

// --- HELPER: Encontrar Campeão com Desempate e Filtros ---
export const findChampion = (
  data: RankingsData,
  players: Player[],
  category: "wins" | "goals" | "assists" | "cleanSheets"
) => {
  const list = Object.values(data).map((stat) => {
    const player = players.find((p) => p.id === stat.playerId);
    return {
      ...stat,
      position: player?.position || "",
      contributions: stat.goals + stat.assists,
    };
  });

  const filtered = list.filter((item) => {
    if (item[category] === 0) return false;

    if (category === "cleanSheets") {
      return ["Defensor", "Goleiro", "Zagueiro"].includes(item.position);
    }
    return true;
  });

  filtered.sort((a, b) => {
    const diff = b[category] - a[category];
    if (diff !== 0) return diff;

    if (category === "wins") return b.contributions - a.contributions;
    if (category === "goals") return b.wins - a.wins;
    if (category === "assists") return b.wins - a.wins;
    if (category === "cleanSheets") return b.wins - a.wins;

    return 0;
  });

  return filtered.length > 0 ? filtered[0] : null;
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
  },

  // 5. Atualização AUTOMÁTICA dos Rankings (Executada em todo dia 1 do mês)
  // Consolida o Hall da Fama do mês anterior e zera os deltas para o novo mês SEM alterar o OVR dos jogadores.
  autoConsolidateMonthlyRankings: async (players: Player[], allMatches: any[]): Promise<boolean> => {
    try {
      const now = new Date();
      // O fechamento se aplica ao mês anterior assim que um novo mês inicia (dia 1 em diante)
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      const prevMonthKey = prevMonthDate
        .toLocaleString("pt-BR", { month: "short" })
        .toUpperCase()
        .replace(".", "");

      // 1. Verifica se os campeões do mês anterior já estão salvos no Hall da Fama
      const { data: existing, error: checkError } = await supabase
        .from('monthly_champions')
        .select('id')
        .eq('month_key', prevMonthKey);

      if (checkError) {
        console.error("Erro ao verificar Hall da Fama:", checkError);
        return false;
      }

      if (existing && existing.length > 0) {
        // Mês anterior já foi consolidado
        return false;
      }

      // 2. Filtra partidas finalizadas do mês anterior
      const prevMonth = prevMonthDate.getMonth();
      const prevYear = prevMonthDate.getFullYear();
      const prevMonthMatches = allMatches.filter(m => {
        const d = new Date(m.date);
        return m.status === MatchStatus.FINISHED && d.getMonth() === prevMonth && d.getFullYear() === prevYear;
      });

      if (prevMonthMatches.length === 0) {
        return false;
      }

      // 3. Calcula os rankings do mês anterior
      const monthlyStats = rankingService.getMonthRankings(players, allMatches, prevMonthDate);

      // 4. Determina os 4 Campeões do mês encerrado
      const mvp = findChampion(monthlyStats, players, "wins");
      const artilheiro = findChampion(monthlyStats, players, "goals");
      const garcom = findChampion(monthlyStats, players, "assists");
      const muralha = findChampion(monthlyStats, players, "cleanSheets");

      const championsToSave: { category: string; playerId: string; value: number }[] = [];
      if (mvp) championsToSave.push({ category: "wins", playerId: mvp.playerId, value: mvp.wins });
      if (artilheiro) championsToSave.push({ category: "goals", playerId: artilheiro.playerId, value: artilheiro.goals });
      if (garcom) championsToSave.push({ category: "assists", playerId: garcom.playerId, value: garcom.assists });
      if (muralha) championsToSave.push({ category: "clean_sheets", playerId: muralha.playerId, value: muralha.cleanSheets });

      if (championsToSave.length > 0) {
        await rankingService.saveChampions(prevMonthKey, championsToSave);
        console.log(`[Rankings Automáticos] Hall da Fama de ${prevMonthKey} consolidado automaticamente no dia 1!`);
      }

      // 5. Zera os deltas mensais residuais para o novo ciclo (SEM alterar o OVR dos jogadores)
      const { error: resetError } = await supabase
        .from("players")
        .update({ monthly_delta: 0, pace_acc: 0, shooting_acc: 0, passing_acc: 0, defending_acc: 0 })
        .not("id", "is", null);

      if (resetError) {
        console.warn("Aviso ao zerar deltas residuais:", resetError);
      }

      // 6. Invalida cache local do Hall da Fama para refletir imediatamente
      localStorage.removeItem('c13_hall_of_fame');

      return true;
    } catch (err) {
      console.error("Erro na consolidação automática dos rankings mensais:", err);
      return false;
    }
  }
};