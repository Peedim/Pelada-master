import { supabase } from "./supabaseClient";
import { Player, PlayerFormData, PlayerPosition, RankingsData } from "../types";
import { matchService } from "./matchService";
import { rankingService } from "./rankingService";

export interface PlayerUpdateSimulation {
  player: Player;
  oldOvr: number;
  newOvr: number;
  delta: number;
  changes: {
    pace: number;
    shooting: number;
    passing: number;
    defending: number;
  };
}

// Tabela Mestra de Pesos
export const OVR_WEIGHTS = {
  [PlayerPosition.GOLEIRO]: {
    pace: 0.2,
    shooting: 0.05,
    passing: 0.15,
    defending: 0.6,
  },
  [PlayerPosition.DEFENSOR]: {
    pace: 0.2,
    shooting: 0.05,
    passing: 0.25,
    defending: 0.5,
  },
  [PlayerPosition.MEIO_CAMPO]: {
    pace: 0.2,
    shooting: 0.2,
    passing: 0.5,
    defending: 0.1,
  },
  [PlayerPosition.ATACANTE]: {
    pace: 0.2,
    shooting: 0.6,
    passing: 0.15,
    defending: 0.05,
  },
  // Fallback
  default: { pace: 0.25, shooting: 0.25, passing: 0.25, defending: 0.25 },
};

export const calculateWeightedOvr = (
  position: string,
  attr: { pace: number; shooting: number; passing: number; defending: number }
) => {
  const posKey = Object.values(PlayerPosition).includes(
    position as PlayerPosition
  )
    ? (position as PlayerPosition)
    : "default";

  const w = OVR_WEIGHTS[posKey] || OVR_WEIGHTS["default"];

  return (
    attr.pace * w.pace +
    attr.shooting * w.shooting +
    attr.passing * w.passing +
    attr.defending * w.defending
  );
};

// --- HELPER: Encontrar Campeão com Desempate e Filtros ---
const findChampion = (
  data: RankingsData,
  players: Player[],
  category: "wins" | "goals" | "assists" | "cleanSheets"
) => {
  // 1. Transforma em lista enriquecida com dados do jogador
  const list = Object.values(data).map((stat) => {
    const player = players.find((p) => p.id === stat.playerId);
    return {
      ...stat,
      position: player?.position || "",
      // Calcula participações para desempate de MVP
      contributions: stat.goals + stat.assists,
    };
  });

  // 2. Filtra (Remove Zeros e Aplica Regra da Muralha)
  const filtered = list.filter((item) => {
    if (item[category] === 0) return false;

    // Regra da Muralha: Só Defensor e Goleiro
    if (category === "cleanSheets") {
      return ["Defensor", "Goleiro", "Zagueiro"].includes(item.position);
    }
    return true;
  });

  // 3. Ordena com Critérios de Desempate
  filtered.sort((a, b) => {
    // Critério 1: O valor principal (quem tem mais)
    const diff = b[category] - a[category];
    if (diff !== 0) return diff;

    // Critério 2: Desempate
    if (category === "wins") return b.contributions - a.contributions; // MVP -> Gols + Assists
    if (category === "goals") return b.wins - a.wins; // Artilheiro -> Vitórias
    if (category === "assists") return b.wins - a.wins; // Garçom -> Vitórias
    if (category === "cleanSheets") return b.wins - a.wins; // Muralha -> Vitórias

    return 0;
  });

  // Retorna o Top 1 ou null se ninguém pontuou
  return filtered.length > 0 ? filtered[0] : null;
};

