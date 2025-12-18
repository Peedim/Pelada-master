import { supabase } from './supabaseClient';
import { Player, PlayerFormData, PlayerPosition } from '../types';

export interface PlayerUpdateSimulation {
  player: Player;
  oldOvr: number;
  newOvr: number;
  delta: number;
  changes: { pace: number; shooting: number; passing: number; defending: number };
}
// Tabela Mestra de Pesos
// Define quanto cada atributo impacta no OVR e na distribuição de bônus
export const OVR_WEIGHTS = {
  [PlayerPosition.GOLEIRO]:    { pace: 0.20, shooting: 0.05, passing: 0.15, defending: 0.60 },
  [PlayerPosition.DEFENSOR]:   { pace: 0.20, shooting: 0.05, passing: 0.25, defending: 0.50 },
  [PlayerPosition.MEIO_CAMPO]: { pace: 0.20, shooting: 0.20, passing: 0.50, defending: 0.10 },
  [PlayerPosition.ATACANTE]:   { pace: 0.20, shooting: 0.60, passing: 0.15, defending: 0.05 },
  // Fallback
  'default':                   { pace: 0.25, shooting: 0.25, passing: 0.25, defending: 0.25 }
};

export const calculateWeightedOvr = (position: string, attr: { pace: number, shooting: number, passing: number, defending: number }) => {
  const posKey = Object.values(PlayerPosition).includes(position as PlayerPosition) 
    ? position as PlayerPosition 
    : 'default';

  const w = OVR_WEIGHTS[posKey] || OVR_WEIGHTS['default'];
  
  // Cálculo ponderado usando a tabela
  return (attr.pace * w.pace) + 
         (attr.shooting * w.shooting) + 
         (attr.passing * w.passing) + 
         (attr.defending * w.defending);
};

export const playerService = {
  getAll: async (): Promise<Player[]> => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('initial_ovr', { ascending: false });

    if (error) { console.error("Erro Supabase:", error); return []; }
    
    return data.map((p: any) => ({
      ...p,
      playStyle: p.play_style,
      attributes: { pace: p.pace, shooting: p.shooting, passing: p.passing, defending: p.defending },
      accumulators: { pace: Number(p.pace_acc || 0), shooting: Number(p.shooting_acc || 0), passing: Number(p.passing_acc || 0), defending: Number(p.defending_acc || 0) }
    }));
  },

  create: async (formData: PlayerFormData): Promise<Player> => {
    const { pace, shooting, passing, defending, position, playStyle, name, email, shirt_number, photo_url, is_admin } = formData;
    const calculatedOvr = Math.round(calculateWeightedOvr(position as string, { pace, shooting, passing, defending }));

    const { data, error } = await supabase
      .from('players')
      .insert([{
        name, email, position, play_style: playStyle, shirt_number: shirt_number || null, photo_url: photo_url || null, is_admin: !!is_admin,
        initial_ovr: calculatedOvr, pace, shooting, passing, defending,
        pace_acc: 0, shooting_acc: 0, passing_acc: 0, defending_acc: 0,
        ovr_history: [], monthly_delta: 0
      }])
      .select().single();

    if (error) throw error;
    return { ...data, playStyle: data.play_style, attributes: { pace, shooting, passing, defending }, accumulators: { pace: 0, shooting: 0, passing: 0, defending: 0 } };
  },

  update: async (id: string, formData: PlayerFormData): Promise<Player> => {
    const { pace, shooting, passing, defending, position, playStyle, name, email, shirt_number, photo_url, is_admin } = formData;
    const calculatedOvr = Math.round(calculateWeightedOvr(position as string, { pace, shooting, passing, defending }));

    const { data, error } = await supabase
      .from('players')
      .update({
        name, email, position, play_style: playStyle, shirt_number: shirt_number || null, photo_url: photo_url || null, is_admin: !!is_admin,
        initial_ovr: calculatedOvr, pace, shooting, passing, defending
      })
      .eq('id', id).select().single();

    if (error) throw error;
    return { ...data, playStyle: data.play_style, attributes: { pace, shooting, passing, defending }, accumulators: { pace: data.pace_acc, shooting: data.shooting_acc, passing: data.passing_acc, defending: data.defending_acc } };
  },

