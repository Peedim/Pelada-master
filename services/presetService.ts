import { supabase } from './supabaseClient';

export interface PlayerPreset {
  id: string;
  name: string;
  player_ids: string[];
}

export const presetService = {
  getAll: async (): Promise<PlayerPreset[]> => {
    const { data, error } = await supabase
      .from('player_presets')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Erro ao buscar presets:', error);
      return [];
    }
    return data;
  },

  create: async (name: string, playerIds: string[]): Promise<PlayerPreset | null> => {
    const { data, error } = await supabase
      .from('player_presets')
      .insert([{ name, player_ids: playerIds }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar preset:', error);
      return null;
    }
    return data;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('player_presets')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Erro ao deletar preset:', error);
      return false;
    }
    return true;
  }
};