export const playerService = {
  getAll: async (): Promise<Player[]> => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("initial_ovr", { ascending: false });

    if (error) {
      console.error("Erro Supabase:", error);
      return [];
    }

    return data.map((p: any) => ({
      ...p,
      playStyle: p.play_style,
      is_mensalista: p.is_mensalista !== undefined ? p.is_mensalista : true,
      attributes: {
        pace: p.pace,
        shooting: p.shooting,
        passing: p.passing,
        defending: p.defending,
      },
      accumulators: {
        pace: Number(p.pace_acc || 0),
        shooting: Number(p.shooting_acc || 0),
        passing: Number(p.passing_acc || 0),
        defending: Number(p.defending_acc || 0),
      },
    }));
  },

  create: async (formData: PlayerFormData): Promise<Player> => {
    const {
      position,
      playStyle,
      name,
      email,
      shirt_number,
      photo_url,
      is_admin,
      initial_ovr,
      is_mensalista,
    } = formData;

    const finalOvr = Number(initial_ovr) || 60;

    const { data, error } = await supabase
      .from("players")
      .insert([
        {
          name,
          email,
          position,
          play_style: playStyle,
          shirt_number: shirt_number || null,
          photo_url: photo_url || null,
          is_admin: !!is_admin,
          is_mensalista: is_mensalista !== undefined ? !!is_mensalista : true,
          initial_ovr: finalOvr,
          pace: finalOvr,
          shooting: finalOvr,
          passing: finalOvr,
          defending: finalOvr,
          pace_acc: 0,
          shooting_acc: 0,
          passing_acc: 0,
          defending_acc: 0,
          ovr_history: [],
          monthly_delta: 0,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      playStyle: data.play_style,
      attributes: { pace: finalOvr, shooting: finalOvr, passing: finalOvr, defending: finalOvr },
      accumulators: { pace: 0, shooting: 0, passing: 0, defending: 0 },
    };
  },

  update: async (id: string, formData: PlayerFormData): Promise<Player> => {
    const {
      position,
      playStyle,
      name,
      email,
      shirt_number,
      photo_url,
      is_admin,
      initial_ovr,
      is_mensalista,
    } = formData;

    const finalOvr = Number(initial_ovr) || 60;

    const { data, error } = await supabase
      .from("players")
      .update({
        name,
        email,
        position,
        play_style: playStyle,
        shirt_number: shirt_number || null,
        photo_url: photo_url || null,
        is_admin: !!is_admin,
        is_mensalista: is_mensalista !== undefined ? !!is_mensalista : true,
        initial_ovr: finalOvr,
        pace: finalOvr,
        shooting: finalOvr,
        passing: finalOvr,
        defending: finalOvr,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      playStyle: data.play_style,
      attributes: { pace: finalOvr, shooting: finalOvr, passing: finalOvr, defending: finalOvr },
      accumulators: {
        pace: data.pace_acc,
        shooting: data.shooting_acc,
        passing: data.passing_acc,
        defending: data.defending_acc,
      },
    };
  },

  updateFeaturedAchievement: async (
    playerId: string,
    achievementId: string | null
  ) => {
    const { error } = await supabase
      .from("players")
      .update({ featured_achievement_id: achievementId })
      .eq("id", playerId);

    if (error) throw error;
  },

  getManualAchievements: async (playerId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("manual_achievements")
      .select("achievement_id")
      .eq("player_id", playerId);

    if (error) {
      console.error("Erro ao buscar conquistas manuais:", error);
      return [];
    }
    return data.map((item: any) => item.achievement_id);
  },

  updatePlayerDeltas: async () => {},

  processMonthlyUpdate: async (): Promise<string> => {
    console.log("Iniciando Virada de Mês...");

    // 1. Busca Dados Necessários
    const { data: playersData } = await supabase.from("players").select("*");
    if (!playersData) return "Erro ao buscar jogadores";

    // Mapeia para o formato Player esperado pelo service
    const players = playersData.map((p: any) => ({
      ...p,
      id: p.id,
      position: p.position,
    }));
    
    const allMatches = await matchService.getAll();

    // --- LÓGICA DE DATA INTELIGENTE ---
    const now = new Date();
    // Se hoje for até o dia 10, consideramos que a virada é referente ao mês passado.
    const isBeginningOfMonth = now.getDate() <= 10;
    const targetDate = isBeginningOfMonth 
        ? new Date(now.getFullYear(), now.getMonth() - 1, 15) // Volta para o mês anterior
        : now;

    // 2. Calcula Rankings usando a Data Alvo (Corrigido)
    const monthlyStats = rankingService.getMonthRankings(
      players as Player[],
      allMatches,
      targetDate // Passa a data correta
    );

    // 3. Determina os Campeões
    const mvp = findChampion(monthlyStats, players as Player[], "wins");
    const artilheiro = findChampion(monthlyStats, players as Player[], "goals");
    const garcom = findChampion(monthlyStats, players as Player[], "assists");
    const muralha = findChampion(
      monthlyStats,
      players as Player[],
      "cleanSheets"
    );

    // 4. Salva no Hall da Fama (Usando a Data Alvo)
    const monthKey = targetDate
      .toLocaleString("pt-BR", { month: "short" })
      .toUpperCase()
      .replace(".", "");

    const championsToSave = [];
    if (mvp) championsToSave.push({ category: "wins", playerId: mvp.playerId, value: mvp.wins });
    if (artilheiro) championsToSave.push({ category: "goals", playerId: artilheiro.playerId, value: artilheiro.goals });
    if (garcom) championsToSave.push({ category: "assists", playerId: garcom.playerId, value: garcom.assists });
    if (muralha) championsToSave.push({ category: "clean_sheets", playerId: muralha.playerId, value: muralha.cleanSheets });

    if (championsToSave.length > 0) {
      await rankingService.saveChampions(monthKey, championsToSave);
    }

    // 5. Aplica Evolução de OVR
    let count = 0;
    
    // Filtra jogos usando a Data Alvo
    const currentMonthMatches = allMatches.filter(m => {
        const mDate = new Date(m.date);
        return mDate.getMonth() === targetDate.getMonth() && mDate.getFullYear() === targetDate.getFullYear();
    });

    const updatePromises: Promise<any>[] = [];

    for (const p of playersData) {
      const matchesPlayed = currentMonthMatches.filter(m => 
          m.teams.some(t => t.players.some(pl => pl.id === p.id))
      ).length;
      const divisor = matchesPlayed > 0 ? matchesPlayed : 1;

      const monthlyDelta = Number(p.monthly_delta || 0);
      const gainOvr = Math.round(monthlyDelta / divisor);

      let finalOvr = p.initial_ovr + gainOvr;
      finalOvr = Math.max(1, Math.min(99, finalOvr));

      const diff = finalOvr - p.initial_ovr;
      if (diff > 2) finalOvr = p.initial_ovr + 2;
      if (diff < -2) finalOvr = p.initial_ovr - 2;

      const history = Array.isArray(p.ovr_history) ? [...p.ovr_history] : [];
      // Sempre grava histórico na virada
      history.push({ date: new Date().toISOString(), ovr: finalOvr });
      
      if (finalOvr !== p.initial_ovr) {
        count++;
      }

      const updatePromise = supabase
        .from("players")
        .update({
          pace: finalOvr,
          shooting: finalOvr,
          passing: finalOvr,
          defending: finalOvr,
          initial_ovr: finalOvr,
          pace_acc: 0,
          shooting_acc: 0,
          passing_acc: 0,
          defending_acc: 0,
          monthly_delta: 0,
          ovr_history: history,
        })
        .eq("id", p.id);

      updatePromises.push(updatePromise);
    }

    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      const errorResult = results.find(r => r.error);
      if (errorResult) {
        console.error("Erro ao atualizar jogadores na virada do mês:", errorResult.error);
        throw errorResult.error;
      }
    }
    return `Virada de mês concluída! Hall da Fama (${monthKey}) salvo e ${count} jogadores atualizaram o OVR.`;
  },

  simulateMonthlyUpdate: async (): Promise<PlayerUpdateSimulation[]> => {
    const { data: players } = await supabase.from("players").select("*");
    if (!players) return [];

    const allMatches = await matchService.getAll();
    
    // --- LÓGICA DE DATA INTELIGENTE TAMBÉM NA SIMULAÇÃO ---
    const now = new Date();
    const isBeginningOfMonth = now.getDate() <= 10;
    const targetDate = isBeginningOfMonth 
        ? new Date(now.getFullYear(), now.getMonth() - 1, 15) 
        : now;

    const currentMonthMatches = allMatches.filter(m => {
        const mDate = new Date(m.date);
        return mDate.getMonth() === targetDate.getMonth() && mDate.getFullYear() === targetDate.getFullYear();
    });

    const simulation: PlayerUpdateSimulation[] = players.map((p: any) => {
      const matchesPlayed = currentMonthMatches.filter(m => 
          m.teams.some(t => t.players.some(pl => pl.id === p.id))
      ).length;
      const divisor = matchesPlayed > 0 ? matchesPlayed : 1;

      const monthlyDelta = Number(p.monthly_delta || 0);
      const gainOvr = Math.round(monthlyDelta / divisor);

      let finalOvr = p.initial_ovr + gainOvr;
      finalOvr = Math.max(1, Math.min(99, finalOvr));

      const diff = finalOvr - p.initial_ovr;
      if (diff > 2) finalOvr = p.initial_ovr + 2;
      if (diff < -2) finalOvr = p.initial_ovr - 2;

      return {
        player: { ...p, id: p.id, name: p.name },
        oldOvr: p.initial_ovr,
        newOvr: finalOvr,
        delta: finalOvr - p.initial_ovr,
        changes: {
          pace: finalOvr,
          shooting: finalOvr,
          passing: finalOvr,
          defending: finalOvr,
        },
      };
    });

    return simulation.filter(
      (s) => s.delta !== 0
    );
  },

  commitMonthlyUpdate: async (
    simulation: PlayerUpdateSimulation[]
  ): Promise<void> => {
    const updatePromises = simulation.map(sim => {
      const history = sim.player.ovr_history || [];
      // --- ALTERAÇÃO: SEMPRE GRAVA HISTÓRICO ---
      history.push({ date: new Date().toISOString(), ovr: sim.newOvr });

      return supabase
        .from("players")
        .update({
          pace: sim.newOvr,
          shooting: sim.newOvr,
          passing: sim.newOvr,
          defending: sim.newOvr,
          initial_ovr: sim.newOvr,
          pace_acc: 0,
          shooting_acc: 0,
          passing_acc: 0,
          defending_acc: 0,
          monthly_delta: 0,
          ovr_history: history,
        })
        .eq("id", sim.player.id);
    });

    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      const errorResult = results.find(r => r.error);
      if (errorResult) {
        console.error("Erro ao aplicar evolução de OVR no commit:", errorResult.error);
        throw errorResult.error;
      }
    }
  },
  updatePhoto: async (playerId: string, photoUrl: string) => {
    const { error } = await supabase
      .from("players")
      .update({ photo_url: photoUrl })
      .eq("id", playerId);

    if (error) throw error;
  },
};