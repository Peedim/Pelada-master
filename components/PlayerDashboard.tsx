
import React, { useMemo, useState } from 'react';
import { Player, PlayerPosition } from '../types';
import { playerService } from '../services/playerService';
import { Search, UserPlus, Users, Shield, List, Zap, CalendarClock } from 'lucide-react';

interface PlayerDashboardProps {
  players: Player[];
  onAddPlayer: () => void;
  onEditPlayer: (player: Player) => void;
}

const PlayerDashboard: React.FC<PlayerDashboardProps> = ({ players, onAddPlayer, onEditPlayer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessingMonth, setIsProcessingMonth] = useState(false);

  // Stats Calculations
  const stats = useMemo(() => {
    const total = players.length;
    const avgOvr = total > 0 
      ? Math.round(players.reduce((acc, p) => acc + p.initial_ovr, 0) / total) 
      : 0;
    const goalkeepers = players.filter(p => p.position === PlayerPosition.GOLEIRO).length;
    const attackers = players.filter(p => p.position === PlayerPosition.ATACANTE).length;

    return { total, avgOvr, goalkeepers, attackers };
  }, [players]);

  // Filtering (Removed Sorting UI to match the clean reference image, but keeping logic implies default sort)
  const filteredPlayers = useMemo(() => {
    return players.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.initial_ovr - a.initial_ovr); // Default sort by OVR desc
  }, [players, searchTerm]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 1) // Reference shows 1 letter usually, but 2 is fine. Let's stick to 1-2 chars.
      .join('')
      .toUpperCase();
  };

  const handleMonthlyUpdate = async () => {
      const confirmed = window.confirm("ATENÇÃO: Isso irá aplicar as mudanças de OVR acumuladas no mês para TODOS os jogadores. Deseja continuar?");
      if (!confirmed) return;

      setIsProcessingMonth(true);
      try {
          const result = await playerService.processMonthlyUpdate();
          alert(result);
          window.location.reload(); // Force reload to show new stats
      } catch (error) {
          console.error(error);
          alert("Erro ao processar virada de mês.");
      } finally {
          setIsProcessingMonth(false);
      }
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-20 animate-fade-in">
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div>
           <h1 className="text-3xl font-bold text-white flex items-center gap-2">
             <Users className="text-cyan-400" size={28} />
             Jogadores
           </h1>
           <p className="text-slate-400 text-sm mt-1">{players.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleMonthlyUpdate}
                disabled={isProcessingMonth}
                className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg shadow-lg border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
                title="Virada de Mês (Atualizar OVR)"
            >
                <CalendarClock size={24} className={isProcessingMonth ? 'animate-spin' : 'text-yellow-500'} />
            </button>
            <button 
            onClick={onAddPlayer}
            className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-lg shadow-lg shadow-cyan-900/20 transition-all active:scale-95"
            >
            <UserPlus size={24} />
            </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search size={20} className="text-slate-500" />
        </div>
        <input
          type="text"
          placeholder="Buscar jogador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-11 pr-4 py-4 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all shadow-sm"
        />
      </div>

      {/* Stats Grid (4 Cols) */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {/* Total */}
        <div className="bg-slate-800 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-700/50">
          <span className="text-xl font-bold text-cyan-400">{stats.total}</span>
          <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">TOTAL</span>
        </div>
        
        {/* Média */}
        <div className="bg-slate-800 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-700/50">
          <span className="text-xl font-bold text-emerald-400">{stats.avgOvr}</span>
          <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">MÉDIA</span>
        </div>

        {/* Goleiros (GOL) */}
        <div className="bg-slate-800 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-700/50">
          <span className="text-xl font-bold text-yellow-400">{stats.goalkeepers}</span>
          <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">GOL</span>
        </div>

        {/* Atacantes (ATA) */}
        <div className="bg-slate-800 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-700/50">
          <span className="text-xl font-bold text-red-400">{stats.attackers}</span>
          <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">ATA</span>
        </div>
      </div>

      {/* List Section */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <List size={20} className="text-slate-400"/> 
          Lista
        </h3>

        <div className="space-y-3">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-10 text-slate-500 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
              Nenhum jogador encontrado.
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <div 
                key={player.id} 
                onClick={() => onEditPlayer(player)}
                className="bg-slate-800 rounded-xl p-4 flex items-center justify-between border border-slate-700/50 hover:bg-slate-700/50 transition-colors cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
                    {player.photo_url ? (
                        <img src={player.photo_url} alt={player.name} className="w-full h-full object-contain" />
                    ) : (
                        getInitials(player.name)
                    )}
                  </div>
                  
                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{player.name}</span>
                      {player.is_admin && (
                         <Shield size={12} className="text-purple-400 fill-purple-400/20" />
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 bg-slate-900 text-slate-400 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-700 mt-1">
                      {player.playStyle ? (
                         <>
                           <Zap size={10} className="text-yellow-500 fill-yellow-500/20" />
                           {player.playStyle}
                         </>
                      ) : (
                         player.position
                      )}
                    </span>
                  </div>
                </div>

                {/* Right Side - OVR */}
                <div className="text-center min-w-[3rem]">
                   <span className="block text-xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                     {player.initial_ovr}
                   </span>
                   <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                     OVR
                   </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default PlayerDashboard;
