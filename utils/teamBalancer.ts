import { Player, Team, PlayerPosition } from '../types';

export type TournamentType = 'Quadrangular' | 'Triangular';

/**
 * Generates balanced teams based on position, OVR, and PlayStyle (V2 Algorithm).
 * 
 * Algorithm:
 * 1. Filter players by position (GK, DEF, REST).
 * 2. Phase 1 (GK): One GK per team.
 * 3. Phase 2 (DEF): Snake draft to ensure defense coverage.
 * 4. Phase 3 (REST): Balance by Total OVR with PlayStyle constraints.
 *    - Logic: When assigning a player, calculate a "Score" for each team.
 *    - Score = TeamTotalOVR + (PlayStylePenalty).
 *    - PlayStylePenalty adds weight if the team already has players of that specific style.
 *    - Assign player to the team with the LOWEST Score.
 */
export const generateTeams = (players: Player[], type: TournamentType): Team[] => {
  const numTeams = type === 'Quadrangular' ? 4 : 3;
  
  // Initialize empty teams
  const teams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
    id: `team-${i}`,
    name: `Time ${String.fromCharCode(65 + i)}`, // Time A, Time B, etc.
    players: [],
    totalOvr: 0,
    avgOvr: 0,
    styleCounts: {} 
  }));

  // Helper to sort players by OVR Descending
  const sortByOvrDesc = (a: Player, b: Player) => b.initial_ovr - a.initial_ovr;

  // 1. Organize Pots
  const potGK = players.filter(p => p.position === PlayerPosition.GOLEIRO).sort(sortByOvrDesc);
  const potDEF = players.filter(p => p.position === PlayerPosition.DEFENSOR).sort(sortByOvrDesc);
  
  // Rest contains Midfielders and Attackers initially
  let potREST = players.filter(p => 
    p.position === PlayerPosition.MEIO_CAMPO || 
    p.position === PlayerPosition.ATACANTE
  );

  const addPlayerToTeam = (team: Team, player: Player) => {
    team.players.push(player);
    team.totalOvr += player.initial_ovr;
    // Track PlayStyle Counts
    const style = player.playStyle || 'Unknown';
    team.styleCounts[style] = (team.styleCounts[style] || 0) + 1;
  };

  // --- Phase 1: Goleiros (Strict Distribution) ---
  potGK.forEach((gk, index) => {
    if (index < numTeams) {
      addPlayerToTeam(teams[index], gk);
    } else {
      // Overflow GKs go to REST
      potREST.push(gk);
    }
  });

  // --- Phase 2: Defensores (Snake Draft) ---
  // A -> B -> C -> D -> D -> C -> B -> A
  potDEF.forEach((def, index) => {
    const cycle = Math.floor(index / numTeams);
    const isEvenCycle = cycle % 2 === 0;
    const baseIndex = index % numTeams;
    
    // If even cycle (0, 2..), go forward (0,1,2,3). If odd, go backward (3,2,1,0)
    const teamIndex = isEvenCycle ? baseIndex : (numTeams - 1 - baseIndex);
    
    addPlayerToTeam(teams[teamIndex], def);
  });

  // --- Phase 3: The Great Filter (Rest - OVR & PlayStyle Balance) ---
  // Sort remaining players by OVR to place strongest players first
  potREST = potREST.sort(sortByOvrDesc);

  potREST.forEach((player) => {
    // We want to find the best team for this player.
    // Criteria: Balance OVR, but avoid stacking same PlayStyles if OVR diff is small.
    
    let bestTeamIndex = -1;
    let bestScore = Infinity;

    // Calculate "Current Min Total OVR" to know what the baseline is
    const minTotalOvr = Math.min(...teams.map(t => t.totalOvr));

    teams.forEach((team, index) => {
      // 1. OVR Component
      const ovrScore = team.totalOvr;
      
      // 2. PlayStyle Component (Penalty)
      const styleCount = team.styleCounts[player.playStyle] || 0;
      // Heavy penalty for stacking styles (e.g., +20 "fake ovr" per existing player of same style)
      // This makes the algorithm perceive the team as "stronger" than it is, discouraging assignment.
      const stylePenalty = styleCount * 25; 

      // 3. Logic:
      // If a team is WAY behind in OVR (>15 diff from leader), the penalty matters less (we need power).
      // If teams are close in OVR, the penalty dominates (we need role balance).
      
      // However, simplified greedy score works well:
      // Score = OVR + Penalty. We choose the team with lowest Score.
      
      // Exception: If team.totalOvr - minTotalOvr > 15, force exclude this team (it's too strong already)
      // unless all teams are strong (relative).
      const ovrDiff = team.totalOvr - minTotalOvr;
      const hardCapPenalty = ovrDiff > 15 ? 1000 : 0; 

      const finalScore = ovrScore + stylePenalty + hardCapPenalty;

      if (finalScore < bestScore) {
        bestScore = finalScore;
        bestTeamIndex = index;
      }
    });

    // Fallback just in case
    if (bestTeamIndex === -1) bestTeamIndex = 0;

    addPlayerToTeam(teams[bestTeamIndex], player);
  });

  // --- Final Polish (Sorting within Team) ---
  const positionOrder: Record<string, number> = {
    [PlayerPosition.GOLEIRO]: 1,
    [PlayerPosition.DEFENSOR]: 2,
    [PlayerPosition.MEIO_CAMPO]: 3,
    [PlayerPosition.ATACANTE]: 4
  };

  teams.forEach(team => {
    // Calculate Average
    team.avgOvr = team.players.length > 0 
      ? Math.round(team.totalOvr / team.players.length) 
      : 0;

    // Sort players within the team: Pos -> OVR
    team.players.sort((a, b) => {
      const posA = positionOrder[a.position] || 99;
      const posB = positionOrder[b.position] || 99;
      if (posA !== posB) return posA - posB;
      return b.initial_ovr - a.initial_ovr;
    });
  });

  return teams;
};