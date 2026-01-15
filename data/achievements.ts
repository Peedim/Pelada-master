import { Match, MonthlyChampion } from '../types';
import { Trophy, Flame, Medal, Shield, Calendar, Star, Zap, Crown, Target, Activity } from 'lucide-react';
import { matchService } from '../services/matchService';

export interface Achievement {
  id: string;
  category: 'Gols' | 'Assistências' | 'Defesa' | 'Vitórias' | 'Fidelidade' | 'Especiais';
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
  totalEvents: number; // <--- NOVO CAMPO
  totalWins: number;
  totalGoals: number;
  totalAssists: number;
  totalCleanSheets: number;
  hatTricks: number;
  assistTricks: number;
  cleanTricks: number;
  totalTitles: number; 
  monthlyTitles_MVP: number;
  monthlyTitles_Goals: number;
  monthlyTitles_Assists: number;
  monthlyTitles_Defense: number;
}

export const calculatePlayerStats = (playerId: string, matches: Match[], hallOfFame: MonthlyChampion[]): PlayerStats => {
  let stats: PlayerStats = {
    totalMatches: 0, totalEvents: 0, totalWins: 0, totalGoals: 0, totalAssists: 0, totalCleanSheets: 0,
    hatTricks: 0, assistTricks: 0, cleanTricks: 0,
    totalTitles: 0, 
    monthlyTitles_MVP: 0, monthlyTitles_Goals: 0, monthlyTitles_Assists: 0, monthlyTitles_Defense: 0
  };

  let currentCleanSheetStreak = 0;
  
  // Ordena partidas
  const finishedMatches = matches.filter(m => m.status === 'FINISHED').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  finishedMatches.forEach(match => {
    // Verifica se jogou
    const playerTeam = match.teams.find(t => t.players.some(p => p.id === playerId));
    if (!playerTeam) return;

    // --- NOVA LÓGICA: CONTA EVENTO (BABA) ---
    stats.totalEvents++; 
    // ----------------------------------------

    // --- CÁLCULO DE TÍTULO DO EVENTO (CORRIGIDO) ---
    const standings = matchService.getFinalRankings(match);
    
    if (standings.length > 0 && standings[0].teamId === playerTeam.id) {
        stats.totalTitles++;
    }

    // Processar Jogos
    const games = match.games.filter(g => g.status === 'FINISHED');

    games.forEach(game => {
      if (game.homeTeamId !== playerTeam.id && game.awayTeamId !== playerTeam.id) return;

      stats.totalMatches++;

      const isHome = game.homeTeamId === playerTeam.id;
      const myScore = isHome ? game.homeScore : game.awayScore;
      const oppScore = isHome ? game.awayScore : game.homeScore;
      
      let isWin = myScore > oppScore;
      if (myScore === oppScore && game.penaltyShootout) {
         const p = game.penaltyShootout;
         if ((isHome ? p.homeScore : p.awayScore) > (isHome ? p.awayScore : p.homeScore)) isWin = true;
      }
      if (isWin) stats.totalWins++;

      if (oppScore === 0) {
        stats.totalCleanSheets++;
        currentCleanSheetStreak++;
        if (currentCleanSheetStreak >= 3) {
            stats.cleanTricks++;
            currentCleanSheetStreak = 0;
        }
      } else {
        currentCleanSheetStreak = 0;
      }

      const goalsInGame = match.goals.filter(g => g.gameId === game.id && g.scorerId === playerId).length;
      const assistsInGame = match.goals.filter(g => g.gameId === game.id && g.assistId === playerId).length;

      stats.totalGoals += goalsInGame;
      stats.totalAssists += assistsInGame;

      if (goalsInGame >= 3) stats.hatTricks++;
      if (assistsInGame >= 3) stats.assistTricks++;
    });
  });

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
  // -------Especiais-------
  {
    id: 'veganinho', 
    category: 'Especiais', 
    title: 'Escolinha do Veganinho', 
    description: 'Faça um gol de fora da área com a trivela do Vegano',
    icon: Crown,
    imageUrl: '/badges/esp/veganinho.png', 
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
  {
    id: 'mago', 
    category: 'Especiais', 
    title: 'Só eu e Lamine Yamal', 
    description: 'Faça um gol de chapa no alto e fora da área, igual ao Mago.',
    icon: Crown,
    imageUrl: '/badges/esp/mago.png', 
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
  {
    id: 'patrick', 
    category: 'Especiais', 
    title: 'Rei dos Cupons', 
    description: 'Faça uma compra usando um cupom de desconto do Patrick.',
    icon: Crown,
    imageUrl: '/badges/esp/patrick.png', 
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
  {
    id: 'napoli', 
    category: 'Especiais', 
    title: 'Napoli', 
    description: 'Jogue todas as partidas do torneio. Não vença nenhuma.',
    icon: Crown,
    imageUrl: '/badges/esp/napoli.png', 
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
  {
    id: 'saulo', 
    category: 'Especiais', 
    title: 'Gol de Saulo', 
    description: 'Para o artilheiro... do time adversário (Gol contra)',
    icon: Crown,
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
  {
    id: 'rogerioceni', 
    category: 'Especiais', 
    title: 'Rogério Ceni', 
    description: 'Goleiro fazendo gol de falta. Respeita a história! (Exclusiva Goleiros)',
    icon: Crown,
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
  {
    id: 'higuita', 
    category: 'Especiais', 
    title: 'Higuita', 
    description: 'Defesa escorpião. Só para goleiros malucos (Exclusiva Goleiros)',
    icon: Crown,
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
   {
    id: 'arcadenoe', 
    category: 'Especiais', 
    title: 'Arcade Noé', 
    description: 'Participou de 100% dos gols do time e ainda foi campeão?. Basicamente carregou os animais nas costas!',
    icon: Crown,
    level: 'Esmeralda', 
    targetValue: 1,
    condition: () => false, 
    progress: () => 0
  },
  
  // -------GOLS-------
  {
    id: 'goal_1', 
    category: 'Gols', 
    title: 'O Primeiro Grito', 
    description: 'Marcar o primeiro gol.',
    icon: Flame, 
    imageUrl: '/badges/gols/1gol.png', 
    level: 'Bronze', 
    targetValue: 1,
    condition: (s) => s.totalGoals >= 1, progress: (s) => Math.min(100, (s.totalGoals / 1) * 100)
  },
  {
    id: 'goal_10', 
    category: 'Gols', 
    title: 'Faro de Gol', 
    description: 'Marcar 10 gols no total.',
    icon: Flame, 
    imageUrl: '/badges/gols/10gols.png', 
    level: 'Prata', 
    targetValue: 10,
    condition: (s) => s.totalGoals >= 10, progress: (s) => Math.min(100, (s.totalGoals / 10) * 100)
  },
  {
    id: 'goal_50', 
    category: 'Gols', 
    title: 'Matador Nato', 
    description: 'Alcançar a marca de 50 gols.',
    icon: Target, 
    imageUrl: '/badges/gols/50gols.png', 
    level: 'Esmeralda', 
    targetValue: 50,
    condition: (s) => s.totalGoals >= 50, progress: (s) => Math.min(100, (s.totalGoals / 50) * 100)
  },
  {
    id: 'goal_100', 
    category: 'Gols', 
    title: 'Lenda da Área', 
    description: 'O centésimo gol da carreira!',
    icon: Crown, 
    imageUrl: '/badges/gols/100gols.png', 
    level: 'Elite', 
    targetValue: 100,
    condition: (s) => s.totalGoals >= 100, progress: (s) => Math.min(100, (s.totalGoals / 100) * 100)
  },
  {
    id: 'hat_1', 
    category: 'Gols', 
    title: 'Dono da Bola', 
    description: 'Seu primeiro Hat-Trick (3 gols num jogo).',
    icon: Activity, 
    imageUrl: '/badges/ht/1ht.png',
    level: 'Prata', 
    targetValue: 1,
    condition: (s) => s.hatTricks >= 1, progress: (s) => Math.min(100, (s.hatTricks / 1) * 100)
  },
  {
    id: 'hat_10', 
    category: 'Gols', 
    title: 'Pesadelo da Zaga', 
    description: '10 Hat-Tricks na carreira.',
    icon: Activity,
    imageUrl: '/badges/ht/10ht.png', 
    level: 'Esmeralda', 
    targetValue: 10,
    condition: (s) => s.hatTricks >= 10, progress: (s) => Math.min(100, (s.hatTricks / 10) * 100)
  },
  {
    id: 'hat_20', 
    category: 'Gols', 
    title: 'Máquina de Gols', 
    description: '20 Hat-Tricks. Imparável.',
    icon: Activity, 
    imageUrl: '/badges/ht/20ht.png', 
    level: 'Elite', 
    targetValue: 20,
    condition: (s) => s.hatTricks >= 20, progress: (s) => Math.min(100, (s.hatTricks / 20) * 100)
  },
  
  // -- TÍTULOS MENSAIS (GOLS) --
  {
    id: 'title_goals_1', 
    category: 'Gols', 
    title: 'Chuteira de Prata', 
    description: 'Vencer o Ranking de Artilharia 1 vez.',
    icon: Trophy,
    imageUrl: '/badges/art/1art.png',  
    level: 'Prata', 
    targetValue: 1,
    condition: (s) => s.monthlyTitles_Goals >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_Goals / 1) * 100)
  },
  {
    id: 'title_goals_5', 
    category: 'Gols', 
    title: 'Rei da Grande Área', 
    description: 'Artilheiro do mês 5 vezes.',
    icon: Trophy, 
    imageUrl: '/badges/art/5art.png',
    level: 'Esmeralda', 
    targetValue: 5,
    condition: (s) => s.monthlyTitles_Goals >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_Goals / 5) * 100)
  },
  {
    id: 'title_goals_10', 
    category: 'Gols', 
    title: 'Dinastia do Gol', 
    description: '10 títulos de artilharia mensal.',
    icon: Crown, 
    imageUrl: '/badges/art/10art.png',
    level: 'Elite', 
    targetValue: 10,
    condition: (s) => s.monthlyTitles_Goals >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_Goals / 10) * 100)
  },

  // --- ASSISTÊNCIAS ---
  {
    id: 'assist_1', 
    category: 'Assistências', 
    title: 'Toca pro Pai', 
    description: 'Dar a primeira assistência.',
    icon: Zap, 
    imageUrl: '/badges/assists/1assist.png', 
    level: 'Bronze', 
    targetValue: 1,
    condition: (s) => s.totalAssists >= 1, progress: (s) => Math.min(100, (s.totalAssists / 1) * 100)
  },
  {
    id: 'assist_10', 
    category: 'Assistências', 
    title: 'Garçom', 
    description: 'Servir os companheiros 10 vezes.',
    icon: Medal, 
    imageUrl: '/badges/assists/10assists.png', 
    level: 'Prata', 
    targetValue: 10,
    condition: (s) => s.totalAssists >= 10, progress: (s) => Math.min(100, (s.totalAssists / 10) * 100)
  },
  {
    id: 'assist_50', 
    category: 'Assistências', 
    title: 'Maestro', 
    description: '50 assistências acumuladas.',
    icon: Star, 
    imageUrl: '/badges/assists/50assists.png', 
    level: 'Esmeralda', 
    targetValue: 50,
    condition: (s) => s.totalAssists >= 50, progress: (s) => Math.min(100, (s.totalAssists / 50) * 100)
  },
  {
    id: 'assist_100', 
    category: 'Assistências', 
    title: 'O Visionário', 
    description: '100 assistências na carreira.',
    icon: Star, 
    imageUrl: '/badges/assists/100assists.png', 
    level: 'Elite', 
    targetValue: 100,
    condition: (s) => s.totalAssists >= 100, progress: (s) => Math.min(100, (s.totalAssists / 100) * 100)
  },
  {
    id: 'assist_trick_1', 
    category: 'Assistências', 
    title: 'Bandeja de Prata', 
    description: '3 assistências em um único jogo.',
    icon: Zap, 
    imageUrl: '/badges/asst/1asst.png',
    level: 'Prata', 
    targetValue: 1,
    condition: (s) => s.assistTricks >= 1, progress: (s) => Math.min(100, (s.assistTricks / 1) * 100)
  },
  {
    id: 'assist_trick_10', 
    category: 'Assistências', 
    title: 'Pés de Tesoura', 
    description: '10 jogos com 3+ assistências.',
    icon: Zap, 
    imageUrl: '/badges/asst/10asst.png',
    level: 'Esmeralda', 
    targetValue: 10,
    condition: (s) => s.assistTricks >= 10, progress: (s) => Math.min(100, (s.assistTricks / 10) * 100)
  },
  {
    id: 'assist_trick_20', 
    category: 'Assistências', 
    title: 'Buffet Livre', 
    description: '20 jogos servindo todo mundo.',
    icon: Zap, 
    imageUrl: '/badges/asst/20asst.png',
    level: 'Elite', 
    targetValue: 20,
    condition: (s) => s.assistTricks >= 20, progress: (s) => Math.min(100, (s.assistTricks / 20) * 100)
  },
  
  // -- TÍTULOS MENSAIS (ASSISTÊNCIAS) --
  {
    id: 'title_assist_1', 
    category: 'Assistências', 
    title: 'Camisa 10', 
    description: 'Vencer o Ranking de Assistências 1 vez.',
    icon: Medal,
    imageUrl: '/badges/gar/1gar.png', 
    level: 'Prata', 
    targetValue: 1,
    condition: (s) => s.monthlyTitles_Assists >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_Assists / 1) * 100)
  },
  {
    id: 'title_assist_5', 
    category: 'Assistências', 
    title: 'Rei das Assistências', 
    description: '5x Líder de assistências.',
    icon: Medal,
    imageUrl: '/badges/gar/5gar.png',  
    level: 'Esmeralda', 
    targetValue: 5,
    condition: (s) => s.monthlyTitles_Assists >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_Assists / 5) * 100)
  },
  {
    id: 'title_assist_10', 
    category: 'Assistências', 
    title: 'O Ilusionista', 
    description: '10 títulos de Garçom do Mês.',
    icon: Crown,
    imageUrl: '/badges/gar/10gar.png',  
    level: 'Elite', 
    targetValue: 10,
    condition: (s) => s.monthlyTitles_Assists >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_Assists / 10) * 100)
  },

  // --- DEFESA ---
  {
    id: 'cs_1', 
    category: 'Defesa', 
    title: 'Cadeado', 
    description: 'Uma partida sem sofrer gols (Clean Sheet).',
    icon: Shield, 
    imageUrl: '/badges/cs/1cs.png', 
    level: 'Bronze', 
    targetValue: 1,
    condition: (s) => s.totalCleanSheets >= 1, progress: (s) => Math.min(100, (s.totalCleanSheets / 1) * 100)
  },
  {
    id: 'cs_10', 
    category: 'Defesa', 
    title: 'Segurança Máxima', 
    description: '10 jogos sem ser vazado.',
    icon: Shield, 
    imageUrl: '/badges/cs/10cs.png', 
    level: 'Prata', 
    targetValue: 10,
    condition: (s) => s.totalCleanSheets >= 10, progress: (s) => Math.min(100, (s.totalCleanSheets / 10) * 100)
  },
  {
    id: 'cs_50',
    category: 'Defesa', 
    title: 'Muralha', 
    description: '50 Clean Sheets na carreira.',
    icon: Shield, 
    imageUrl: '/badges/cs/50cs.png', 
    level: 'Esmeralda', 
    targetValue: 50,
    condition: (s) => s.totalCleanSheets >= 50, progress: (s) => Math.min(100, (s.totalCleanSheets / 50) * 100)
  },
  {
    id: 'cs_100', 
    category: 'Defesa', 
    title: 'Intransponível', 
    description: '100 jogos sem sofrer gols.',
    icon: Shield, 
    imageUrl: '/badges/cs/100cs.png', 
    level: 'Elite', 
    targetValue: 100,
    condition: (s) => s.totalCleanSheets >= 100, progress: (s) => Math.min(100, (s.totalCleanSheets / 100) * 100)
  },
  {
    id: 'cs_streak', 
    category: 'Defesa', 
    title: 'Noite Tranquila', 
    description: '3 jogos seguidos sem tomar gol.',
    icon: Shield,
    imageUrl: '/badges/clt/1clt.png', 
    level: 'Prata', 
    targetValue: 1,
    condition: (s) => s.cleanTricks >= 1, progress: (s) => Math.min(100, (s.cleanTricks / 1) * 100)
  },
  {
    id: 'clean_trick_10', 
    category: 'Defesa', 
    title: 'Zaga de Ferro', 
    description: '10 sequências de invencibilidade defensiva.',
    icon: Shield, 
    imageUrl: '/badges/clt/10clt.png',
    level: 'Esmeralda', 
    targetValue: 10,
    condition: (s) => s.cleanTricks >= 10, progress: (s) => Math.min(100, (s.cleanTricks / 10) * 100)
  },
  {
    id: 'clean_trick_20', 
    category: 'Defesa', 
    title: 'O Imbatível', 
    description: '20 sequências perfeitas na defesa.',
    icon: Shield, 
    imageUrl: '/badges/clt/20clt.png',
    level: 'Elite', 
    targetValue: 20,
    condition: (s) => s.cleanTricks >= 20, progress: (s) => Math.min(100, (s.cleanTricks / 20) * 100)
  },
  
  // -- TÍTULOS MENSAIS (DEFESA) --
  {
    id: 'title_def_1', 
    category: 'Defesa', 
    title: 'Ministro da Defesa', 
    description: 'Vencer o Ranking de Defesa (Clean Sheets) 1 vez.',
    icon: Shield,
    imageUrl: '/badges/mrl/1mrl.png', 
    level: 'Prata', 
    targetValue: 1,
    condition: (s) => s.monthlyTitles_Defense >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_Defense / 1) * 100)
  },
  {
    id: 'title_def_5', 
    category: 'Defesa', 
    title: 'O pesadelo dos atacantes', 
    description: 'Melhor defesa por 5 meses.',
    icon: Shield,
    imageUrl: '/badges/mrl/5mrl.png',  
    level: 'Esmeralda', 
    targetValue: 5,
    condition: (s) => s.monthlyTitles_Defense >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_Defense / 5) * 100)
  },
  {
    id: 'title_def_10', 
    category: 'Defesa', 
    title: 'Entidade da Defesa', 
    description: '10 títulos de Defesa do Mês.',
    icon: Crown,
    imageUrl: '/badges/mrl/10mrl.png',  
    level: 'Elite', 
    targetValue: 10,
    condition: (s) => s.monthlyTitles_Defense >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_Defense / 10) * 100)
  },

  // --- VITÓRIAS & TÍTULOS ---
  {
    id: 'win_1', 
    category: 'Vitórias', 
    title: 'A primeira', 
    description: 'Vencer a primeira partida.',
    icon: Trophy, 
    imageUrl: '/badges/vit/1vit.png', 
    level: 'Bronze', 
    targetValue: 1,
    condition: (s) => s.totalWins >= 1, progress: (s) => Math.min(100, (s.totalWins / 1) * 100)
  },
  {
    id: 'win_10', 
    category: 'Vitórias', 
    title: 'Acostumado a ganhar...', 
    description: '10 vitórias na conta.',
    icon: Trophy, 
    imageUrl: '/badges/vit/10vit.png', 
    level: 'Prata', 
    targetValue: 10,
    condition: (s) => s.totalWins >= 10, progress: (s) => Math.min(100, (s.totalWins / 10) * 100)
  },
   {
    id: 'win_50', 
    category: 'Vitórias', 
    title: 'Perder não está no vocabulário', 
    description: '50 vitórias conquistadas.',
    icon: Trophy, 
    imageUrl: '/badges/vit/50vit.png', 
    level: 'Esmeralda', 
    targetValue: 50,
    condition: (s) => s.totalWins >= 50, progress: (s) => Math.min(100, (s.totalWins / 50) * 100)
  },
  {
    id: 'win_100', 
    category: 'Vitórias', 
    title: 'O Conquistador',
     description: '100 vitórias conquistadas.',
    icon: Trophy, 
    imageUrl: '/badges/vit/100vit.png', 
    level: 'Elite', 
    targetValue: 100,
    condition: (s) => s.totalWins >= 100, progress: (s) => Math.min(100, (s.totalWins / 100) * 100)
  },
  {
    id: 'mvp_1', 
    category: 'Vitórias', 
    title: 'Jogador do Mês', 
    description: 'Ganhar o prêmio de MVP mensal (Mais Vitórias).',
    icon: Crown, 
    level: 'Prata', 
    imageUrl: '/badges/mvp/1mvp.png', 
    targetValue: 1,
    condition: (s) => s.monthlyTitles_MVP >= 1, progress: (s) => Math.min(100, (s.monthlyTitles_MVP / 1) * 100)
  },
  {
    id: 'mvp_5', 
    category: 'Vitórias', 
    title: 'Craque da Galera', 
    description: 'Ser MVP do mês 5 vezes.',
    icon: Crown, 
    imageUrl: '/badges/mvp/5mvp.png',
    level: 'Esmeralda', 
    targetValue: 5,
    condition: (s) => s.monthlyTitles_MVP >= 5, progress: (s) => Math.min(100, (s.monthlyTitles_MVP / 5) * 100)
  },
 
  {
    id: 'mvp_10', 
    category: 'Vitórias', 
    title: 'Hall da Fama', 
    description: 'MVP do mês 10 vezes.',
    icon: Crown, 
    imageUrl: '/badges/mvp/10mvp.png',
    level: 'Elite', 
    targetValue: 10,
    condition: (s) => s.monthlyTitles_MVP >= 10, progress: (s) => Math.min(100, (s.monthlyTitles_MVP / 10) * 100)
  },

 // --- FIDELIDADE ---
  {
    id: 'games_1', 
    category: 'Fidelidade', 
    title: 'Bem-vindo ao clube!', 
    description: 'Participar do primeiro baba.',
    icon: Calendar, 
    imageUrl: '/badges/part/1part.png', 
    level: 'Bronze', 
    targetValue: 1,
    condition: (s) => s.totalEvents >= 1, progress: (s) => Math.min(100, (s.totalEvents / 1) * 100)
  },
   {
    id: 'games_10', 
    category: 'Fidelidade', 
    title: 'Eu vou ☝️', 
    description: '10 babas disputados.',
    icon: Calendar, 
    imageUrl: '/badges/part/10part.png', 
    level: 'Prata', 
    targetValue: 10,
    condition: (s) => s.totalEvents >= 10, progress: (s) => Math.min(100, (s.totalEvents / 10) * 100)
  },
  {
    id: 'games_50', 
    category: 'Fidelidade', 
    title: 'De Carteirinha', 
    description: '50 babas disputados.',
    icon: Calendar, 
    imageUrl: '/badges/part/50part.png', 
    level: 'Esmeralda', 
    targetValue: 50,
    condition: (s) => s.totalEvents >= 50, progress: (s) => Math.min(100, (s.totalEvents / 50) * 100)
  },
  {
    id: 'games_100', 
    category: 'Fidelidade', 
    title: 'Patrimônio do Clube', 
    description: '100 babas disputados.',
    icon: Calendar, 
    imageUrl: '/badges/part/100part.png', 
    level: 'Elite', 
    targetValue: 100,
    condition: (s) => s.totalEvents >= 100, progress: (s) => Math.min(100, (s.totalEvents / 100) * 100)
  },

  // --- TÍTULOS DE EVENTO (CAMPEONATOS) ---
  {
    id: 'title_event_5', 
    category: 'Vitórias', 
    title: 'Multicampeão', 
    description: 'Levantou a taça 5 vezes.',
    icon: Trophy, 
    imageUrl: '/badges/tt/5tt.png', 
    level: 'Prata', 
    targetValue: 5,
    condition: (s) => s.totalTitles >= 5, progress: (s) => Math.min(100, (s.totalTitles / 5) * 100)
  },
  {
    id: 'title_event_10', 
    category: 'Vitórias', 
    title: 'Colecionador de Troféus', 
    description: '10 títulos conquistados.',
    icon: Trophy, 
    imageUrl: '/badges/tt/10tt.png',
    level: 'Esmeralda', 
    targetValue: 10,
    condition: (s) => s.totalTitles >= 10, progress: (s) => Math.min(100, (s.totalTitles / 10) * 100)
  },
  {
    id: 'title_event_20', 
    category: 'Vitórias', 
    title: 'O Dono da Taça', 
    description: '20 títulos. O campeonato tem seu nome.',
    icon: Crown, 
    imageUrl: '/badges/tt/20tt.png',
    level: 'Elite', 
    targetValue: 20,
    condition: (s) => s.totalTitles >= 20, progress: (s) => Math.min(100, (s.totalTitles / 20) * 100)
  },
];