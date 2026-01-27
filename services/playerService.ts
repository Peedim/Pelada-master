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
      pace,
      shooting,
      passing,
      defending,
      position,
      playStyle,
      name,
      email,
      shirt_number,
      photo_url,
      is_admin,
      initial_ovr,
    } = formData;

    const totalAttributes =
      (pace || 0) + (shooting || 0) + (passing || 0) + (defending || 0);

    let finalOvr = initial_ovr;

    if (totalAttributes > 0) {
      finalOvr = Math.round(
        calculateWeightedOvr(position as string, {
          pace,
          shooting,
          passing,
          defending,
        })
      );
    }

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
          initial_ovr: finalOvr,
          pace: pace || 0,
          shooting: shooting || 0,
          passing: passing || 0,
          defending: defending || 0,
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
      attributes: { pace, shooting, passing, defending },
      accumulators: { pace: 0, shooting: 0, passing: 0, defending: 0 },
    };
  },

  update: async (id: string, formData: PlayerFormData): Promise<Player> => {
    const {
      pace,
      shooting,
      passing,
      defending,
      position,
      playStyle,
      name,
      email,
      shirt_number,
      photo_url,
      is_admin,
      initial_ovr,
    } = formData;

    const totalAttributes =
      (pace || 0) + (shooting || 0) + (passing || 0) + (defending || 0);

    let finalOvr = initial_ovr;

    if (totalAttributes > 0) {
      finalOvr = Math.round(
        calculateWeightedOvr(position as string, {
          pace,
          shooting,
          passing,
          defending,
        })
      );
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
        initial_ovr: finalOvr,
        pace: pace || 0,
        shooting: shooting || 0,
        passing: passing || 0,
        defending: defending || 0,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return {
      ...data,
      playStyle: data.play_style,
      attributes: { pace, shooting, passing, defending },
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
    
    // Busca TODOS os jogos para calcular presenças
    const allMatches = await matchService.getAll();

    // 2. Calcula Rankings do Mês Atual (Memória)
    const monthlyStats = rankingService.getCurrentMonthRankings(
      players as Player[],
      allMatches
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

    // 4. Salva no Hall da Fama
    const now = new Date();
    const monthKey = now
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

    // 5. Aplica Evolução de OVR (Com Divisor Dinâmico e Verificação de Inatividade)
    let count = 0;

    // Filtra apenas jogos do mês atual para contar presença
    const currentMonthMatches = allMatches.filter(m => {
        const mDate = new Date(m.date);
        return mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
    });

    for (const p of playersData) {
      // Conta quantos jogos o jogador participou neste mês
      const matchesPlayed = currentMonthMatches.filter(m => 
          m.teams.some(t => t.players.some(pl => pl.id === p.id))
      ).length;

      // Define o divisor: Se jogou 0, usa 1 para não quebrar a conta (mas o acc será 0 mesmo)
      // Se jogou 1, divide por 1. Se jogou 4, divide por 4.
      const divisor = matchesPlayed > 0 ? matchesPlayed : 1;

      // Verifica atividade total para proteção de OVR
      const totalActivity =
        Math.abs(Number(p.pace_acc || 0)) +
        Math.abs(Number(p.shooting_acc || 0)) +
        Math.abs(Number(p.passing_acc || 0)) +
        Math.abs(Number(p.defending_acc || 0));

      const gainPace = Math.round(Number(p.pace_acc || 0) / divisor);
      const gainShoot = Math.round(Number(p.shooting_acc || 0) / divisor);
      const gainPass = Math.round(Number(p.passing_acc || 0) / divisor);
      const gainDef = Math.round(Number(p.defending_acc || 0) / divisor);

      let newPace = Math.max(1, Math.min(99, p.pace + gainPace));
      let newShoot = Math.max(1, Math.min(99, p.shooting + gainShoot));
      let newPass = Math.max(1, Math.min(99, p.passing + gainPass));
      let newDef = Math.max(1, Math.min(99, p.defending + gainDef));

      let finalOvr;
      const currentOvr = p.initial_ovr;

      if (totalActivity === 0) {
        finalOvr = currentOvr;
      } else {
        const rawNewOvr = calculateWeightedOvr(p.position, {
          pace: newPace,
          shooting: newShoot,
          passing: newPass,
          defending: newDef,
        });
        finalOvr = Math.round(rawNewOvr);

        const diff = finalOvr - currentOvr;
        if (diff > 2) finalOvr = currentOvr + 2;
        if (diff < -2) finalOvr = currentOvr - 2;
      }

      const history = Array.isArray(p.ovr_history) ? [...p.ovr_history] : [];
      if (finalOvr !== currentOvr) {
        history.push({ date: new Date().toISOString(), ovr: finalOvr });
        count++;
      }

      await supabase
        .from("players")
        .update({
          pace: newPace,
          shooting: newShoot,
          passing: newPass,
          defending: newDef,
          initial_ovr: finalOvr,
          pace_acc: 0,
          shooting_acc: 0,
          passing_acc: 0,
          defending_acc: 0,
          monthly_delta: 0,
          ovr_history: history,
        })
        .eq("id", p.id);
    }
    return `Virada de mês concluída! Hall da Fama (${monthKey}) salvo e ${count} jogadores atualizaram o OVR.`;
  },

  simulateMonthlyUpdate: async (): Promise<PlayerUpdateSimulation[]> => {
    const { data: players } = await supabase.from("players").select("*");
    if (!players) return [];

    // Busca jogos para calcular o divisor correto na simulação também
    const allMatches = await matchService.getAll();
    const now = new Date();
    const currentMonthMatches = allMatches.filter(m => {
        const mDate = new Date(m.date);
        return mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
    });

    const simulation: PlayerUpdateSimulation[] = players.map((p: any) => {
      // Lógica de divisor dinâmico
      const matchesPlayed = currentMonthMatches.filter(m => 
          m.teams.some(t => t.players.some(pl => pl.id === p.id))
      ).length;
      const divisor = matchesPlayed > 0 ? matchesPlayed : 1;

      const totalActivity =
        Math.abs(Number(p.pace_acc || 0)) +
        Math.abs(Number(p.shooting_acc || 0)) +
        Math.abs(Number(p.passing_acc || 0)) +
        Math.abs(Number(p.defending_acc || 0));

      let newPace = Math.round(p.pace + Number(p.pace_acc || 0) / divisor);
      let newShoot = Math.round(p.shooting + Number(p.shooting_acc || 0) / divisor);
      let newPass = Math.round(p.passing + Number(p.passing_acc || 0) / divisor);
      let newDef = Math.round(p.defending + Number(p.defending_acc || 0) / divisor);

      newPace = Math.max(1, Math.min(99, newPace));
      newShoot = Math.max(1, Math.min(99, newShoot));
      newPass = Math.max(1, Math.min(99, newPass));
      newDef = Math.max(1, Math.min(99, newDef));

      let finalOvr;
      const currentOvr = p.initial_ovr;

      if (totalActivity === 0) {
        finalOvr = currentOvr;
      } else {
        const rawNewOvr = calculateWeightedOvr(p.position, {
          pace: newPace,
          shooting: newShoot,
          passing: newPass,
          defending: newDef,
        });
        finalOvr = Math.round(rawNewOvr);

        const diff = finalOvr - currentOvr;
        if (diff > 2) finalOvr = currentOvr + 2;
        if (diff < -2) finalOvr = currentOvr - 2;
      }

      return {
        player: { ...p, id: p.id, name: p.name },
        oldOvr: currentOvr,
        newOvr: finalOvr,
        delta: finalOvr - currentOvr,
        changes: {
          pace: newPace,
          shooting: newShoot,
          passing: newPass,
          defending: newDef,
        },
      };
    });

    return simulation.filter(
      (s) => s.delta !== 0 || s.changes.pace !== s.player.attributes?.pace
    );
  },

  commitMonthlyUpdate: async (
    simulation: PlayerUpdateSimulation[]
  ): Promise<void> => {
    for (const sim of simulation) {
      const history = sim.player.ovr_history || [];
      if (sim.newOvr !== sim.oldOvr) {
        history.push({ date: new Date().toISOString(), ovr: sim.newOvr });
      }

      await supabase
        .from("players")
        .update({
          pace: sim.changes.pace,
          shooting: sim.changes.shooting,
          passing: sim.changes.passing,
          defending: sim.changes.defending,
          initial_ovr: sim.newOvr,
          pace_acc: 0,
          shooting_acc: 0,
          passing_acc: 0,
          defending_acc: 0,
          monthly_delta: 0,
          ovr_history: history,
        })
        .eq("id", sim.player.id);
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