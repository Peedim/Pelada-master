// src/utils/attributeGenerator.ts

export interface Attributes {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
}

// Copiamos os pesos aqui para garantir que o gerador use a mesma matemática do serviço
// sem causar erros de importação circular.
const WEIGHTS: Record<string, any> = {
  'Goleiro':       { pace: 0.20, shooting: 0.05, passing: 0.15, defending: 0.60 },
  'Defensor':      { pace: 0.20, shooting: 0.05, passing: 0.25, defending: 0.50 },
  'Meio':          { pace: 0.20, shooting: 0.20, passing: 0.50, defending: 0.10 },
  'Atacante':      { pace: 0.20, shooting: 0.60, passing: 0.15, defending: 0.05 },
  // Goleiro Linha e Muralha usam base de Goleiro, mas podemos refinar se quiser
  'Muralha':       { pace: 0.20, shooting: 0.05, passing: 0.15, defending: 0.60 },
  'Goleiro Linha': { pace: 0.20, shooting: 0.05, passing: 0.15, defending: 0.60 },
  // Fallback
  'default':       { pace: 0.25, shooting: 0.25, passing: 0.25, defending: 0.25 }
};

const calculateOvrForGenerator = (pos: string, attr: Attributes) => {
  const w = WEIGHTS[pos] || WEIGHTS['default'];
  return (attr.pace * w.pace) + 
         (attr.shooting * w.shooting) + 
         (attr.passing * w.passing) + 
         (attr.defending * w.defending);
};

export const generateAttributesFromOvr = (targetOvr: number, position: string): Attributes => {
  // 1. CONFIGURAÇÃO INICIAL (O "Shape" do jogador)
  // Ritmo (Pace) travado em 80 para todos.
  let attr = { 
      pace: 80, 
      shooting: targetOvr, 
      passing: targetOvr, 
      defending: targetOvr 
  };

  // Aplica modificadores para criar a "personalidade" da posição
  switch (position) {
    case 'Goleiro':
    case 'Muralha':
      attr.defending = targetOvr + 15; // Especialista
      attr.passing = targetOvr - 5; 
      attr.shooting = targetOvr - 20; 
      break;
      
    case 'Goleiro Linha':
      attr.defending = targetOvr + 10;
      attr.passing = targetOvr + 5; // Joga melhor com os pés
      attr.shooting = targetOvr - 15;
      break;

    case 'Defensor':
    case 'Paredão':
    case 'Xerife':
      attr.defending = targetOvr + 10;
      attr.passing = targetOvr;
      attr.shooting = targetOvr - 10;
      break;

    case 'Meio':
    case 'Maestro':
    case 'Motorzinho':
      attr.passing = targetOvr + 8;
      attr.defending = targetOvr - 4;
      attr.shooting = targetOvr - 4;
      break;

    case 'Atacante':
    case 'Artilheiro':
    case 'Liso':
      attr.shooting = targetOvr + 10;
      attr.passing = targetOvr - 5;
      attr.defending = targetOvr - 15; 
      break;
      
    default:
      break;
  }

  // 2. O CORRETOR MATEMÁTICO
  // Agora vamos calcular quanto esse perfil gerou de OVR e ajustar para bater a meta.
  
  let currentWeighted = calculateOvrForGenerator(position, attr);
  let difference = targetOvr - currentWeighted;

  // Se a diferença for significativa (maior que 0.5), precisamos ajustar.
  // Como o PACE é fixo (80), precisamos distribuir a diferença apenas entre os outros 3 atributos.
  // A soma dos pesos dos outros 3 é sempre (1.0 - peso_do_pace).
  const w = WEIGHTS[position] || WEIGHTS['default'];
  const remainingWeight = 1.0 - w.pace; // Geralmente 0.80

  // Cálculo: "Quantos pontos brutos preciso tirar/pôr nos outros atributos para o OVR final mover X pontos?"
  // Resposta: difference / remainingWeight
  const correctionFactor = difference / remainingWeight;

  attr.shooting += correctionFactor;
  attr.passing += correctionFactor;
  attr.defending += correctionFactor;

  // 3. LIMPEZA FINAL
  // Garante que ninguém fique com atributo negativo ou acima de 99
  return {
      pace: 80, // Mantém fixo
      shooting: Math.max(40, Math.min(99, Math.round(attr.shooting))), // Minimo 40 pra não ficar injogável
      passing: Math.max(40, Math.min(99, Math.round(attr.passing))),
      defending: Math.max(15, Math.min(99, Math.round(attr.defending))) // Goleiro pode ter defesa alta, atacante baixa
  };
};