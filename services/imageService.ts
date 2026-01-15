import { supabase } from './supabaseClient';

export const imageService = {
  /**
   * Faz upload de uma imagem e retorna a URL pública.
   * @param file O arquivo (File) selecionado no input
   * @param folder Pasta onde salvar (ex: 'profiles' ou 'champions')
   * @param fileName Nome do arquivo (geralmente o ID do jogador/partida)
   */
  uploadImage: async (file: File, folder: string, fileName: string): Promise<string | null> => {
    try {
      // 1. Define o caminho: images/profiles/user-id-123.png
      // Adicionamos um timestamp para evitar cache se o usuário trocar a foto
      const fileExt = file.name.split('.').pop();
      const filePath = `${folder}/${fileName}-${Date.now()}.${fileExt}`;

      // 2. Faz o Upload para o bucket 'images'
      const { error: uploadError } = await supabase.storage
        .from('images') // <--- Nome do bucket que você criou
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // 3. Pega a URL Pública
      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Erro no upload de imagem:', error);
      return null;
    }
  }
};