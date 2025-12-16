import React, { useEffect, useState } from 'react';
import { Player, RankingsData } from '../types';
import { rankingService } from '../services/rankingService';
import { Trophy, Medal, Flame, Shield, User, Crown, Calendar, Globe, List } from 'lucide-react';

interface RankingsProps {
  players: Player[];
}

const Rankings: React.FC<RankingsProps> = ({ players }) => {
  // Três abas: Mensal, Geral, Hall
  const [activeTab, setActiveTab] = useState<'monthly' | 'allTime' | 'hall'>('monthly');
  
  const [monthlyData, setMonthlyData] = useState<RankingsData | null>(null);
  const [allTimeData, setAllTimeData] = useState<RankingsData | null>(null);
  const [hallData, setHallData] = useState<any[]>([]); // Dados brutos do Hall
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [players]);

  const loadAllData = async () => {
    setLoading(true);
    // Carrega tudo em paralelo para ser rápido
    const [monthly, allTime, hall] = await Promise.all([
      rankingService.getCurrentMonthRankings(players),
      rankingService.getAllTimeRankings(players),
      rankingService.getHallOfFame()
    ]);
    
    setMonthlyData(monthly);
    setAllTimeData(allTime);
    setHallData(hall);
    setLoading(false);
  };

  // Helper para agrupar o Hall da Fama por Mês
  const getHallByMonth = () => {
      const grouped: Record<string, any[]> = {};
      hallData.forEach(item => {
          if (!grouped[item.month_key]) grouped[item.month_key] = [];
          grouped[item.month_key].push(item);
      });
      return grouped;
  };

  // Ícones e Títulos por Categoria
  const getCategoryInfo = (cat: string) => {
      switch(cat) {
          case 'wins': return { label: 'Rei das Vitórias', icon: Trophy, color: 'text-yellow-400' };
          case 'goals': return { label: 'Artilheiro', icon: Flame, color: 'text-emerald-400' };
          case 'assists': return { label: 'Garçom', icon: Medal, color: 'text-cyan-400' };
          case 'clean_sheets': return { label: 'Muralha', icon: Shield, color: 'text-blue-400' };
          default: return { label: cat, icon: Trophy, color: 'text-white' };
      }
  };

  // Componente Visual do Card de Ranking (Genérico para Mensal e Geral)
  const RankingCard = ({ title, icon: Icon, data }: any) => {
    const topPlayer = data[0];
    const runnersUp = data.slice(1, 5);

    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700 shadow-xl mb-6 animate-fade-in relative group">
        {/* Glow effect sutil */}
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
        
        <div className="relative">
            {/* Header */}
            <div className="p-4 flex items-center gap-3 border-b border-slate-700/50">
            <div className="p-2 bg-slate-900 rounded-lg shadow-inner">
                <Icon size={20} className="text-emerald-400" />
            </div>
            <h3 className="font-black text-white uppercase tracking-wider text-sm flex-1">{title}</h3>
            </div>

            {/* Top 1 - O "King" */}
            {topPlayer ? (
            <div className="relative p-6 flex items-center gap-4 bg-gradient-to-b from-slate-800/80 to-slate-900/80">
                {/* Foto */}
                <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-emerald-400 to-cyan-500 relative z-10 shadow-lg shadow-emerald-500/20">
                        <img 
                        src={topPlayer.playerPhoto || `https://ui-avatars.com/api/?name=${topPlayer.playerName}&background=0f172a&color=34d399`} 
                        className="w-full h-full rounded-full object-cover border-2 border-slate-900"
                        alt="Campeão"
                        />
                    </div>
                    <div className="absolute -top-3 -right-1 z-20">
                        <Crown size={24} className="text-yellow-400 drop-shadow-md transform rotate-12" fill="currentColor" />
                    </div>
                    <div className="absolute -bottom-2 inset-x-0 flex justify-center z-20">
                        <span className="bg-emerald-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">1º</span>
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-xl font-black text-white truncate leading-tight">{topPlayer.playerName}</h4>
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wide">{topPlayer.position}</span>
                </div>
                
                {/* Valor Grande */}
                <div className="text-right">
                    <span className="block text-4xl font-black text-white tracking-tighter drop-shadow-lg">{topPlayer.value}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Total</span>
                </div>
            </div>
            ) : (
            <div className="p-8 text-center text-slate-500 text-xs italic">
                Ainda sem dados para o ranking.
            </div>
            )}

            {/* Lista dos Runners Up */}
            {runnersUp.length > 0 && (
            <div className="bg-slate-900/60 divide-y divide-slate-800/50">
                {runnersUp.map((p: any, index: number) => (
                <div key={p.playerId} className="flex items-center justify-between p-3 px-4 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono text-xs w-4 font-bold">{index + 2}º</span>
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
                        <img src={p.playerPhoto || `https://ui-avatars.com/api/?name=${p.playerName}&background=random`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200">{p.playerName}</span>
                        <span className="text-[9px] text-slate-500 uppercase">{p.position}</span>
                    </div>
                    </div>
                    <span className="font-bold text-emerald-400">{p.value}</span>
                </div>
                ))}
            </div>
            )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 mt-4 text-xs animate-pulse font-bold tracking-widest uppercase">Atualizando Rankings...</p>
      </div>
    );
  }

  // Define qual dado exibir baseado na aba
  const currentData = activeTab === 'monthly' ? monthlyData : allTimeData;

  return (
    <div className="w-full max-w-lg mx-auto pb-24 animate-fade-in px-4 pt-6">
      
      {/* Header Fixo */}
      <div className="text-center mb-6">
        <h2 className="text-xs font-bold text-emerald-500 tracking-[0.2em] uppercase mb-1">
            {activeTab === 'hall' ? 'Galeria de Lendas' : 'Competição Ativa'}
        </h2>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            {activeTab === 'hall' ? 'Hall da Fama' : 'Rankings'}
        </h1>
      </div>

      {/* Tabs Estilizadas */}
      <div className="flex p-1 bg-slate-800 rounded-xl mb-8 border border-slate-700 relative">
        <button 
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'monthly' ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
        >
          <Calendar size={14} /> Mês
        </button>
        <button 
          onClick={() => setActiveTab('allTime')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'allTime' ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
        >
          <Globe size={14} /> Geral
        </button>
        <button 
          onClick={() => setActiveTab('hall')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'hall' ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'}`}
        >
          <Trophy size={14} /> Hall
        </button>
      </div>

      {/* CONTEÚDO MENSAL & GERAL */}
      {(activeTab === 'monthly' || activeTab === 'allTime') && currentData && (
        <div className="space-y-6">
          <RankingCard title="Reis da Vitória" icon={Trophy} data={currentData.wins} />
          <RankingCard title="Artilharia Pesada" icon={Flame} data={currentData.goals} />
          <RankingCard title="Garçons (Assistências)" icon={Medal} data={currentData.assists} />
          <RankingCard title="Muralhas (Clean Sheets)" icon={Shield} data={currentData.cleanSheets} />
        </div>
      )}

      {/* CONTEÚDO HALL DA FAMA */}
      {activeTab === 'hall' && (
        <div className="space-y-8">
            {Object.entries(getHallByMonth()).length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/20">
                    <Trophy size={48} className="mx-auto text-slate-700 mb-4" />
                    <h3 className="text-slate-400 font-bold">Galeria Vazia</h3>
                    <p className="text-slate-600 text-xs mt-1">Os campeões aparecerão aqui após o encerramento do mês.</p>
                </div>
            ) : (
                Object.entries(getHallByMonth()).map(([monthKey, items]) => (
                    <div key={monthKey} className="animate-slide-up">
                        {/* Divisor de Mês */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-px bg-slate-700 flex-1"></div>
                            <span className="text-emerald-400 font-black text-sm uppercase tracking-widest bg-slate-900 px-3 py-1 rounded border border-emerald-500/30">
                                {monthKey}
                            </span>
                            <div className="h-px bg-slate-700 flex-1"></div>
                        </div>

                        {/* Grid de Campeões do Mês */}
                        <div className="grid grid-cols-2 gap-3">
                            {items.map((item: any) => {
                                const catInfo = getCategoryInfo(item.category);
                                const CatIcon = catInfo.icon;
                                return (
                                    <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-col items-center text-center relative overflow-hidden group">
                                        <div className={`absolute top-0 right-0 p-1.5 bg-slate-900/50 rounded-bl-xl ${catInfo.color}`}>
                                            <CatIcon size={12} />
                                        </div>
                                        
                                        <div className="w-12 h-12 rounded-full border-2 border-slate-600 mb-2 mt-1 overflow-hidden">
                                            <img src={item.player?.photo_url || `https://ui-avatars.com/api/?name=${item.player?.name}`} className="w-full h-full object-cover" />
                                        </div>
                                        
                                        <span className={`text-[9px] font-bold uppercase tracking-wide mb-0.5 ${catInfo.color}`}>{catInfo.label}</span>
                                        <h4 className="text-xs font-bold text-white leading-tight mb-1 line-clamp-1">{item.player?.name}</h4>
                                        <div className="bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-700">
                                            <span className="text-white font-bold">{item.stat_value}</span> pts
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
      )}
    </div>
  );
};

export default Rankings;