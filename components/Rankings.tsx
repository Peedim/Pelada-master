import React, { useMemo, useState, useEffect } from 'react';
import { Player, RankingsData, Match } from '../types';
import { rankingService } from '../services/rankingService';
import { Trophy, Medal, Flame, Shield, Crown, Calendar, Globe, ChevronLeft, ChevronRight, Star } from 'lucide-react';

interface RankingsProps {
  players: Player[];
  matches: Match[];
  hallOfFame: any[];
}

const Rankings: React.FC<RankingsProps> = ({ players, matches, hallOfFame }) => {
  const [activeTab, setActiveTab] = useState<'monthly' | 'allTime' | 'hall'>('monthly');
  const [selectedHallMonth, setSelectedHallMonth] = useState<string>('');

  const monthlyRawData = useMemo(() => rankingService.getMonthRankings(players, matches), [players, matches]);
  const allTimeRawData = useMemo(() => rankingService.getAllTimeRankings(players, matches), [players, matches]);

  const hallByMonth = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    hallOfFame.forEach(item => {
        if (!grouped[item.month_key]) grouped[item.month_key] = [];
        grouped[item.month_key].push(item);
    });
    return grouped;
  }, [hallOfFame]);

  const availableMonths = useMemo(() => Object.keys(hallByMonth).sort((a, b) => b.localeCompare(a)), [hallByMonth]);

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedHallMonth) {
        setSelectedHallMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedHallMonth]);

  const handlePrevMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedHallMonth);
    if (currentIndex < availableMonths.length - 1) {
        setSelectedHallMonth(availableMonths[currentIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedHallMonth);
    if (currentIndex > 0) {
        setSelectedHallMonth(availableMonths[currentIndex - 1]);
    }
  };

  const prepareRankingList = (data: RankingsData, statKey: 'wins' | 'goals' | 'assists' | 'cleanSheets') => {
      return Object.values(data)
          .map(stat => {
              const player = players.find(p => p.id === stat.playerId);
              return {
                  playerId: stat.playerId,
                  playerName: player?.name || 'Desconhecido',
                  playerPhoto: player?.photo_url,
                  position: player?.position || '-',
                  value: stat[statKey],
                  wins: stat.wins,
                  goals: stat.goals,
                  assists: stat.assists,
                  contributions: stat.goals + stat.assists
              };
          })
          .filter(item => {
              if (item.value === 0) return false;
              if (statKey === 'cleanSheets') {
                  const pos = item.position;
                  return pos === 'Defensor' || pos === 'Goleiro' || pos === 'Zagueiro'; 
              }
              return true;
          })
          .sort((a, b) => {
              const diff = b.value - a.value;
              if (diff !== 0) return diff;
              if (statKey === 'wins') return b.contributions - a.contributions;
              return b.wins - a.wins;
          })
          .slice(0, 5);
  };

  const getCategoryInfo = (cat: string) => {
      switch(cat) {
          case 'wins': return { label: 'MVP', icon: Crown, color: 'text-yellow-300', gradient: 'from-yellow-400/20 to-amber-600/20', border: 'border-yellow-500/50', statLabel: 'Vitórias' };
          case 'goals': return { label: 'Artilheiro', icon: Flame, color: 'text-emerald-400', gradient: 'from-emerald-400/20 to-emerald-700/20', border: 'border-emerald-500/50', statLabel: 'Gols' };
          case 'assists': return { label: 'Garçom', icon: Medal, color: 'text-cyan-400', gradient: 'from-cyan-400/20 to-blue-600/20', border: 'border-cyan-500/50', statLabel: 'Assistências' };
          case 'clean_sheets': return { label: 'Muralha', icon: Shield, color: 'text-blue-400', gradient: 'from-blue-400/20 to-indigo-600/20', border: 'border-blue-500/50', statLabel: 'Clean Sheets' };
          default: return { label: cat, icon: Trophy, color: 'text-white', gradient: 'from-slate-400/20 to-slate-600/20', border: 'border-slate-500/50', statLabel: 'Pontos' };
      }
  };

  const RankingCard = ({ title, icon: Icon, data }: any) => {
    const topPlayer = data[0];
    const runnersUp = data.slice(1, 5);

    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700 shadow-xl mb-6 relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
        
        <div className="relative">
            <div className="p-4 flex items-center gap-3 border-b border-slate-700/50">
                <div className="p-2 bg-slate-900 rounded-lg shadow-inner">
                    <Icon size={20} className="text-emerald-400" />
                </div>
                <h3 className="font-black text-white uppercase tracking-wider text-sm flex-1">{title}</h3>
            </div>

            {topPlayer ? (
            <div className="relative p-6 flex items-center gap-4 bg-gradient-to-b from-slate-800/80 to-slate-900/80">
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
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-xl font-black text-white truncate leading-tight">{topPlayer.playerName}</h4>
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wide">{topPlayer.position}</span>
                </div>
                
                <div className="text-right">
                    <span className="block text-4xl font-black text-white tracking-tighter drop-shadow-lg">{topPlayer.value}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Total</span>
                </div>
            </div>
            ) : (
                <div className="p-8 text-center text-slate-500 text-xs italic">
                    Ainda sem dados.
                </div>
            )}

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

  const currentRawData = activeTab === 'monthly' ? monthlyRawData : allTimeRawData;

  const renderHallOfFame = () => {
    if (availableMonths.length === 0) {
        return (
            <div className="text-center py-20 px-6 border-2 border-dashed border-slate-700/50 rounded-3xl bg-slate-800/20">
                <Trophy size={64} className="mx-auto text-slate-700 mb-6 opacity-50" />
                <h3 className="text-slate-300 font-bold text-lg mb-2">Galeria de Lendas Vazia</h3>
                <p className="text-slate-500 text-sm">Os campeões eternos surgirão aqui ao final de cada mês.</p>
            </div>
        );
    }

    const currentMonthItems = hallByMonth[selectedHallMonth] || [];
    
    // Sort items so order is consistent: Wins -> Goals -> Assists -> Clean Sheets
    const sortOrder = ['wins', 'goals', 'assists', 'clean_sheets'];
    const sortedItems = [...currentMonthItems].sort((a, b) => sortOrder.indexOf(a.category) - sortOrder.indexOf(b.category));

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            {/* Navegação de Mês */}
            <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md sticky top-0 z-20">
                <button 
                    onClick={handlePrevMonth} 
                    disabled={availableMonths.indexOf(selectedHallMonth) >= availableMonths.length - 1}
                    className="p-3 bg-slate-900 rounded-xl text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] mobile:text-xs font-bold text-slate-500 uppercase tracking-widest">Era de</span>
                    <span className="text-lg mobile:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 uppercase tracking-tighter drop-shadow-sm">
                        {selectedHallMonth}
                    </span>
                </div>
                <button 
                    onClick={handleNextMonth} 
                    disabled={availableMonths.indexOf(selectedHallMonth) <= 0}
                    className="p-3 bg-slate-900 rounded-xl text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Lista de Cards Grandiosos */}
            <div className="grid grid-cols-1 gap-6">
                {sortedItems.map((item: any) => {
                    const info = getCategoryInfo(item.category);
                    const Icon = info.icon;
                    
                    return (
                        <div key={item.id} className={`relative overflow-hidden group rounded-3xl border-2 ${info.border} bg-slate-900 shadow-2xl`}>
                            {/* Gradient Background */}
                             <div className={`absolute inset-0 bg-gradient-to-br ${info.gradient} opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                             
                             {/* Large Icon Background */}
                             <Icon className={`absolute -right-6 -bottom-6 w-32 h-32 ${info.color} opacity-10 transform -rotate-12`} />

                             <div className="relative p-6 flex items-center justify-between">
                                 <div className="flex items-center gap-5">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 shadow-xl">
                                            <img src={item.player?.photo_url || `https://ui-avatars.com/api/?name=${item.player?.name}`} className="w-full h-full rounded-full object-cover" />
                                        </div>
                                        <div className="absolute -top-3 -left-3 bg-slate-900 rounded-full p-2 border border-slate-700 shadow-lg">
                                            <Icon size={20} className={info.color} />
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-black uppercase tracking-widest ${info.color} mb-1 drop-shadow-sm`}>{info.label}</span>
                                        <h3 className="text-2xl font-black text-white leading-none tracking-tight">{item.player?.name}</h3>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">{item.player?.position}</span>
                                    </div>
                                 </div>

                                 <div className="flex flex-col items-end">
                                     <span className={`text-5xl font-black ${info.color} drop-shadow-lg tracking-tighter`}>{item.stat_value}</span>
                                     <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{info.statLabel}</span>
                                 </div>
                             </div>
                        </div>
                    );
                })}
            </div>

            <div className="text-center pt-8 pb-4 opacity-50">
                <Star size={16} className="mx-auto text-yellow-500 mb-2" />
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Lendas nunca morrem</p>
            </div>
        </div>
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-24 px-4 pt-6">
      <div className="text-center mb-6">
        <h2 className="text-xs font-bold text-emerald-500 tracking-[0.2em] uppercase mb-1">
            {activeTab === 'hall' ? 'Galeria de Lendas' : 'Competição Ativa'}
        </h2>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            {activeTab === 'hall' ? 'Hall da Fama' : 'Rankings'}
        </h1>
      </div>

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
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'hall' ? 'bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-900 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-amber-400'}`}
        >
          <Trophy size={14} /> Hall
        </button>
      </div>

      {(activeTab === 'monthly' || activeTab === 'allTime') ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <RankingCard title="MVP" icon={Trophy} data={prepareRankingList(currentRawData, 'wins')} />
          <RankingCard title="Artilharia Pesada" icon={Flame} data={prepareRankingList(currentRawData, 'goals')} />
          <RankingCard title="Garçom" icon={Medal} data={prepareRankingList(currentRawData, 'assists')} />
          <RankingCard title="Muralha" icon={Shield} data={prepareRankingList(currentRawData, 'cleanSheets')} />
        </div>
      ) : (
        renderHallOfFame()
      )}
    </div>
  );
};

export default Rankings;