import React, { useState } from 'react';
import { TacticalSetup } from '../services/formationService';
import { User, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TacticalBoardProps {
  setup: TacticalSetup;
  teamName?: string;
  onPlayerSwap: (sourceId: string, targetId: string, sourceType: 'field' | 'bench', targetType: 'field' | 'bench') => void;
}

const TacticalBoard: React.FC<TacticalBoardProps> = ({ setup, teamName, onPlayerSwap }) => {
  const { formation, starters } = setup;
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (slotId: string) => {
    if (selected === slotId) { setSelected(null); return; }
    if (selected) {
      onPlayerSwap(selected, slotId, 'field', 'field');
      setSelected(null);
    } else {
      setSelected(slotId);
    }
  };

  const getPositionColor = (posId: string) => {
    if (posId === 'GK') return 'from-yellow-500 to-yellow-600 border-yellow-400';
    if (posId.includes('DEF') || posId.includes('ZAG')) return 'from-blue-600 to-blue-700 border-blue-400';
    if (posId.includes('MID') || posId.includes('VOL') || posId.includes('MAESTRO')) return 'from-emerald-500 to-emerald-600 border-emerald-300';
    return 'from-red-600 to-red-700 border-red-400';
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto select-none perspective-container">
      
      {/* Container 3D */}
      <div 
        className="relative w-full aspect-[4/5] mt-8 mb-4 transition-all duration-700 ease-out"
        style={{ perspective: '1200px' }} 
      >
        {/* Placar Flutuante (Header) */}
        <motion.div 
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-10 left-0 right-0 text-center z-20 pointer-events-none"
        >
            <h3 className="text-white font-black text-3xl uppercase tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {teamName || 'Seu Time'}
            </h3>
            <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest">
                    {formation.name}
                </span>
            </div>
        </motion.div>

        {/* O GRAMADO "TECH" */}
        <div 
            className="absolute inset-0 w-full h-full transform-3d shadow-2xl overflow-hidden"
            style={{ 
                transform: 'rotateX(25deg) scale(0.9)', 
                transformStyle: 'preserve-3d',
                backgroundColor: '#1a2233', // Azul bem escuro (Tech)
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 40px 80px -20px rgba(0, 0, 0, 0.8)'
            }}
        >
            {/* 1. Grama Sintética / Grid */}
            <div className="absolute inset-0 opacity-20" 
                 style={{ 
                     backgroundImage: `
                        linear-gradient(rgba(16,185,129,0.1) 1px, transparent 1px), 
                        linear-gradient(90deg, rgba(16,185,129,0.1) 1px, transparent 1px)
                     `, 
                     backgroundSize: '40px 40px',
                     maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
                 }}>
            </div>

            {/* 2. Spotlights (Iluminação) */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-900/10 to-transparent pointer-events-none"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none"></div>

            {/* 3. AS LINHAS DO CAMPO (SVG PERFEITO) */}
            <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="none">
                {/* Bordas Externas */}
                <rect x="5" y="5" width="90" height="120" fill="none" stroke="#34d399" strokeWidth="0.8" rx="2" />
                
                {/* Linha do Meio */}
                <line x1="5" y1="65" x2="95" y2="65" stroke="#34d399" strokeWidth="0.8" />
                
                {/* Círculo Central */}
                <circle cx="50" cy="65" r="10" fill="none" stroke="#34d399" strokeWidth="0.8" />
                <circle cx="50" cy="65" r="1" fill="#34d399" />

                {/* Área Gol (Baixo) */}
                <path d="M 25 125 L 25 105 L 75 105 L 75 125" fill="none" stroke="#34d399" strokeWidth="0.8" />
                <path d="M 40 125 L 40 118 L 60 118 L 60 125" fill="none" stroke="#34d399" strokeWidth="0.8" />
                {/* Meia Lua (Baixo) */}
                <path d="M 40 105 Q 50 95 60 105" fill="none" stroke="#34d399" strokeWidth="0.8" />

                {/* Área Gol (Cima) */}
                <path d="M 25 5 L 25 25 L 75 25 L 75 5" fill="none" stroke="#34d399" strokeWidth="0.8" />
                <path d="M 40 5 L 40 12 L 60 12 L 60 5" fill="none" stroke="#34d399" strokeWidth="0.8" />
                {/* Meia Lua (Cima) */}
                <path d="M 40 25 Q 50 35 60 25" fill="none" stroke="#34d399" strokeWidth="0.8" />
            </svg>

            {/* --- JOGADORES --- */}
            {formation.slots.map((slot) => {
              const assignment = starters.find(s => s.positionId === slot.id);
              const player = assignment?.player;
              const isSelected = selected === slot.id;

              return (
                <div
                  key={slot.id}
                  onClick={(e) => { e.stopPropagation(); handleSelect(slot.id); }}
                  className="absolute flex items-center justify-center w-0 h-0 cursor-pointer"
                  style={{ 
                      left: `${slot.x}%`, 
                      bottom: `${slot.y}%`,
                      transformStyle: 'preserve-3d',
                      zIndex: Math.floor(100 - slot.y)
                  }}
                >
                  <AnimatePresence mode='popLayout'>
                    <motion.div 
                        layoutId={player ? `player-${player.id}` : `empty-${slot.id}`}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="relative flex flex-col items-center group"
                        style={{ transform: 'rotateX(-25deg) translateY(-25px) translateZ(15px)' }}
                    >
                        {/* BASE HOLOGRÁFICA */}
                        {isSelected && (
                            <div className="absolute -bottom-6 w-12 h-12 perspective-[500px]">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="w-full h-full rounded-full border border-emerald-400/50 border-dashed"
                                    style={{ transform: 'rotateX(60deg)' }}
                                />
                                <motion.div 
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-1 rounded-full border border-white/30"
                                    style={{ transform: 'rotateX(60deg)' }}
                                />
                            </div>
                        )}

                        {/* Sombra de Contato */}
                        <div className="absolute bottom-[-10px] w-6 h-2 bg-black/60 rounded-full blur-[2px]" style={{ transform: 'rotateX(25deg)' }}></div>

                        {/* O PLAYER (Círculo com Gradiente e Borda Brilhante) */}
                        <motion.div 
                            whileHover={{ scale: 1.1, y: -5 }}
                            className={`w-14 h-14 rounded-full border-[3px] flex items-center justify-center relative shadow-lg transition-all duration-300 z-10 
                            ${isSelected ? 'border-white ring-4 ring-emerald-500/30 scale-110' : 'border-white/20 hover:border-white/60'} 
                            bg-gradient-to-br ${player ? getPositionColor(slot.id) : 'from-slate-800 to-slate-900 border-dashed border-slate-600'}`}
                        >
                           {player ? (
                              player.photo_url ? (
                                  <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover rounded-full" />
                              ) : (
                                  <span className="text-sm font-black text-white drop-shadow-md">{player.name.substring(0,2).toUpperCase()}</span>
                              )
                           ) : (
                              <User size={20} className="text-slate-500" />
                           )}
                           
                           {/* Brilho Especular (Vidro) */}
                           <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-full pointer-events-none"></div>
                        </motion.div>

                        {/* ETIQUETA DE NOME (Sem posição em baixo) */}
                        {player && (
                            <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`mt-2 flex flex-col items-center leading-none transition-all ${isSelected ? 'scale-110' : ''}`}
                            >
                                <div className="bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl border border-white/10">
                                    {player.name.split(' ')[0]} 
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              );
            })}
        </div>
      </div>

      {/* Rodapé de Ação */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 opacity-60 mt-4">
         {selected ? (
             <span className="flex items-center gap-1 text-emerald-400 animate-pulse font-bold">
                 <RefreshCw size={12} className="animate-spin-slow" /> Selecione outro jogador para trocar
             </span>
         ) : (
             <span className="flex items-center gap-1">
                 <ArrowRightLeft size={12} /> Toque em um jogador para mover
             </span>
         )}
      </div>

    </div>
  );
};

export default TacticalBoard;