import React, { useEffect, useState, useMemo } from 'react';
import { Player } from '../types';
import { ACHIEVEMENTS_LIST, calculatePlayerStats, PlayerStats } from '../data/achievements';
import { matchService } from '../services/matchService';
import { rankingService } from '../services/rankingService';
import { playerService } from '../services/playerService';
import { Lock, Unlock, BarChart3, ArrowUpDown, Filter, Check, X, Star, Trash2, Ban } from 'lucide-react'; // Adicione Ban ou Trash2

interface AchievementsProps {
  player: Player;
}

const Achievements: React.FC<AchievementsProps> = ({ player }) => {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [manualUnlocks, setManualUnlocks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [featuredId, setFeaturedId] = useState<string | null>(player.featured_achievement_id || null);
  const [isSaving, setIsSaving] = useState(false);

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  useEffect(() => { loadData(); }, [player]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matches, hall, manualList] = await Promise.all([
        matchService.getAll(),
        rankingService.getHallOfFame(),
        playerService.getManualAchievements(player.id)
      ]);
      const calculatedStats = calculatePlayerStats(player.id, matches, hall);
      setStats(calculatedStats);
      setManualUnlocks(manualList);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // Função genérica: Equipar (string) ou Remover (null)
  const handleToggleAchievement = async (achievId: string, isEquipping: boolean) => {
      setIsSaving(true);
      try {
          if (!player.id) throw new Error("ID inválido");
          
          const newValue = isEquipping ? achievId : null; // Se for equipar, manda ID. Se for remover, manda null.
          
          await playerService.updateFeaturedAchievement(player.id, newValue);
          
          setFeaturedId(newValue);
          setConfirmingId(null);
          setActiveTooltip(null);
      } catch (error: any) {
          alert("Erro ao salvar: " + error.message);
      } finally {
          setIsSaving(false);
      }
  };

  const getIconStyles = (level: string, isUnlocked: boolean) => {
    if (!isUnlocked) return "text-slate-700 drop-shadow-none"; 
    switch (level) {
      case 'Bronze': return "text-amber-700 drop-shadow-sm filter"; 
      case 'Prata': return "text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] filter"; 
      case 'Esmeralda': return "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)] filter"; 
      case 'Elite': return "text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] filter"; 
      default: return "text-slate-400";
    }
  };

  const getLevelBadgeColor = (level: string) => {
      switch (level) {
          case 'Bronze': return 'bg-amber-900/50 text-amber-500 border-amber-700/50';
          case 'Prata': return 'bg-slate-700/50 text-slate-300 border-slate-500/50';
          case 'Esmeralda': return 'bg-emerald-900/50 text-emerald-400 border-emerald-600/50';
          case 'Elite': return 'bg-yellow-900/50 text-yellow-400 border-yellow-600/50';
          default: return 'bg-slate-800 text-slate-500';
      }
  };
  
  const getPositionClasses = (index: number) => {
      const colIndex = index % 3;
      if (colIndex === 0) return { tooltip: 'left-0 origin-bottom-left', arrow: 'left-6' };
      else if (colIndex === 2) return { tooltip: 'right-0 origin-bottom-right', arrow: 'right-6' };
      else return { tooltip: 'left-1/2 -translate-x-1/2 origin-bottom', arrow: 'left-1/2 -translate-x-1/2' };
  };

  const filteredAndSortedList = useMemo(() => {
      if (!stats) return [];
      let list = [...ACHIEVEMENTS_LIST];
      if (selectedCategory !== 'Todos') list = list.filter(a => a.category === selectedCategory);
      
      const levelWeights: Record<string, number> = { 'Elite': 4, 'Esmeralda': 3, 'Prata': 2, 'Bronze': 1 };
      
      list.sort((a, b) => {
          const playerHasA = a.condition(stats) || manualUnlocks.includes(a.id);
          const playerHasB = b.condition(stats) || manualUnlocks.includes(b.id);
          const weightA = levelWeights[a.level];
          const weightB = levelWeights[b.level];
          if (weightA === weightB) return a.title.localeCompare(b.title);
          return sortOrder === 'desc' ? weightB - weightA : weightA - weightB;
      });
      return list;
  }, [stats, selectedCategory, sortOrder, manualUnlocks]);

  if (loading || !stats) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const totalAchievements = ACHIEVEMENTS_LIST.length;
  const unlockedAchievements = ACHIEVEMENTS_LIST.filter(a => a.condition(stats) || manualUnlocks.includes(a.id)).length;
  const progressPercentage = Math.round((unlockedAchievements / totalAchievements) * 100) || 0;
  const eliteUnlocked = ACHIEVEMENTS_LIST.filter(a => a.level === 'Elite' && (a.condition(stats) || manualUnlocks.includes(a.id))).length;
  const categories = ['Todos', 'Gols', 'Assistências', 'Defesa', 'Vitórias', 'Fidelidade', 'Especiais'];

  return (
    <div className="animate-fade-in pb-24 px-4 pt-6 max-w-lg mx-auto">
      
      <div className="text-center mb-6">
        <h2 className="text-xs font-bold text-emerald-500 tracking-widest uppercase mb-1">Galeria de Troféus</h2>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Conquistas</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center gap-2 relative overflow-hidden group shadow-lg">
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-50"></div>
             <Unlock size={20} className="text-emerald-400 relative z-10" />
             <div className="text-center relative z-10">
                <span className="block text-2xl font-black text-white leading-none tracking-tight">{unlockedAchievements}<span className="text-sm text-slate-400 font-bold">/{totalAchievements}</span></span>
                <span className="text-[9px] text-slate-300 uppercase tracking-wider font-bold">Desbloqueadas</span>
             </div>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center gap-2 relative overflow-hidden group shadow-lg">
             <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-50"></div>
             <BarChart3 size={20} className="text-blue-400 relative z-10" />
             <div className="text-center relative z-10 w-full px-2">
                <span className="block text-2xl font-black text-white leading-none tracking-tight mb-1">{progressPercentage}%</span>
                <div className="h-1.5 w-full bg-slate-900/50 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
                </div>
                <span className="text-[9px] text-slate-300 uppercase tracking-wider font-bold block mt-1">Progresso</span>
             </div>
          </div>
           <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center gap-2 relative overflow-hidden group shadow-lg">
             <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-50"></div>
             <Star size={20} className="text-yellow-400 relative z-10 animate-pulse" fill="currentColor" />
             <div className="text-center relative z-10">
                <span className="block text-2xl font-black text-white leading-none tracking-tight">{eliteUnlocked}</span>
                <span className="text-[9px] text-slate-300 uppercase tracking-wider font-bold">Elites</span>
             </div>
          </div>
      </div>

      <div className="mb-6 sticky top-16 z-30 bg-slate-900/90 backdrop-blur py-2 -mx-4 px-4 border-b border-slate-800/50">
          <div className="flex justify-between items-center mb-3">
             <div className="flex items-center gap-2"><Filter size={16} className="text-emerald-500" /><span className="text-xs font-bold text-white uppercase tracking-wider">Filtros</span></div>
             <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"><ArrowUpDown size={12} className="text-emerald-400" />{sortOrder === 'desc' ? 'Mais Raras' : 'Mais Comuns'}</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar mask-image-horizontal">
             {categories.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${selectedCategory === cat ? 'bg-emerald-500 text-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}>{cat}</button>))}
          </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {filteredAndSortedList.map((achiev, index) => {
            const isManuallyUnlocked = manualUnlocks.includes(achiev.id);
            const isUnlocked = achiev.condition(stats) || isManuallyUnlocked;
            const progress = isManuallyUnlocked ? 100 : achiev.progress(stats);
            const Icon = achiev.icon;
            
            const posClasses = getPositionClasses(index);
            const isActive = activeTooltip === achiev.id;
            const isConfirming = confirmingId === achiev.id;
            const isEquipped = featuredId === achiev.id;
            
            return (
                <div 
                    key={achiev.id} 
                    className="relative group" 
                    style={{ zIndex: isActive ? 50 : 0 }} 
                    onMouseEnter={() => { if (!isConfirming) setActiveTooltip(achiev.id); }}
                    onMouseLeave={() => { if (!isConfirming) { setActiveTooltip(null); setConfirmingId(null); } }}
                    onClick={(e) => { e.stopPropagation(); if (isConfirming) setConfirmingId(null); else setActiveTooltip(isActive ? null : achiev.id); }}
                >
                    <div className={`aspect-square rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300 border cursor-pointer relative ${isUnlocked ? 'bg-slate-800 border-slate-700 shadow-lg' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                        {isEquipped && (<div className="absolute top-1 right-1 bg-yellow-500 text-slate-900 rounded-full p-0.5 z-20 shadow-lg animate-pulse"><Star size={8} fill="currentColor" /></div>)}
                        
                        <div className={`mb-2 transition-transform duration-500 ${isActive ? 'scale-110' : ''}`}>
                            {isUnlocked ? (
                                achiev.imageUrl ? <img src={achiev.imageUrl} alt={achiev.title} className="w-8 h-8 object-contain drop-shadow-md" /> : <Icon size={32} className={`${getIconStyles(achiev.level, true)}`} />
                            ) : (<Lock size={24} className="text-slate-700" />)}
                        </div>
                        <span className={`text-[10px] font-bold leading-tight line-clamp-2 px-1 text-center ${isUnlocked ? 'text-slate-300' : 'text-slate-600'}`}>{achiev.title}</span>
                        {isUnlocked && <div className={`absolute -bottom-4 -right-4 w-12 h-12 blur-xl opacity-20 pointer-events-none rounded-full ${achiev.level === 'Elite' ? 'bg-yellow-500' : achiev.level === 'Esmeralda' ? 'bg-emerald-500' : achiev.level === 'Prata' ? 'bg-slate-100' : 'bg-amber-600'}`}></div>}
                    </div>

                    <div className={`absolute bottom-[105%] w-48 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-0 transition-all duration-200 transform ${posClasses.tooltip} ${isActive ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}
                        onClick={(e) => { e.stopPropagation(); if (isUnlocked && !isConfirming) setConfirmingId(achiev.id); }}
                    >
                        <div className={`absolute bottom-[-6px] w-3 h-3 bg-slate-800 border-r border-b border-slate-600 transform rotate-45 ${posClasses.arrow}`}></div>
                        <div className="relative z-10 overflow-hidden rounded-xl">
                            {isConfirming ? (
                                <div className="p-3 flex flex-col items-center bg-slate-900/95 backdrop-blur-md animate-fade-in text-center h-full">
                                    {/* MUDANÇA DE UI: Se já estiver equipado, mostra opção de Remover */}
                                    <span className="text-xs font-bold text-white mb-1">
                                        {isEquipped ? "Remover Destaque?" : "Ostentar Conquista?"}
                                    </span>
                                    <p className="text-[9px] text-slate-400 mb-3 leading-tight">
                                        {isEquipped 
                                            ? "Retirar este ícone do seu perfil na Home." 
                                            : "Exibir este ícone no seu perfil da Home."}
                                    </p>
                                    <div className="flex gap-2 w-full">
                                        <button onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }} className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-bold"><X size={12} className="mx-auto" /></button>
                                        
                                        {/* Botão Dinâmico: Confirmar (Verde) ou Remover (Vermelho) */}
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                // Se já equipado, passa 'false' para desequipar. Se não, 'true' para equipar.
                                                handleToggleAchievement(achiev.id, !isEquipped); 
                                            }} 
                                            disabled={isSaving} 
                                            className={`flex-1 py-1.5 rounded text-[10px] font-bold shadow-lg transition-colors ${
                                                isEquipped 
                                                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
                                                : "bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/20"
                                            }`}
                                        >
                                            {isSaving ? '...' : (isEquipped ? <Ban size={12} className="mx-auto" /> : <Check size={12} className="mx-auto" />)}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 flex flex-col items-center text-center">
                                    <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mb-2 border ${getLevelBadgeColor(achiev.level)}`}>{achiev.level}</div>
                                    <h4 className="text-sm font-bold text-white mb-1 leading-tight">{achiev.title}</h4>
                                    <p className="text-[10px] text-slate-400 mb-3 leading-snug">{achiev.description}</p>
                                    
                                    {isUnlocked ? (
                                        isEquipped ? (<div className="text-[9px] text-yellow-500 font-bold flex items-center gap-1 cursor-pointer animate-pulse"><Star size={10} fill="currentColor" /> Ostentando (Toque p/ tirar)</div>) : (<div className="text-[9px] text-emerald-400 font-bold animate-pulse cursor-pointer">Toque para Ostentar</div>)
                                    ) : (
                                        <div className="w-full">
                                            {achiev.category === 'Especiais' ? (
                                                <span className="text-[9px] text-slate-500 italic">Desbloqueio Manual / Especial</span>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between text-[9px] text-slate-500 font-bold mb-0.5"><span>Progresso</span><span>{Math.round(progress)}%</span></div>
                                                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700"><div className={`h-full ${isUnlocked ? 'bg-emerald-500' : 'bg-slate-600'}`} style={{ width: `${progress}%` }}></div></div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default Achievements;