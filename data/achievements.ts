import { Match, Player, MonthlyChampion } from '../types';
import { Trophy, Flame, Medal, Shield, Calendar, Star, Zap, Crown, Target, Activity } from 'lucide-react';
import { matchService } from '../services/matchService';

export interface Achievement {
  id: string;
  category: 'Gols' | 'Assistências' | 'Defesa' | 'Vitórias' | 'Fidelidade' | 'Especiais'; // <--- Nova Categoria
  title: string;
  description: string;
  icon: any;
  imageUrl?: string;
  level: 'Bronze' | 'Prata' | 'Esmeralda' | 'Elite';
  condition: (stats: PlayerStats) => boolean;
  progress: (stats: PlayerStats) => number;
  targetValue: number;
}

export interface PlayerStats {
  totalMatches: number;
  totalWins: number;
  totalGoals: number;
  totalAssists: number;
  totalCleanSheets: number;
  hatTricks: number;
  assistTricks: number;
  cleanTricks: number;
  totalTitles: number; // <--- NOVO
  monthlyTitles_MVP: number;
  monthlyTitles_Goals: number;
  monthlyTitles_Assists: number;
  monthlyTitles_Defense: number;
}

export const calculatePlayerStats = (playerId: string, matches: Match[], hallOfFame: MonthlyChampion[]): PlayerStats => {
  let stats: PlayerStats = {
    totalMatches: 0, totalWins: 0, totalGoals: 0, totalAssists: 0, totalCleanSheets: 0,
    hatTricks: 0, assistTricks: 0, cleanTricks: 0,
    totalTitles: 0, // <--- NOVO
    monthlyTitles_MVP: 0, monthlyTitles_Goals: 0, monthlyTitles_Assists: 0, monthlyTitles_Defense: 0
  };

  let currentCleanSheetStreak = 0;
  
  // Ordena partidas
  const finishedMatches = matches.filter(m => m.status === 'FINISHED').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  finishedMatches.forEach(match => {
    // Verifica se jogou
    const playerTeam = match.teams.find(t => t.players.some(p => p.id === playerId));
    if (!playerTeam) return;

    // --- CÁLCULO DE TÍTULO DO EVENTO ---
    // Usa o serviço para ver quem ficou em 1º
    const standings = matchService.calculateStandings(match);
    if (standings.length > 0 && standings[0].teamId === playerTeam.id) {
        stats.totalTitles++;
    }

    // Processar Jogos
    const games = match.games.filter(g => g.status === 'FINISHED');
    let cleanSheetInEvent = true; // Assume true e falha se tomar gol

    games.forEach(game => {
      // É jogo do meu time?
      if (game.homeTeamId !== playerTeam.id && game.awayTeamId !== playerTeam.id) return;

      stats.totalMatches++;

      const isHome = game.homeTeamId === playerTeam.id;
      const myScore = isHome ? game.homeScore : game.awayScore;
      const oppScore = isHome ? game.awayScore : game.homeScore;
      
      // Vitória
      let isWin = myScore > oppScore;
      if (myScore === oppScore && game.penaltyShootout) {
         const p = game.penaltyShootout;
         if ((isHome ? p.homeScore : p.awayScore) > (isHome ? p.awayScore : p.homeScore)) isWin = true;
      }
      if (isWin) stats.totalWins++;

      // Clean Sheet (Por jogo para streak)
      if (oppScore === 0) {
        // stats.totalCleanSheets++; // <-- MUDANÇA: Clean sheet conta por jogo ou por evento? 
        // Normalmente CS é por jogo. Vamos manter por jogo para volume.
        stats.totalCleanSheets++;
        currentCleanSheetStreak++;
        if (currentCleanSheetStreak >= 3) {
            stats.cleanTricks++;
            currentCleanSheetStreak = 0;
        }
      } else {
        currentCleanSheetStreak = 0;
        cleanSheetInEvent = false;
      }

      // Stats Individuais
      const goalsInGame = match.goals.filter(g => g.gameId === game.id && g.scorerId === playerId).length;
      const assistsInGame = match.goals.filter(g => g.gameId === game.id && g.assistId === playerId).length;

      stats.totalGoals += goalsInGame;
      stats.totalAssists += assistsInGame;

      if (goalsInGame >= 3) stats.hatTricks++;
      if (assistsInGame >= 3) stats.assistTricks++;
    });
  });

  // Hall da Fama
  hallOfFame.forEach(item => {
      if (item.player_id === playerId) {
          if (item.category === 'wins') stats.monthlyTitles_MVP++;
          if (item.category === 'goals') stats.monthlyTitles_Goals++;
          if (item.category === 'assists') stats.monthlyTitles_Assists++;
          if (item.category === 'clean_sheets') stats.monthlyTitles_Defense++;
      }
  });

  return stats;
};