updateFeaturedAchievement: async (playerId: string, achievementId: string) => {
    const { error } = await supabase
      .from('players')
      .update({ featured_achievement_id: achievementId })
      .eq('id', playerId);
      
    if (error) throw error;
  },
  
  getManualAchievements: async (playerId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('manual_achievements')
      .select('achievement_id')
      .eq('player_id', playerId);
      
    if (error) {
      console.error('Erro ao buscar conquistas manuais:', error);
      return [];
    }
    
    // Retorna apenas um array de strings: ['special_founder', 'resenha_bagre']
    return data.map((item: any) => item.achievement_id);
  },

  updatePlayerDeltas: async () => {},

  processMonthlyUpdate: async (): Promise<string> => {
      console.log("Iniciando Virada de Mês...");
      const { data: players } = await supabase.from('players').select('*');
      if (!players) return "Erro ao buscar jogadores";

      let count = 0;
      
      for (const p of players) {
          // [CHECKPOINT V5] Regra da divisão por 4 com arredondamento
          const gainPace = Math.round(Number(p.pace_acc || 0) / 4);
          const gainShoot = Math.round(Number(p.shooting_acc || 0) / 4);
          const gainPass = Math.round(Number(p.passing_acc || 0) / 4);
          const gainDef = Math.round(Number(p.defending_acc || 0) / 4);

          let newPace = Math.max(1, Math.min(99, p.pace + gainPace));
          let newShoot = Math.max(1, Math.min(99, p.shooting + gainShoot));
          let newPass = Math.max(1, Math.min(99, p.passing + gainPass));
          let newDef = Math.max(1, Math.min(99, p.defending + gainDef));

          // Recalcula OVR com os novos atributos e a Nova Tabela de Pesos
          const rawNewOvr = calculateWeightedOvr(p.position, { pace: newPace, shooting: newShoot, passing: newPass, defending: newDef });
          let finalOvr = Math.round(rawNewOvr);

          // Trava de segurança +/- 2 pontos no OVR geral
          const currentOvr = p.initial_ovr;
          const diff = finalOvr - currentOvr;
          if (diff > 2) finalOvr = currentOvr + 2;
          if (diff < -2) finalOvr = currentOvr - 2;

          const history = Array.isArray(p.ovr_history) ? [...p.ovr_history] : [];
          if (finalOvr !== currentOvr) {
              history.push({ date: new Date().toISOString(), ovr: finalOvr });
              count++;
          }

          // Salva no banco e ZERA os acumuladores
          await supabase.from('players').update({
              pace: newPace, shooting: newShoot, passing: newPass, defending: newDef,
              initial_ovr: finalOvr,
              pace_acc: 0, shooting_acc: 0, passing_acc: 0, defending_acc: 0,
              monthly_delta: 0, ovr_history: history
          }).eq('id', p.id);
      }
      return `Virada de mês concluída! ${count} jogadores atualizaram o OVR.`;
  },
  simulateMonthlyUpdate: async (): Promise<PlayerUpdateSimulation[]> => {
      const { data: players } = await supabase.from('players').select('*');
      if (!players) return [];

      const simulation: PlayerUpdateSimulation[] = players.map((p: any) => {
          // Lógica de cálculo (mantida a mesma)
          let newPace = Math.round(p.pace + (Number(p.pace_acc || 0) / 4));
          let newShoot = Math.round(p.shooting + (Number(p.shooting_acc || 0) / 4));
          let newPass = Math.round(p.passing + (Number(p.passing_acc || 0) / 4));
          let newDef = Math.round(p.defending + (Number(p.defending_acc || 0) / 4));

          // Limites 1-99
          newPace = Math.max(1, Math.min(99, newPace));
          newShoot = Math.max(1, Math.min(99, newShoot));
          newPass = Math.max(1, Math.min(99, newPass));
          newDef = Math.max(1, Math.min(99, newDef));

          const rawNewOvr = calculateWeightedOvr(p.position, { pace: newPace, shooting: newShoot, passing: newPass, defending: newDef });
          let finalOvr = Math.round(rawNewOvr);
          const currentOvr = p.initial_ovr;
          
          // Trava de segurança (+/- 2 de OVR máximo por mês)
          const diff = finalOvr - currentOvr;
          if (diff > 2) finalOvr = currentOvr + 2;
          if (diff < -2) finalOvr = currentOvr - 2;

          return {
              player: { ...p, id: p.id, name: p.name }, // Mapeamento básico necessário
              oldOvr: currentOvr,
              newOvr: finalOvr,
              delta: finalOvr - currentOvr,
              changes: { pace: newPace, shooting: newShoot, passing: newPass, defending: newDef }
          };
      });

      // Retorna apenas quem teve mudança ou tem acumuladores pendentes
      return simulation.filter(s => s.delta !== 0 || s.changes.pace !== s.player.attributes?.pace);
  },

  // 2. APLICA as mudanças no banco
  commitMonthlyUpdate: async (simulation: PlayerUpdateSimulation[]): Promise<void> => {
      for (const sim of simulation) {
          const history = sim.player.ovr_history || [];
          // Só adiciona histórico se o OVR mudou
          if (sim.newOvr !== sim.oldOvr) {
              history.push({ date: new Date().toISOString(), ovr: sim.newOvr });
          }

          await supabase.from('players').update({
              pace: sim.changes.pace,
              shooting: sim.changes.shooting,
              passing: sim.changes.passing,
              defending: sim.changes.defending,
              initial_ovr: sim.newOvr,
              pace_acc: 0, shooting_acc: 0, passing_acc: 0, defending_acc: 0, // Zera acumuladores
              monthly_delta: 0,
              ovr_history: history
          }).eq('id', sim.player.id);
      }
  }
};