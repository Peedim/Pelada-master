import { supabase } from './supabaseClient';
import { Player, PlayerFormData } from '../types';

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
      // Mapeamento IMPORTANTE: Banco (play_style) -> Código (playStyle)
      playStyle: p.play_style,
      
      attributes: {
        pace: p.pace,
        shooting: p.shooting,
        passing: p.passing,
        dribbling: p.dribbling,
        defending: p.defending,
        physical: p.physical
      }
    }));
  },

  create: async (formData: PlayerFormData): Promise<Player> => {
    // Separa o playStyle do resto para renomear
    const { pace, shooting, passing, dribbling, defending, physical, playStyle, ...rest } = formData;
    
    const { data, error } = await supabase
      .from('players')
      .insert([{
        ...rest,
        play_style: playStyle, // Mapeamento: Código -> Banco
        pace, shooting, passing, dribbling, defending, physical,
        ovr_history: []
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Retorna formatado para o frontend não quebrar
    return {
        ...data,
        playStyle: data.play_style,
        attributes: { pace, shooting, passing, dribbling, defending, physical }
    };
  },

  update: async (id: string, formData: PlayerFormData): Promise<Player> => {
    const { pace, shooting, passing, dribbling, defending, physical, playStyle, ...rest } = formData;

    const { data, error } = await supabase
      .from('players')
      .update({
        ...rest,
        play_style: playStyle, // Mapeamento: Código -> Banco
        pace, shooting, passing, dribbling, defending, physical
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    return {
        ...data,
        playStyle: data.play_style,
        attributes: { pace, shooting, passing, dribbling, defending, physical }
    };
  },

  updatePlayerDeltas: async (deltaUpdates: Record<string, number>) => {
      for (const [id, delta] of Object.entries(deltaUpdates)) {
          const { data: player } = await supabase.from('players').select('monthly_delta').eq('id', id).single();
          const current = Number(player?.monthly_delta || 0);
          await supabase.from('players').update({ monthly_delta: current + delta }).eq('id', id);
      }
  },

  processMonthlyUpdate: async (): Promise<string> => {
      const { data: players } = await supabase.from('players').select('*');
      if (!players) return "Erro ao buscar jogadores";

      let count = 0;
      for (const p of players) {
          const delta = p.monthly_delta || 0;
          const change = Math.trunc(delta);

          if (change !== 0) {
              const cappedChange = Math.max(-4, Math.min(4, change));
              const newOvr = Math.min(99, p.initial_ovr + cappedChange);
              
              const history = p.ovr_history || [];
              history.push({ date: new Date().toISOString(), ovr: newOvr });

              await supabase.from('players').update({
                  initial_ovr: newOvr,
                  monthly_delta: 0,
                  ovr_history: history
              }).eq('id', p.id);
              
              count++;
          } else {
              await supabase.from('players').update({ monthly_delta: 0 }).eq('id', p.id);
          }
      }
      return `Atualização concluída! ${count} jogadores alterados.`;
  }
};