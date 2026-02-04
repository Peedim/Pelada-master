import React, { useEffect, useState } from 'react';
import { matchService } from '../services/matchService';
import { Match, MatchStatus } from '../types';
import { Calendar, ChevronRight, Zap } from 'lucide-react';
import { formatMatchDate } from '../utils/dateUtils';

interface MatchDayBannerProps {
  onNavigate: (matchId: string) => void;
}

const MatchDayBanner: React.FC<MatchDayBannerProps> = ({ onNavigate }) => {
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);

  useEffect(() => {
    const checkActiveMatch = async () => {
      // Busca partidas abertas ou rascunhos recentes
      const matches = await matchService.getAll();
      // Pega a primeira que estiver em DRAFT ou OPEN
      const current = matches.find(m => 
        m.status === MatchStatus.DRAFT || m.status === MatchStatus.OPEN
      );
      setActiveMatch(current || null);
    };

    checkActiveMatch();
  }, []);

  if (!activeMatch) return null;

  const isDraft = activeMatch.status === MatchStatus.DRAFT;

  return (
    <div 
      onClick={() => onNavigate(activeMatch.id)}
      className="mb-6 cursor-pointer transform transition-all hover:scale-[1.02] active:scale-95"
    >
      <div className={`rounded-xl p-4 border-l-4 shadow-lg relative overflow-hidden ${
        isDraft 
          ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-yellow-500' 
          : 'bg-gradient-to-r from-emerald-900 to-slate-900 border-emerald-500'
      }`}>
        {/* Background Effect */}
        <div className="absolute top-0 right-0 -mt-2 -mr-2 w-20 h-20 bg-white/5 rounded-full blur-xl"></div>

        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isDraft ? (
                <span className="bg-yellow-500/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-500/30 uppercase tracking-wide">
                  Pré-Jogo
                </span>
              ) : (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-red-500 animate-pulse uppercase tracking-wide flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div> Ao Vivo
                </span>
              )}
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Calendar size={10} /> {formatMatchDate(activeMatch.date)}
              </span>
            </div>
            
            <h3 className="text-white font-bold text-lg leading-tight">
              {isDraft ? 'Sorteio Definido!' : 'Bola Rolando!'}
            </h3>
            <p className="text-slate-400 text-sm mt-0.5">
              {isDraft 
                ? 'Confira seu time e estratégia.' 
                : 'Acompanhe o placar e estatísticas.'}
            </p>
          </div>

          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
            isDraft 
              ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' 
              : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
          }`}>
             {isDraft ? <Zap size={20} /> : <ChevronRight size={24} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchDayBanner;