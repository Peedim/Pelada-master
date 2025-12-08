import { Player, PlayerFormData, PlayerPosition, PlayStyle } from '../types';

const STORAGE_KEY = 'pelada_manager_players_v2';

const generateId = () => crypto.randomUUID();
const daysAgo = (days: number) => new Date(Date.now() - 86400000 * days).toISOString();

// 28 Jogadores: 4 GKs, 8 DEFs, 10 MIDs, 6 ATTs
// OVR: 65 - 92
// PlayStyles distributed
const initialMockData: Player[] = [
  // --- GOLEIROS (4) ---
  {
    id: generateId(),
    created_at: daysAgo(10),
    name: 'Alisson Becker',
    email: 'alisson@example.com',
    position: PlayerPosition.GOLEIRO,
    playStyle: PlayStyle.WALL,
    shirt_number: 1,
    initial_ovr: 89,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 50, shooting: 40, passing: 60, dribbling: 50, defending: 90, physical: 85 }
  },
  {
    id: generateId(),
    created_at: daysAgo(5),
    name: 'Ederson Moraes',
    email: 'ederson@example.com',
    position: PlayerPosition.GOLEIRO,
    playStyle: PlayStyle.SWEEPER_KEEPER,
    shirt_number: 23,
    initial_ovr: 88,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 60, shooting: 45, passing: 85, dribbling: 60, defending: 88, physical: 82 }
  },
  {
    id: generateId(),
    created_at: daysAgo(2),
    name: 'Bento Krepski',
    email: 'bento@example.com',
    position: PlayerPosition.GOLEIRO,
    playStyle: PlayStyle.WALL,
    shirt_number: 12,
    initial_ovr: 78,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 48, shooting: 30, passing: 55, dribbling: 40, defending: 80, physical: 78 }
  },
  {
    id: generateId(),
    created_at: daysAgo(20),
    name: 'Rafael Cabral',
    email: 'rafael@example.com',
    position: PlayerPosition.GOLEIRO,
    playStyle: PlayStyle.SWEEPER_KEEPER,
    shirt_number: 22,
    initial_ovr: 72,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 45, shooting: 35, passing: 50, dribbling: 45, defending: 76, physical: 74 }
  },

  // --- DEFENSORES (8) ---
  {
    id: generateId(),
    created_at: daysAgo(15),
    name: 'Marquinhos',
    email: 'marquinhos@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.ANCHOR,
    shirt_number: 5,
    initial_ovr: 87,
    monthly_delta: 0.6, // Example: Em alta
    ovr_history: [],
    is_admin: true,
    attributes: { pace: 78, shooting: 50, passing: 75, dribbling: 70, defending: 89, physical: 80 }
  },
  {
    id: generateId(),
    created_at: daysAgo(12),
    name: 'Éder Militão',
    email: 'militao@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.ALL_ROUNDER,
    shirt_number: 3,
    initial_ovr: 86,
    monthly_delta: -1.2, // Example: Em baixa
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 85, shooting: 55, passing: 70, dribbling: 72, defending: 86, physical: 84 }
  },
  {
    id: generateId(),
    created_at: daysAgo(8),
    name: 'Thiago Silva',
    email: 'thiago@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.ANCHOR,
    shirt_number: 4,
    initial_ovr: 84,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: true,
    attributes: { pace: 60, shooting: 50, passing: 80, dribbling: 70, defending: 88, physical: 75 }
  },
  {
    id: generateId(),
    created_at: daysAgo(3),
    name: 'Gabriel Magalhães',
    email: 'gabriel@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.ANCHOR,
    shirt_number: 6,
    initial_ovr: 83,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 70, shooting: 45, passing: 65, dribbling: 60, defending: 87, physical: 86 }
  },
  {
    id: generateId(),
    created_at: daysAgo(25),
    name: 'Guilherme Arana',
    email: 'arana@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.ALL_ROUNDER,
    shirt_number: 13,
    initial_ovr: 79,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 84, shooting: 65, passing: 75, dribbling: 78, defending: 74, physical: 76 }
  },
  {
    id: generateId(),
    created_at: daysAgo(18),
    name: 'Danilo',
    email: 'danilo@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.ALL_ROUNDER,
    shirt_number: 2,
    initial_ovr: 76,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 70, shooting: 55, passing: 74, dribbling: 70, defending: 77, physical: 75 }
  },
  {
    id: generateId(),
    created_at: daysAgo(9),
    name: 'Bremer',
    email: 'bremer@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.ANCHOR,
    shirt_number: 14,
    initial_ovr: 81,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 76, shooting: 40, passing: 60, dribbling: 60, defending: 84, physical: 85 }
  },
  {
    id: generateId(),
    created_at: daysAgo(1),
    name: 'Lucas Beraldo',
    email: 'beraldo@example.com',
    position: PlayerPosition.DEFENSOR,
    playStyle: PlayStyle.SUPPORT, // Defensor com boa saída
    shirt_number: 35,
    initial_ovr: 74,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 72, shooting: 45, passing: 78, dribbling: 70, defending: 76, physical: 70 }
  },

  // --- MEIO-CAMPO (10) ---
  {
    id: generateId(),
    created_at: daysAgo(30),
    name: 'Lucas Paquetá',
    email: 'paqueta@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.DRIBBLER,
    shirt_number: 10,
    initial_ovr: 85,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 78, shooting: 75, passing: 86, dribbling: 88, defending: 65, physical: 76 }
  },
  {
    id: generateId(),
    created_at: daysAgo(14),
    name: 'Bruno Guimarães',
    email: 'bruno@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.PIVOT,
    shirt_number: 39,
    initial_ovr: 84,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 72, shooting: 70, passing: 87, dribbling: 82, defending: 78, physical: 80 }
  },
  {
    id: generateId(),
    created_at: daysAgo(22),
    name: 'Casemiro',
    email: 'case@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.ANCHOR, // Pode atuar como volante fixo
    shirt_number: 18,
    initial_ovr: 86,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: true,
    attributes: { pace: 60, shooting: 72, passing: 80, dribbling: 70, defending: 88, physical: 90 }
  },
  {
    id: generateId(),
    created_at: daysAgo(4),
    name: 'João Gomes',
    email: 'joao.gomes@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.PIVOT,
    shirt_number: 8,
    initial_ovr: 79,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 76, shooting: 60, passing: 78, dribbling: 75, defending: 82, physical: 80 }
  },
  {
    id: generateId(),
    created_at: daysAgo(11),
    name: 'Douglas Luiz',
    email: 'douglas@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.SUPPORT,
    shirt_number: 25,
    initial_ovr: 80,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 70, shooting: 74, passing: 83, dribbling: 78, defending: 76, physical: 75 }
  },
  {
    id: generateId(),
    created_at: daysAgo(6),
    name: 'Raphael Veiga',
    email: 'veiga@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.FINISHER, // Meia artilheiro
    shirt_number: 20,
    initial_ovr: 81,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 75, shooting: 82, passing: 82, dribbling: 78, defending: 50, physical: 68 }
  },
  {
    id: generateId(),
    created_at: daysAgo(28),
    name: 'Arrascaeta',
    email: 'arrasca@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.DRIBBLER,
    shirt_number: 14,
    initial_ovr: 83,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 72, shooting: 78, passing: 89, dribbling: 88, defending: 45, physical: 65 }
  },
  {
    id: generateId(),
    created_at: daysAgo(7),
    name: 'Gerson',
    email: 'gerson@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.ALL_ROUNDER,
    shirt_number: 8,
    initial_ovr: 82,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 74, shooting: 70, passing: 82, dribbling: 84, defending: 72, physical: 78 }
  },
  {
    id: generateId(),
    created_at: daysAgo(1),
    name: 'Andreas Pereira',
    email: 'andreas@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.SUPPORT,
    shirt_number: 18,
    initial_ovr: 77,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 75, shooting: 72, passing: 80, dribbling: 78, defending: 60, physical: 70 }
  },
  {
    id: generateId(),
    created_at: daysAgo(35),
    name: 'Samuel Lino',
    email: 'lino@example.com',
    position: PlayerPosition.MEIO_CAMPO,
    playStyle: PlayStyle.PACER,
    shirt_number: 12,
    initial_ovr: 78,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 88, shooting: 70, passing: 74, dribbling: 82, defending: 65, physical: 72 }
  },

  // --- ATACANTES (6) ---
  {
    id: generateId(),
    created_at: daysAgo(16),
    name: 'Vini Jr',
    email: 'vini@example.com',
    position: PlayerPosition.ATACANTE,
    playStyle: PlayStyle.PACER,
    shirt_number: 7,
    initial_ovr: 92,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 95, shooting: 85, passing: 80, dribbling: 94, defending: 40, physical: 72 }
  },
  {
    id: generateId(),
    created_at: daysAgo(13),
    name: 'Rodrygo Goes',
    email: 'rodrygo@example.com',
    position: PlayerPosition.ATACANTE,
    playStyle: PlayStyle.DRIBBLER,
    shirt_number: 11,
    initial_ovr: 87,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 88, shooting: 86, passing: 82, dribbling: 89, defending: 45, physical: 68 }
  },
  {
    id: generateId(),
    created_at: daysAgo(19),
    name: 'Raphinha',
    email: 'raphinha@example.com',
    position: PlayerPosition.ATACANTE,
    playStyle: PlayStyle.PACER,
    shirt_number: 21,
    initial_ovr: 83,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 89, shooting: 80, passing: 78, dribbling: 85, defending: 55, physical: 74 }
  },
  {
    id: generateId(),
    created_at: daysAgo(21),
    name: 'Pedro Guilherme',
    email: 'pedro@example.com',
    position: PlayerPosition.ATACANTE,
    playStyle: PlayStyle.POACHER,
    shirt_number: 9,
    initial_ovr: 81,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 68, shooting: 88, passing: 70, dribbling: 75, defending: 40, physical: 82 }
  },
  {
    id: generateId(),
    created_at: daysAgo(24),
    name: 'Gabriel Barbosa',
    email: 'gabigol@example.com',
    position: PlayerPosition.ATACANTE,
    playStyle: PlayStyle.FINISHER,
    shirt_number: 10,
    initial_ovr: 78,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 78, shooting: 84, passing: 70, dribbling: 76, defending: 42, physical: 74 }
  },
  {
    id: generateId(),
    created_at: daysAgo(17),
    name: 'Gabriel Martinelli',
    email: 'martinelli@example.com',
    position: PlayerPosition.ATACANTE,
    playStyle: PlayStyle.PACER,
    shirt_number: 11,
    initial_ovr: 84,
    monthly_delta: 0,
    ovr_history: [],
    is_admin: false,
    attributes: { pace: 89, shooting: 82, passing: 76, dribbling: 86, defending: 58, physical: 76 }
  }
];

export const playerService = {
  getAll: async (): Promise<Player[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const stored = localStorage.getItem(STORAGE_KEY);
    // If no data in local storage, or if it's the old data (length < 10), replace with new mock data
    if (!stored || JSON.parse(stored).length < 10) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMockData));
      return initialMockData;
    }
    return JSON.parse(stored);
  },

  create: async (data: PlayerFormData): Promise<Player> => {
    await new Promise(resolve => setTimeout(resolve, 800));

    const players = await playerService.getAll();
    
    // Separate flat form data into relational structure
    const newPlayer: Player = {
      id: generateId(),
      created_at: new Date().toISOString(),
      name: data.name,
      email: data.email,
      position: data.position,
      playStyle: data.playStyle,
      shirt_number: data.shirt_number,
      initial_ovr: data.initial_ovr,
      photo_url: data.photo_url,
      is_admin: data.is_admin,
      monthly_delta: 0,
      ovr_history: [],
      attributes: {
        pace: data.pace,
        shooting: data.shooting,
        passing: data.passing,
        dribbling: data.dribbling,
        defending: data.defending,
        physical: data.physical
      }
    };

    players.push(newPlayer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    return newPlayer;
  },

  update: async (id: string, data: PlayerFormData): Promise<Player> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const players = await playerService.getAll();
    const index = players.findIndex(p => p.id === id);
    
    if (index === -1) throw new Error('Player not found');

    const updatedPlayer: Player = {
      ...players[index],
      name: data.name,
      email: data.email,
      position: data.position,
      playStyle: data.playStyle,
      shirt_number: data.shirt_number,
      initial_ovr: data.initial_ovr,
      photo_url: data.photo_url,
      is_admin: data.is_admin,
      attributes: {
        pace: data.pace,
        shooting: data.shooting,
        passing: data.passing,
        dribbling: data.dribbling,
        defending: data.defending,
        physical: data.physical
      }
    };

    players[index] = updatedPlayer;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    return updatedPlayer;
  },

  updatePlayerDeltas: async (deltaUpdates: Record<string, number>) => {
    const players = await playerService.getAll();
    let updatedCount = 0;

    players.forEach(p => {
      if (deltaUpdates[p.id] !== undefined) {
        p.monthly_delta = (p.monthly_delta || 0) + deltaUpdates[p.id];
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    }
  },

  processMonthlyUpdate: async (): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const players = await playerService.getAll();
    const now = new Date().toISOString();
    let updatedCount = 0;

    players.forEach(p => {
      // 1. Get current delta
      const delta = p.monthly_delta || 0;
      
      // 2. Truncate to integer (drop decimals)
      const change = Math.trunc(delta);
      
      if (change !== 0) {
         // 3. Apply Limits (+/- 4)
         const cappedChange = Math.max(-4, Math.min(4, change));
         
         // 4. Update OVR (with 99 CAP)
         // OVR = Min(99, Current + Change)
         p.initial_ovr = Math.min(99, p.initial_ovr + cappedChange);
         
         // 5. Log History
         if (!p.ovr_history) p.ovr_history = [];
         p.ovr_history.push({
           date: now,
           ovr: p.initial_ovr
         });
         
         updatedCount++;
      }
      
      // 6. Reset Delta for new month
      p.monthly_delta = 0;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    return `Atualização mensal concluída! ${updatedCount} jogadores tiveram seu OVR alterado.`;
  }
};