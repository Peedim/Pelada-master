import { supabase } from './supabaseClient';
import { Player, PlayerFormData, PlayerPosition } from '../types';

// Tabela de Pesos Baseada no CSV (Porcentagem do OVR)
// EXPORTADA para ser usada no matchService
export const OVR_WEIGHTS = {
  [PlayerPosition.GOLEIRO]:    { pace: 0.20, shooting: 0.05, passing: 0.15, defending: 0.60 },
  [PlayerPosition.DEFENSOR]:   { pace: 0.20, shooting: 0.05, passing: 0.25, defending: 0.50 },
  [PlayerPosition.MEIO_CAMPO]: { pace: 0.20, shooting: 0.20, passing: 0.50, defending: 0.10 },
  [PlayerPosition.ATACANTE]:   { pace: 0.20, shooting: 0.60, passing: 0.15, defending: 0.05 },
  // Fallback genérico
  'default':                   { pace: 0.25, shooting: 0.25, passing: 0.25, defending: 0.25 }
};

export const calculateWeightedOvr = (position: string, attr: { pace: number, shooting: number, passing: number, defending: number }) => {
  const posKey = Object.values(PlayerPosition).includes(position as PlayerPosition) 
    ? position as PlayerPosition 
    : 'default';

  const w = OVR_WEIGHTS[posKey] || OVR_WEIGHTS['default'];
  
  // Cálculo ponderado direto
  const weightedSum = 
    (attr.pace * w.pace) + 
    (attr.shooting * w.shooting) + 
    (attr.passing * w.passing) + 
    (attr.defending * w.defending);

  return weightedSum;
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

  updatePlayerDeltas: async () => {},

  processMonthlyUpdate: async (): Promise<string> => {
      console.log("Iniciando Virada de Mês...");
      const { data: players } = await supabase.from('players').select('*');
      if (!players) return "Erro ao buscar jogadores";

      let count = 0;
      
      for (const p of players) {
          // REGRA DA DIVISÃO POR 4 E ARREDONDAMENTO
          const gainPace = Math.round(Number(p.pace_acc || 0) / 4);
          const gainShoot = Math.round(Number(p.shooting_acc || 0) / 4);
          const gainPass = Math.round(Number(p.passing_acc || 0) / 4);
          const gainDef = Math.round(Number(p.defending_acc || 0) / 4);

          // Aplica aos atributos base (Clamp 1-99)
          let newPace = Math.max(1, Math.min(99, p.pace + gainPace));
          let newShoot = Math.max(1, Math.min(99, p.shooting + gainShoot));
          let newPass = Math.max(1, Math.min(99, p.passing + gainPass));
          let newDef = Math.max(1, Math.min(99, p.defending + gainDef));

          // Recalcula OVR com os novos atributos e a Nova Tabela de Pesos
          const rawNewOvr = calculateWeightedOvr(p.position, { pace: newPace, shooting: newShoot, passing: newPass, defending: newDef });
          let finalOvr = Math.round(rawNewOvr);

          // Trava de segurança +/- 2 pontos no OVR geral (Opcional, pode remover se quiser livre)
          const currentOvr = p.initial_ovr;
          const diff = finalOvr - currentOvr;
          if (diff > 2) finalOvr = currentOvr + 2;
          if (diff < -2) finalOvr = currentOvr - 2;

          // Histórico
          const history = Array.isArray(p.ovr_history) ? [...p.ovr_history] : [];
          if (finalOvr !== currentOvr) {
              history.push({ date: new Date().toISOString(), ovr: finalOvr });
              count++;
          }

          // Salva no banco e ZERA os acumuladores
          await supabase.from('players').update({
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
              ovr_history: history
          }).eq('id', p.id);
      }
      return `Virada de mês concluída! ${count} jogadores atualizaram o OVR.`;
  }
};