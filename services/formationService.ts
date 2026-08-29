import { Player, PlayStyle, PlayerPosition } from '../types';

// --- Tipos ---

export interface FieldPosition {
  id: string;
  label: string;
  x: number;
  y: number;
  nativePositions: PlayerPosition[];
  roleRequirement?: PlayStyle[];
}

export interface Formation {
  id: string; // ID único para o select
  name: string;
  description: string;
  slots: FieldPosition[];
}

export interface TacticalSetup {
  formation: Formation;
  starters: { positionId: string; player: Player }[];
  bench: Player[];
  strategyText: string;
}

// --- Definição das Formações ---

const FORMATION_2_3_1: Formation = {
  id: '2-3-1',
  name: '2-3-1 (Clássico)',
  description: 'Equilíbrio total. Triangulações pelos lados.',
  slots: [
    { id: 'GK', label: 'GK', x: 50, y: 5, nativePositions: [PlayerPosition.GOLEIRO] },
    { id: 'DEF_R', label: 'Zaga', x: 30, y: 25, nativePositions: [PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.XERIFE, PlayStyle.MURALHA] },
    { id: 'DEF_L', label: 'Saída', x: 70, y: 25, nativePositions: [PlayerPosition.DEFENSOR, PlayerPosition.MEIO_CAMPO], roleRequirement: [PlayStyle.CORINGA, PlayStyle.MOTORZINHO] },
    { id: 'MID_C', label: 'Maestro', x: 50, y: 50, nativePositions: [PlayerPosition.MEIO_CAMPO], roleRequirement: [PlayStyle.MAESTRO] },
    { id: 'ALA_R', label: 'Ala Dir', x: 15, y: 60, nativePositions: [PlayerPosition.MEIO_CAMPO, PlayerPosition.ATACANTE], roleRequirement: [PlayStyle.MOTORZINHO, PlayStyle.LISO] },
    { id: 'ALA_L', label: 'Ala Esq', x: 85, y: 60, nativePositions: [PlayerPosition.MEIO_CAMPO, PlayerPosition.ATACANTE], roleRequirement: [PlayStyle.LISO, PlayStyle.MOTORZINHO] },
    { id: 'ATT', label: 'Pivô', x: 50, y: 85, nativePositions: [PlayerPosition.ATACANTE], roleRequirement: [PlayStyle.ARTILHEIRO, PlayStyle.GARCOM] },
  ]
};

const FORMATION_3_2_1: Formation = {
  id: '3-2-1',
  name: '3-2-1 (Árvore de Natal)',
  description: 'Bloco defensivo sólido e contra-ataque.',
  slots: [
    { id: 'GK', label: 'GK', x: 50, y: 5, nativePositions: [PlayerPosition.GOLEIRO] },
    { id: 'ZAG_C', label: 'Xerife', x: 50, y: 20, nativePositions: [PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.XERIFE, PlayStyle.MURALHA] },
    { id: 'LAT_R', label: 'Lat Dir', x: 20, y: 25, nativePositions: [PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.CORINGA, PlayStyle.MURALHA] },
    { id: 'LAT_L', label: 'Lat Esq', x: 80, y: 25, nativePositions: [PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.CORINGA, PlayStyle.MURALHA] },
    { id: 'VOL_1', label: 'Volante', x: 35, y: 50, nativePositions: [PlayerPosition.MEIO_CAMPO, PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.MOTORZINHO, PlayStyle.CORINGA] },
    { id: 'VOL_2', label: 'Volante', x: 65, y: 50, nativePositions: [PlayerPosition.MEIO_CAMPO, PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.MOTORZINHO, PlayStyle.CORINGA] },
    { id: 'ATT', label: 'Isolado', x: 50, y: 80, nativePositions: [PlayerPosition.ATACANTE, PlayerPosition.MEIO_CAMPO], roleRequirement: [PlayStyle.GARCOM, PlayStyle.ARTILHEIRO] },
  ]
};

const FORMATION_2_2_2: Formation = {
  id: '2-2-2',
  name: '2-2-2 (Quadrado Mágico)',
  description: 'Foco total no ataque pelo meio.',
  slots: [
    { id: 'GK', label: 'GK', x: 50, y: 5, nativePositions: [PlayerPosition.GOLEIRO] },
    { id: 'DEF_1', label: 'Zagueiro', x: 30, y: 20, nativePositions: [PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.CORINGA, PlayStyle.MOTORZINHO] },
    { id: 'DEF_2', label: 'Zagueiro', x: 70, y: 20, nativePositions: [PlayerPosition.DEFENSOR], roleRequirement: [PlayStyle.CORINGA, PlayStyle.MOTORZINHO] },
    { id: 'MID_1', label: 'Criador', x: 30, y: 55, nativePositions: [PlayerPosition.MEIO_CAMPO], roleRequirement: [PlayStyle.MAESTRO] },
    { id: 'MID_2', label: 'Motor', x: 70, y: 55, nativePositions: [PlayerPosition.MEIO_CAMPO], roleRequirement: [PlayStyle.MOTORZINHO] },
    { id: 'ATT_1', label: 'Garçom', x: 35, y: 80, nativePositions: [PlayerPosition.ATACANTE], roleRequirement: [PlayStyle.GARCOM, PlayStyle.LISO] },
    { id: 'ATT_2', label: 'Matador', x: 65, y: 80, nativePositions: [PlayerPosition.ATACANTE], roleRequirement: [PlayStyle.ARTILHEIRO] },
  ]
};

