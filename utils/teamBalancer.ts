import { Player, Team, PlayerPosition } from '../types';

export type TournamentType = 'Quadrangular' | 'Triangular';

// Função auxiliar para embaralhar listas (Fisher-Yates Shuffle)
const shuffleArray = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

export const generateTeams = (players: Player[], type: TournamentType): Team[] => {
  const numTeams = type === 'Quadrangular' ? 4 : 3;
  
  // Definição das Cores/Nomes
  const teamNames = ['Time Branco', 'Time Preto', 'Time Vermelho', 'Time Azul'];

  // 1. Separa Linha e Goleiros
  const linePlayers = players.filter(p => p.position !== PlayerPosition.GOLEIRO);
  const goalkeepers = players.filter(p => p.position === PlayerPosition.GOLEIRO);
  
  // Inicializa times
  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team-${i}`,
    name: teamNames[i] || `Time ${String.fromCharCode(65 + i)}`, 
    players: [],
    totalOvr: 0,
    avgOvr: 0,
    styleCounts: {} 
  }));

  // Ordenação Base (Melhores primeiro para distribuição "Snake")
  const sortByOvrDesc = (a: Player, b: Player) => b.initial_ovr - a.initial_ovr;

  // 2. Criação dos Potes Táticos
  const getPlayersByPos = (pos: PlayerPosition) => 
      linePlayers.filter(p => p.position === pos).sort(sortByOvrDesc);

  const defs = getPlayersByPos(PlayerPosition.DEFENSOR);
  const mids = getPlayersByPos(PlayerPosition.MEIO_CAMPO);
  const atts = getPlayersByPos(PlayerPosition.ATACANTE);

  // 3. O Motor de Distribuição com "Ruído"
  const distributePool = (pool: Player[]) => {
      let processingPool = [...pool];
      while (processingPool.length > 0) {
          const batch = processingPool.splice(0, numTeams);
          const shuffledBatch = shuffleArray(batch); // Embaralha o lote atual (ex: os 4 melhores zagueiros)

          shuffledBatch.forEach(player => {
              let bestTeamIndex = -1;
              let bestScore = Infinity;

              teams.forEach((team, index) => {
                  let score = team.totalOvr;
                  
                  // Fator Aleatório (Ruído) para não ficar sempre igual
                  const noise = (Math.random() * 10) - 5;
                  score += noise;

                  // Penalidade por Estilo de Jogo Repetido (ex: muitos "Fominhas" juntos)
                  const currentStyle = player.playStyle || 'Unknown';
                  const styleCount = team.styleCounts[currentStyle] || 0;
                  score += (styleCount * 25);

                  // Penalidade por Posição Repetida (tenta espalhar posições se o pool for misto)
                  const samePosCount = team.players.filter(p => p.position === player.position).length;
                  score += (samePosCount * 10);

                  if (score < bestScore) {
                      bestScore = score;
                      bestTeamIndex = index;
                  }
              });
              
              const targetTeam = teams[bestTeamIndex];
              targetTeam.players.push(player);
              targetTeam.totalOvr += player.initial_ovr;
              
              const style = player.playStyle || 'Unknown';
              targetTeam.styleCounts[style] = (targetTeam.styleCounts[style] || 0) + 1;
          });
      }
  };

  // Executa Distribuição
  distributePool(defs);
  distributePool(mids);
  distributePool(atts);

  // 4. Distribuição de Goleiros (ALEATÓRIA)
  // Embaralhamos para evitar que o "Time Branco" sempre pegue o Goleiro Top 1 da lista
  const shuffledGKs = shuffleArray(goalkeepers); 
  
  shuffledGKs.forEach((gk, index) => {
      if (index < numTeams) {
          teams[index].players.unshift(gk); // Coloca o goleiro no topo da lista visual
          // Nota: Não somamos ao totalOvr aqui para não afetar a média de linha, conforme solicitado
      }
  });

  // 5. Finalização e Ordenação Visual da Lista
  const positionOrder: Record<string, number> = { 
      [PlayerPosition.GOLEIRO]: 0, 
      [PlayerPosition.DEFENSOR]: 1, 
      [PlayerPosition.MEIO_CAMPO]: 2, 
      [PlayerPosition.ATACANTE]: 3 
  };

  teams.forEach(team => {
    team.players.sort((a, b) => {
        const posA = positionOrder[a.position] || 99;
        const posB = positionOrder[b.position] || 99;
        // Ordena por Posição -> Depois por OVR
        return (posA - posB) || (b.initial_ovr - a.initial_ovr);
    });

    // Média apenas dos jogadores de linha (Refletindo a força real do time na linha)
    const lineOnly = team.players.filter(p => p.position !== PlayerPosition.GOLEIRO);
    team.avgOvr = lineOnly.length > 0 
        ? Math.round(lineOnly.reduce((a, b) => a + b.initial_ovr, 0) / lineOnly.length) 
        : 0;
  });

  return teams;
};