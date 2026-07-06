import { useQuery } from '@tanstack/react-query';
import { playerService } from '../services/playerService';
import { Player } from '../types';

export const usePlayers = () => {
  return useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: async () => {
      return await playerService.getAll();
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    refetchOnWindowFocus: false,
  });
};