export const AVAILABLE_FORMATIONS = [FORMATION_2_3_1, FORMATION_3_2_1, FORMATION_2_2_2];

export const formationService = {
  
  // IA Sugere a melhor (Usa no primeiro load)
  suggestTacticalSetup: (players: Player[]): TacticalSetup => {
    const posCounts = players.reduce((acc, p) => {
      const pos = p.position as PlayerPosition;
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {} as Record<PlayerPosition, number>);

    let bestFormation = FORMATION_2_3_1;
    let strategyText = "Elenco equilibrado. Aposte na posse de bola.";

    const defenders = posCounts[PlayerPosition.DEFENSOR] || 0;
    const attackers = posCounts[PlayerPosition.ATACANTE] || 0;
    const mids = posCounts[PlayerPosition.MEIO_CAMPO] || 0;

    if (defenders >= 3 && attackers <= 1) {
      bestFormation = FORMATION_3_2_1;
      strategyText = "Defesa forte. Jogue fechado e explore o contra-ataque.";
    } else if (attackers >= 2 && mids >= 2 && defenders <= 2) {
      bestFormation = FORMATION_2_2_2;
      strategyText = "Ataque forte. Pressione a saída de bola.";
    }

    // Chama a função genérica de preenchimento
    return fillFormationSlots(bestFormation, players, strategyText);
  },

  // Usuário escolhe manualmente (Usa no Select)
  createSetupForFormation: (formationId: string, players: Player[]): TacticalSetup | null => {
      const formation = AVAILABLE_FORMATIONS.find(f => f.id === formationId);
      if (!formation) return null;
      return fillFormationSlots(formation, players, "Formação escolhida manualmente.");
  }
};

// --- LÓGICA DE PREENCHIMENTO (Compartilhada) ---
function fillFormationSlots(formation: Formation, players: Player[], strategyText: string): TacticalSetup {
    const availablePlayers = [...players];
    const starters: { positionId: string; player: Player }[] = [];

    // Prioridade total para Goleiro
    const gkSlot = formation.slots.find(s => s.id === 'GK');
    if (gkSlot) {
        const bestGK = findBestPlayerForSlot(availablePlayers, gkSlot);
        if (bestGK) {
            starters.push({ positionId: 'GK', player: bestGK });
            removePlayer(availablePlayers, bestGK.id);
        }
    }

    const fieldSlots = formation.slots.filter(s => s.id !== 'GK');
    
    for (const slot of fieldSlots) {
      if (availablePlayers.length === 0) break;
      const bestFit = findBestPlayerForSlot(availablePlayers, slot);
      if (bestFit) {
        starters.push({ positionId: slot.id, player: bestFit });
        removePlayer(availablePlayers, bestFit.id);
      }
    }

    return {
      formation,
      starters,
      bench: availablePlayers,
      strategyText
    };
}

// --- SISTEMA DE PONTUAÇÃO ---
function findBestPlayerForSlot(players: Player[], slot: FieldPosition): Player | undefined {
    if (players.length === 0) return undefined;

    return players.sort((a, b) => {
        const scoreA = calculateScore(a, slot);
        const scoreB = calculateScore(b, slot);
        return scoreB - scoreA;
    })[0];
}

function calculateScore(player: Player, slot: FieldPosition): number {
    let score = 0;
    const playerPos = player.position as PlayerPosition;
    const playerStyle = player.playStyle as PlayStyle;

    if (slot.nativePositions.includes(playerPos)) {
        score += 1000;
        if (slot.nativePositions[0] === playerPos) score += 200;
    }

    if (slot.roleRequirement && slot.roleRequirement.includes(playerStyle)) {
        score += 500;
    }

    score += (player.initial_ovr || 0);

    if (slot.id !== 'GK' && playerPos === PlayerPosition.GOLEIRO) {
        if (playerStyle !== PlayStyle.GOLEIRO_LINHA) score -= 10000; 
        else score -= 2000;
    }

    if (slot.id === 'GK' && playerPos !== PlayerPosition.GOLEIRO) score -= 5000;

    if (slot.nativePositions.includes(PlayerPosition.DEFENSOR) && playerPos === PlayerPosition.ATACANTE) score -= 500;
    if (slot.nativePositions.includes(PlayerPosition.ATACANTE) && playerPos === PlayerPosition.DEFENSOR) score -= 500;

    return score;
}

function removePlayer(list: Player[], id: string) {
  const index = list.findIndex(p => p.id === id);
  if (index !== -1) list.splice(index, 1);
}