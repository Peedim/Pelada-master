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

    // Busca o jogador atual para verificar se o OVR mudou e manter o ovr_history
    const { data: curPlayer } = await supabase
      .from("players")
      .select("initial_ovr, ovr_history")
      .eq("id", id)
      .single();

    let history = Array.isArray(curPlayer?.ovr_history) ? [...curPlayer.ovr_history] : [];
    if (curPlayer && curPlayer.initial_ovr !== finalOvr) {
      history.push({ date: new Date().toISOString(), ovr: finalOvr });
    }

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
        ovr_history: history,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    localStorage.removeItem('c13_players');

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

  // Atualização MANUAL de OVR (individual ou em lote)
  updatePlayersOvr: async (updates: { playerId: string; newOvr: number }[]): Promise<void> => {
    if (!updates || updates.length === 0) return;

    const playerIds = updates.map(u => u.playerId);
    const { data: playersData, error: fetchErr } = await supabase
      .from("players")
      .select("id, initial_ovr, ovr_history")
      .in("id", playerIds);

    if (fetchErr) throw fetchErr;

    const playersMap = new Map<string, any>();
    playersData?.forEach(p => playersMap.set(p.id, p));

    const todayIso = new Date().toISOString();
    const updatePromises: Promise<any>[] = [];

    for (const update of updates) {
      const cur = playersMap.get(update.playerId);
      const finalOvr = Math.max(1, Math.min(99, Number(update.newOvr) || 60));
      let history = Array.isArray(cur?.ovr_history) ? [...cur.ovr_history] : [];
      
      // Registra a atualização manual de OVR no histórico
      history.push({ date: todayIso, ovr: finalOvr });

      const p = supabase
        .from("players")
        .update({
          initial_ovr: finalOvr,
          pace: finalOvr,
          shooting: finalOvr,
          passing: finalOvr,
          defending: finalOvr,
          ovr_history: history
        })
        .eq("id", update.playerId);

      updatePromises.push(p);
    }

    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      const err = results.find(r => r.error);
      if (err) throw err.error;
    }

    localStorage.removeItem('c13_players');
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
    console.log("Iniciando Virada de Mês (Sem alteração automática de OVR)...");

    // 1. Busca Dados Necessários
    const { data: playersData } = await supabase.from("players").select("*");
    if (!playersData) return "Erro ao buscar jogadores";

    const players = playersData.map((p: any) => ({
      ...p,
      id: p.id,
      position: p.position,
    }));
    
    const allMatches = await matchService.getAll();

    // --- LÓGICA DE DATA INTELIGENTE ---
    const now = new Date();
    const isBeginningOfMonth = now.getDate() <= 10;
    const targetDate = isBeginningOfMonth 
        ? new Date(now.getFullYear(), now.getMonth() - 1, 15) // Volta para o mês anterior
        : now;

    // 2. Calcula Rankings usando a Data Alvo
    const monthlyStats = rankingService.getMonthRankings(
      players as Player[],
      allMatches,
      targetDate
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

    // 5. Zera deltas mensais residuais SEM alterar o OVR dos jogadores
    await supabase
      .from("players")
      .update({
        monthly_delta: 0,
        pace_acc: 0,
        shooting_acc: 0,
        passing_acc: 0,
        defending_acc: 0,
      })
      .not("id", "is", null);

    localStorage.removeItem('c13_hall_of_fame');
    return `Rankings do mês (${monthKey}) consolidados no Hall da Fama com sucesso! O OVR dos jogadores foi mantido intacto.`;
  },

  simulateMonthlyUpdate: async (): Promise<PlayerUpdateSimulation[]> => {
    // Como a atualização de OVR agora é manual, não geramos simulação de alteração automática de OVR na virada de mês
    return [];
  },

  commitMonthlyUpdate: async (
    _simulation: PlayerUpdateSimulation[]
  ): Promise<void> => {
    // Consolida apenas rankings no Hall da Fama se ainda não estiver salvo
    try {
      const { data: playersData } = await supabase.from("players").select("*");
      const allMatches = await matchService.getAll();

      const now = new Date();
      const isBeginningOfMonth = now.getDate() <= 10;
      const targetDate = isBeginningOfMonth 
          ? new Date(now.getFullYear(), now.getMonth() - 1, 15) 
          : now;

      if (playersData && allMatches) {
        const players = playersData.map((p: any) => ({
          ...p,
          id: p.id,
          position: p.position,
        }));
        
        const monthlyStats = rankingService.getMonthRankings(players as Player[], allMatches, targetDate);
        const mvp = findChampion(monthlyStats, players as Player[], "wins");
        const artilheiro = findChampion(monthlyStats, players as Player[], "goals");
        const garcom = findChampion(monthlyStats, players as Player[], "assists");
        const muralha = findChampion(monthlyStats, players as Player[], "cleanSheets");

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
      }

      // Zera os deltas sem alterar OVR
      await supabase
        .from("players")
        .update({
          monthly_delta: 0,
          pace_acc: 0,
          shooting_acc: 0,
          passing_acc: 0,
          defending_acc: 0,
        })
        .not("id", "is", null);

      localStorage.removeItem('c13_hall_of_fame');
    } catch (e) {
      console.error("Erro ao consolidar Hall da Fama na virada:", e);
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