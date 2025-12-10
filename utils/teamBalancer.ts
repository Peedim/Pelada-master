import { Player, Team, PlayerPosition } from '../types';

export type TournamentType = 'Quadrangular' | 'Triangular';

export const generateTeams = (players: Player[], type: TournamentType): Team[] => {
  const numTeams = type === 'Quadrangular' ? 4 : 3;
  
  // 1. Separa Linha e Goleiros
  const linePlayers = players.filter(p => p.position !== PlayerPosition.GOLEIRO);
  const goalkeepers = players.filter(p => p.position === PlayerPosition.GOLEIRO);
  
  // Inicializa times
  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team-${i}`,
    name: `Time ${String.fromCharCode(65 + i)}`,
    players: [],
    totalOvr: 0,
    avgOvr: 0,
    styleCounts: {} 
  }));

  const sortByOvrDesc = (a: Player, b: Player) => b.initial_ovr - a.initial_ovr;

  // 2. Lógica de Balanceamento (APENAS LINHA)
  const potDEF = linePlayers.filter(p => p.position === PlayerPosition.DEFENSOR).sort(sortByOvrDesc);
  const potREST = linePlayers.filter(p => p.position !== PlayerPosition.DEFENSOR).sort(sortByOvrDesc);

  const addPlayerToTeam = (team: Team, player: Player) => {
    team.players.push(player);
    team.totalOvr += player.initial_ovr;
    const style = player.playStyle || 'Unknown';
    team.styleCounts[style] = (team.styleCounts[style] || 0) + 1;
  };

  // Snake Draft para Defensores
  potDEF.forEach((def, index) => {
    const cycle = Math.floor(index / numTeams);
    const teamIndex = cycle % 2 === 0 ? (index % numTeams) : (numTeams - 1 - (index % numTeams));
    addPlayerToTeam(teams[teamIndex], def);
  });

  // Balanceamento para Resto
  potREST.forEach((player) => {
    let bestTeamIndex = 0;
    let bestScore = Infinity;
    const minTotal = Math.min(...teams.map(t => t.totalOvr));

    teams.forEach((team, index) => {
      const styleCount = team.styleCounts[player.playStyle] || 0;
      const penalty = (team.totalOvr - minTotal > 15 ? 1000 : 0) + (styleCount * 25);
      const score = team.totalOvr + penalty;
      if (score < bestScore) { bestScore = score; bestTeamIndex = index; }
    });
    addPlayerToTeam(teams[bestTeamIndex], player);
  });

  // 3. Distribuição Simples de Goleiros (Sequencial)
  // Eles entram no time apenas para constar na lista, não afetam a lógica acima
  goalkeepers.forEach((gk, index) => {
      if (index < numTeams) {
          teams[index].players.unshift(gk); // Adiciona no início da lista visual
      }
  });

  // 4. Finalização
  const positionOrder: Record<string, number> = { [PlayerPosition.GOLEIRO]: 0, [PlayerPosition.DEFENSOR]: 1, [PlayerPosition.MEIO_CAMPO]: 2, [PlayerPosition.ATACANTE]: 3 };

  teams.forEach(team => {
    team.players.sort((a, b) => {
        const posA = positionOrder[a.position] || 99;
        const posB = positionOrder[b.position] || 99;
        return posA - posB || b.initial_ovr - a.initial_ovr;
    });

    // Média apenas da linha para exibição justa
    const lineOnly = team.players.filter(p => p.position !== PlayerPosition.GOLEIRO);
    team.avgOvr = lineOnly.length > 0 ? Math.round(lineOnly.reduce((a, b) => a + b.initial_ovr, 0) / lineOnly.length) : 0;
  });

  return teams;
};