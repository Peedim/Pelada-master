import { supabase } from './supabaseClient';
import { Player, PlayerFormData, PlayerPosition } from '../types';

// Função auxiliar para calcular OVR baseado nos pesos da posição
export const calculateWeightedOvr = (position: string, attr: { pace: number, shooting: number, passing: number, defending: number }) => {
  const { pace, shooting, passing, defending } = attr;
  
  switch (position) {
    case PlayerPosition.GOLEIRO:
      return (pace * 1 + shooting * 0.1 + passing * 1 + defending * 8) / 10.1;
    case PlayerPosition.DEFENSOR:
      return (pace * 2 + shooting * 0.5 + passing * 2.5 + defending * 5) / 10;
    case PlayerPosition.MEIO_CAMPO:
      return (pace * 2 + shooting * 2 + passing * 5 + defending * 1) / 10;
    case PlayerPosition.ATACANTE:
      return (pace * 2 + shooting * 6 + passing * 1.5 + defending * 0.5) / 10;
    default:
      return (pace + shooting + passing + defending) / 4;
  }
};

export const playerService = {
  getAll: async (): Promise<Player[]> => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('initial_ovr', { ascending: false });

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
        defending: p.defending
      },
      accumulators: {
        pace: Number(p.pace_acc || 0),
        shooting: Number(p.shooting_acc || 0),
        passing: Number(p.passing_acc || 0),
        defending: Number(p.defending_acc || 0)
      }
    }));
  },

  create: async (formData: PlayerFormData): Promise<Player> => {
    const { pace, shooting, passing, defending, position, playStyle, name, email, shirt_number, photo_url, is_admin } = formData;
    
    // Calcula OVR
    const calculatedOvr = Math.round(calculateWeightedOvr(position as string, { pace, shooting, passing, defending }));

    const { data, error } = await supabase
      .from('players')
      .insert([{
        // LISTA EXPLÍCITA (Whitelist) - Nada extra passa aqui
        name,
        email,
        position,
        play_style: playStyle,
        shirt_number: shirt_number || null,
        photo_url: photo_url || null,
        is_admin: !!is_admin,
        initial_ovr: calculatedOvr,
        pace, 
        shooting, 
        passing, 
        defending,
        // Inicia zerado
        pace_acc: 0, shooting_acc: 0, passing_acc: 0, defending_acc: 0,
        ovr_history: [],
        monthly_delta: 0
      }])
      .select()
      .single();

    if (error) throw error;
    
    return {
        ...data,
        playStyle: data.play_style,
        attributes: { pace, shooting, passing, defending },
        accumulators: { pace: 0, shooting: 0, passing: 0, defending: 0 }
    };
  },

  update: async (id: string, formData: PlayerFormData): Promise<Player> => {
    const { pace, shooting, passing, defending, position, playStyle, name, email, shirt_number, photo_url, is_admin } = formData;
    
    // Calcula OVR
    const calculatedOvr = Math.round(calculateWeightedOvr(position as string, { pace, shooting, passing, defending }));

    const { data, error } = await supabase
      .from('players')
      .update({
        // LISTA EXPLÍCITA (Whitelist)
        name,
        email,
        position,
        play_style: playStyle,
        shirt_number: shirt_number || null,
        photo_url: photo_url || null,
        is_admin: !!is_admin,
        initial_ovr: calculatedOvr,
        pace,
        shooting,
        passing,
        defending
        // NOTA: Não incluímos accumulators, attributes, nem nada que não seja coluna do banco
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    return {
        ...data,
        playStyle: data.play_style,
        attributes: { pace, shooting, passing, defending },
        accumulators: { 
            pace: data.pace_acc, shooting: data.shooting_acc, 
            passing: data.passing_acc, defending: data.defending_acc 
        }
    };
  },

  updatePlayerDeltas: async (deltaUpdates: Record<string, number>) => {
      // Deprecated
  },

  processMonthlyUpdate: async (): Promise<string> => {
      const { data: players } = await supabase.from('players').select('*');
      if (!players) return "Erro ao buscar jogadores";

      let count = 0;
      
      for (const p of players) {
          // Lógica V3 de Virada de Mês
          let newPace = Math.round(p.pace + (Number(p.pace_acc) / 4));
          let newShoot = Math.round(p.shooting + (Number(p.shooting_acc) / 4));
          let newPass = Math.round(p.passing + (Number(p.passing_acc) / 4));
          let newDef = Math.round(p.defending + (Number(p.defending_acc) / 4));

          newPace = Math.max(1, Math.min(99, newPace));
          newShoot = Math.max(1, Math.min(99, newShoot));
          newPass = Math.max(1, Math.min(99, newPass));
          newDef = Math.max(1, Math.min(99, newDef));

          const rawNewOvr = calculateWeightedOvr(p.position, { pace: newPace, shooting: newShoot, passing: newPass, defending: newDef });
          let finalOvr = Math.round(rawNewOvr);

          const currentOvr = p.initial_ovr;
          const diff = finalOvr - currentOvr;

          if (diff > 2) finalOvr = currentOvr + 2;
          if (diff < -2) finalOvr = currentOvr - 2;

          if (true) { 
              const history = p.ovr_history || [];
              if (finalOvr !== currentOvr) {
                  history.push({ date: new Date().toISOString(), ovr: finalOvr });
                  count++;
              }

              await supabase.from('players').update({
                  pace: newPace,
                  shooting: newShoot,
                  passing: newPass,
                  defending: newDef,
                  initial_ovr: finalOvr,
                  pace_acc: 0, shooting_acc: 0, passing_acc: 0, defending_acc: 0,
                  monthly_delta: 0,
                  ovr_history: history
              }).eq('id', p.id);
          }
      }
      return `Virada de mês concluída! Jogadores processados.`;
  }
};