export const ACHIEVEMENTS_LIST: Achievement[] = [
  // EXEMPLO DE USO COM IMAGEM PERSONALIZADA:
  /*
  {
    id: 'goal_100', category: 'Gols', title: 'Lenda da Área', description: 'O centésimo gol da carreira!',
    icon: Crown, // Fallback
    imageUrl: '/badges/lenda-ouro.png', // <--- SUA IMAGEM AQUI (PNG Transparente fica top)
    level: 'Elite', targetValue: 100,
    condition: (s) => s.totalGoals >= 100, progress: (s) => Math.min(100, (s.totalGoals / 100) * 100)
  },
  */
  
  // --- Mantenha a lista atual abaixo, você pode ir adicionando imageUrl nelas aos poucos ---
  // 1. FUNDADOR (Honra)
  {
    id: 'special_founder', 
    category: 'Especiais', 
    title: 'Sócio Fundador', 
    description: 'Estava lá quando tudo era mato. Membro original.',
    icon: Crown, 
    level: 'Elite', 
    targetValue: 1,
    condition: () => false, // Só manual!
    progress: () => 0
  },
  {
    id: 'escolinha_veganinho', 
    category: 'Especiais', 
    title: 'Escolinha Veganinho', 
    description: '5 Gols de fora da área com a trivela do Vegano',
    icon: Crown,
    imageUrl: '/badges/escolinha_veganinho.webp', 
    level: 'Elite', 
    targetValue: 1,
    condition: () => false, // Só manual!
    progress: () => 0
  },
    
  // -------GOLS-------
  {
    id: 'goal_1', category: 'Gols', title: 'O Primeiro Grito', description: 'Marcar o primeiro gol.',
    icon: Flame, level: 'Bronze', targetValue: 1,
    condition: (s) => s.totalGoals >= 1, progress: (s) => Math.min(100, (s.totalGoals / 1) * 100)
  },
  {
    id: 'goal_10', category: 'Gols', title: 'Faro de Gol', description: 'Marcar 10 gols no total.',
    icon: Flame, level: 'Prata', targetValue: 10,
    condition: (s) => s.totalGoals >= 10, progress: (s) => Math.min(100, (s.totalGoals / 10) * 100)
  },
  {
    id: 'goal_50', category: 'Gols', title: 'Matador Nato', description: 'Alcançar a marca de 50 gols.',
    icon: Target, level: 'Esmeralda', targetValue: 50,
    condition: (s) => s.totalGoals >= 50, progress: (s) => Math.min(100, (s.totalGoals / 50) * 100)
  },
  {
    id: 'goal_100', category: 'Gols', title: 'Lenda da Área', description: 'O centésimo gol da carreira!',
    icon: Crown, level: 'Elite', targetValue: 100,
    condition: (s) => s.totalGoals >= 100, progress: (s) => Math.min(100, (s.totalGoals / 100) * 100)
  },
  {
    id: 'hat_1', category: 'Gols', title: 'Dono da Bola', description: 'Fazer um Hat-Trick (3 gols num jogo).',
    icon: Activity, level: 'Prata', targetValue: 1,
    condition: (s) => s.hatTricks >= 1, progress: (s) => Math.min(100, (s.hatTricks / 1) * 100)
  },
  {
    id: 'hat_10', category: 'Gols', title: 'Pesadelo da Zaga', description: '10 Hat-Tricks na carreira.',
    icon: Activity, level: 'Esmeralda', targetValue: 10,
    condition: (s) => s.hatTricks >= 10, progress: (s) => Math.min(100, (s.hatTricks / 10) * 100)
  },
  {
    id: 'hat_20', category: 'Gols', title: 'Máquina de Gols', description: '20 Hat-Tricks. Imparável.',
    icon: Activity, level: 'Elite', targetValue: 20,
    condition: (s) => s.hatTricks >= 20, progress: (s) => Math.min(100, (s.hatTricks / 20) * 100)
  },
  
  // -- TÍTULOS MENSAIS (GOLS) --
  {
    id: 'title_goals_1', category: 'Gols', title: 'Chuteira de Ouro', description: 'Vencer o Ranking de Artilharia 1 vez.',
    icon: Trophy, level: 'Prata', targetValue: 1,
    condition: (s) => s.monthlyTitles_Goals >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_Goals / 1) * 100)
  },
  {
    id: 'title_goals_5', category: 'Gols', title: 'Rei da Grande Área', description: 'Artilheiro do mês 5 vezes.',
    icon: Trophy, level: 'Esmeralda', targetValue: 5,
    condition: (s) => s.monthlyTitles_Goals >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_Goals / 5) * 100)
  },
  {
    id: 'title_goals_10', category: 'Gols', title: 'Dinastia do Gol', description: '10 títulos de artilharia mensal.',
    icon: Crown, level: 'Elite', targetValue: 10,
    condition: (s) => s.monthlyTitles_Goals >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_Goals / 10) * 100)
  },

  // --- ASSISTÊNCIAS ---
  {
    id: 'assist_1', category: 'Assistências', title: 'Toca pro Pai', description: 'Dar a primeira assistência.',
    icon: Zap, level: 'Bronze', targetValue: 1,
    condition: (s) => s.totalAssists >= 1, progress: (s) => Math.min(100, (s.totalAssists / 1) * 100)
  },
  {
    id: 'assist_10', category: 'Assistências', title: 'Garçom', description: 'Servir os companheiros 10 vezes.',
    icon: Medal, level: 'Prata', targetValue: 10,
    condition: (s) => s.totalAssists >= 10, progress: (s) => Math.min(100, (s.totalAssists / 10) * 100)
  },
  {
    id: 'assist_50', category: 'Assistências', title: 'Maestro', description: '50 assistências acumuladas.',
    icon: Star, level: 'Esmeralda', targetValue: 50,
    condition: (s) => s.totalAssists >= 50, progress: (s) => Math.min(100, (s.totalAssists / 50) * 100)
  },
  {
    id: 'assist_100', category: 'Assistências', title: 'O Visionário', description: '100 assistências na carreira.',
    icon: Star, level: 'Elite', targetValue: 100,
    condition: (s) => s.totalAssists >= 100, progress: (s) => Math.min(100, (s.totalAssists / 100) * 100)
  },
  {
    id: 'assist_trick_1', category: 'Assistências', title: 'Bandeja de Prata', description: '3 assistências em um único jogo.',
    icon: Zap, level: 'Prata', targetValue: 1,
    condition: (s) => s.assistTricks >= 1, progress: (s) => Math.min(100, (s.assistTricks / 1) * 100)
  },
  
  // -- TÍTULOS MENSAIS (ASSISTÊNCIAS) --
  {
    id: 'title_assist_1', category: 'Assistências', title: 'Camisa 10', description: 'Vencer o Ranking de Assistências 1 vez.',
    icon: Medal, level: 'Prata', targetValue: 1,
    condition: (s) => s.monthlyTitles_Assists >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_Assists / 1) * 100)
  },
  {
    id: 'title_assist_5', category: 'Assistências', title: 'Rei das Assistências', description: 'Líder de assistências por 5 meses.',
    icon: Medal, level: 'Esmeralda', targetValue: 5,
    condition: (s) => s.monthlyTitles_Assists >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_Assists / 5) * 100)
  },
  {
    id: 'title_assist_10', category: 'Assistências', title: 'O Ilusionista', description: '10 títulos de Garçom do Mês.',
    icon: Crown, level: 'Elite', targetValue: 10,
    condition: (s) => s.monthlyTitles_Assists >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_Assists / 10) * 100)
  },

  // --- DEFESA ---
  {
    id: 'cs_1', category: 'Defesa', title: 'Cadeado', description: 'Sair de campo sem sofrer gols (Clean Sheet).',
    icon: Shield, level: 'Bronze', targetValue: 1,
    condition: (s) => s.totalCleanSheets >= 1, progress: (s) => Math.min(100, (s.totalCleanSheets / 1) * 100)
  },
  {
    id: 'cs_10', category: 'Defesa', title: 'Segurança Máxima', description: '10 jogos sem ser vazado.',
    icon: Shield, level: 'Prata', targetValue: 10,
    condition: (s) => s.totalCleanSheets >= 10, progress: (s) => Math.min(100, (s.totalCleanSheets / 10) * 100)
  },
  {
    id: 'cs_streak', category: 'Defesa', title: 'Noite Tranquila', description: '3 jogos seguidos sem tomar gol.',
    icon: Shield, level: 'Prata', targetValue: 1,
    condition: (s) => s.cleanTricks >= 1, progress: (s) => Math.min(100, (s.cleanTricks / 1) * 100)
  },
  {
    id: 'cs_50', category: 'Defesa', title: 'Muralha', description: '50 Clean Sheets na carreira.',
    icon: Shield, level: 'Esmeralda', targetValue: 50,
    condition: (s) => s.totalCleanSheets >= 50, progress: (s) => Math.min(100, (s.totalCleanSheets / 50) * 100)
  },
  {
    id: 'cs_100', category: 'Defesa', title: 'Intransponível', description: '100 jogos sem sofrer gols.',
    icon: Shield, level: 'Elite', targetValue: 100,
    condition: (s) => s.totalCleanSheets >= 100, progress: (s) => Math.min(100, (s.totalCleanSheets / 100) * 100)
  },
  
  // -- TÍTULOS MENSAIS (DEFESA) --
  {
    id: 'title_def_1', category: 'Defesa', title: 'Ministro da Defesa', description: 'Vencer o Ranking de Defesa (Clean Sheets) 1 vez.',
    icon: Shield, level: 'Prata', targetValue: 1,
    condition: (s) => s.monthlyTitles_Defense >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_Defense / 1) * 100)
  },
  {
    id: 'title_def_5', category: 'Defesa', title: 'Luva de Ouro', description: 'Melhor defesa por 5 meses.',
    icon: Shield, level: 'Esmeralda', targetValue: 5,
    condition: (s) => s.monthlyTitles_Defense >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_Defense / 5) * 100)
  },
  {
    id: 'title_def_10', category: 'Defesa', title: 'A Grande Barreira', description: '10 títulos de Defesa do Mês.',
    icon: Crown, level: 'Elite', targetValue: 10,
    condition: (s) => s.monthlyTitles_Defense >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_Defense / 10) * 100)
  },

  // --- VITÓRIAS & TÍTULOS ---
  {
    id: 'win_1', category: 'Vitórias', title: 'Pé Quente', description: 'Vencer a primeira partida.',
    icon: Trophy, level: 'Bronze', targetValue: 1,
    condition: (s) => s.totalWins >= 1, progress: (s) => Math.min(100, (s.totalWins / 1) * 100)
  },
  {
    id: 'win_10', category: 'Vitórias', title: 'Vencedor', description: '10 vitórias na conta.',
    icon: Trophy, level: 'Prata', targetValue: 10,
    condition: (s) => s.totalWins >= 10, progress: (s) => Math.min(100, (s.totalWins / 10) * 100)
  },
  {
    id: 'mvp_1', category: 'Vitórias', title: 'Jogador do Mês', description: 'Ganhar o prêmio de MVP mensal (Mais Vitórias).',
    icon: Crown, level: 'Prata', targetValue: 1,
    condition: (s) => s.monthlyTitles_MVP >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_MVP / 1) * 100)
  },
  {
    id: 'mvp_5', category: 'Vitórias', title: 'Craque da Galera', description: 'Ser MVP do mês 5 vezes.',
    icon: Crown, level: 'Esmeralda', targetValue: 5,
    condition: (s) => s.monthlyTitles_MVP >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_MVP / 5) * 100)
  },
  {
    id: 'win_50', category: 'Vitórias', title: 'Invencível', description: '50 vitórias conquistadas.',
    icon: Trophy, level: 'Esmeralda', targetValue: 50,
    condition: (s) => s.totalWins >= 50, progress: (s) => Math.min(100, (s.totalWins / 50) * 100)
  },
  {
    id: 'win_100', category: 'Vitórias', title: 'O Conquistador', description: '100 vitórias. Histórico.',
    icon: Trophy, level: 'Elite', targetValue: 100,
    condition: (s) => s.totalWins >= 100, progress: (s) => Math.min(100, (s.totalWins / 100) * 100)
  },
  {
    id: 'mvp_10', category: 'Vitórias', title: 'Hall da Fama', description: 'MVP (Mais Vitórias) do mês 10 vezes.',
    icon: Crown, level: 'Elite', targetValue: 10,
    condition: (s) => s.monthlyTitles_MVP >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_MVP / 10) * 100)
  },

  // --- FIDELIDADE ---
  {
    id: 'games_1', category: 'Fidelidade', title: 'A Estreia', description: 'Completar o primeiro jogo.',
    icon: Calendar, level: 'Bronze', targetValue: 1,
    condition: (s) => s.totalMatches >= 1, progress: (s) => Math.min(100, (s.totalMatches / 1) * 100)
  },
  {
    id: 'games_50', category: 'Fidelidade', title: 'De Carteirinha', description: '50 jogos disputados.',
    icon: Calendar, level: 'Esmeralda', targetValue: 50,
    condition: (s) => s.totalMatches >= 50, progress: (s) => Math.min(100, (s.totalMatches / 50) * 100)
  },
  {
    id: 'games_10', category: 'Fidelidade', title: 'Confirmado', description: '10 eventos disputados.',
    icon: Calendar, level: 'Prata', targetValue: 10,
    condition: (s) => s.totalMatches >= 10, progress: (s) => Math.min(100, (s.totalMatches / 10) * 100)
  },
  {
    id: 'games_100', category: 'Fidelidade', title: 'Patrimônio do Clube', description: '100 eventos! Você faz parte da história.',
    icon: Calendar, level: 'Elite', targetValue: 100,
    condition: (s) => s.totalMatches >= 100, progress: (s) => Math.min(100, (s.totalMatches / 100) * 100)
  },
  // --- NOVOS: TÍTULOS DE EVENTO (CAMPEONATOS) ---
  {
    id: 'title_event_5', category: 'Vitórias', title: 'Multicampeão', description: 'Levantou a taça do evento 5 vezes.',
    icon: Trophy, level: 'Prata', targetValue: 5,
    condition: (s) => s.totalTitles >= 5, progress: (s) => Math.min(100, (s.totalTitles / 5) * 100)
  },
  {
    id: 'title_event_10', category: 'Vitórias', title: 'Colecionador de Troféus', description: '10 títulos de evento conquistados.',
    icon: Trophy, level: 'Esmeralda', targetValue: 10,
    condition: (s) => s.totalTitles >= 10, progress: (s) => Math.min(100, (s.totalTitles / 10) * 100)
  },
  {
    id: 'title_event_20', category: 'Vitórias', title: 'O Dono da Taça', description: '20 títulos. O campeonato tem seu nome.',
    icon: Crown, level: 'Elite', targetValue: 20,
    condition: (s) => s.totalTitles >= 20, progress: (s) => Math.min(100, (s.totalTitles / 20) * 100)
  },

  // --- NÍVEIS ELITE DE TRICKS ---
  
  // Assist-Tricks (3 assists num jogo)
  {
    id: 'assist_trick_10', category: 'Assistências', title: 'Mãos de Tesoura', description: '10 jogos com 3+ assistências.',
    icon: Zap, level: 'Esmeralda', targetValue: 10,
    condition: (s) => s.assistTricks >= 10, progress: (s) => Math.min(100, (s.assistTricks / 10) * 100)
  },
  {
    id: 'assist_trick_20', category: 'Assistências', title: 'Buffet Livre', description: '20 jogos servindo todo mundo.',
    icon: Zap, level: 'Elite', targetValue: 20,
    condition: (s) => s.assistTricks >= 20, progress: (s) => Math.min(100, (s.assistTricks / 20) * 100)
  },

  // Clean-Tricks (3 jogos seguidos sem tomar gol)
  {
    id: 'clean_trick_10', category: 'Defesa', title: 'Zaga de Ferro', description: '10 sequências de invencibilidade defensiva.',
    icon: Shield, level: 'Esmeralda', targetValue: 10,
    condition: (s) => s.cleanTricks >= 10, progress: (s) => Math.min(100, (s.cleanTricks / 10) * 100)
  },
  {
    id: 'clean_trick_20', category: 'Defesa', title: 'O Imbatível', description: '20 sequências perfeitas na defesa.',
    icon: Shield, level: 'Elite', targetValue: 20,
    condition: (s) => s.cleanTricks >= 20, progress: (s) => Math.min(100, (s.cleanTricks / 20) * 100)
  },
];