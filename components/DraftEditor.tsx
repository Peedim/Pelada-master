
import React, { useEffect, useState } from 'react';
import { Match, Player } from '../types';
import { matchService } from '../services/matchService';
import { playerService } from '../services/playerService';
import { ArrowLeft, Trash2, Plus, Play, Trophy, UserPlus, X, Zap, Loader2, AlertTriangle } from 'lucide-react';

interface DraftEditorProps {
  matchId: string;
  onBack: () => void;
  onPublish: (matchId: string) => void;
  isLoading?: boolean;
}

const DraftEditor: React.FC<DraftEditorProps> = ({ matchId, onBack, onPublish, isLoading = false }) => {
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [matchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matchData, playersData] = await Promise.all([
        matchService.getById(matchId),
        playerService.getAll()
      ]);
      setMatch(matchData);
      setAllPlayers(playersData);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar dados do rascunho.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePlayer = async (teamId: string, playerId: string) => {
    if (!match) return;
    try {
        const updatedMatch = await matchService.removePlayerFromTeam(match.id, teamId, playerId);
        setMatch({...updatedMatch}); // Trigger re-render
    } catch (e) {
        console.error(e);
    }
  };

  const handleOpenAddModal = (teamId: string) => {
    setTargetTeamId(teamId);
    setSearchTerm('');
    setIsAddModalOpen(true);
  };

  const handleAddPlayer = async (player: Player) => {
    if (!match || !targetTeamId) return;
    try {
        const updatedMatch = await matchService.addPlayerToTeam(match.id, targetTeamId, player);
        setMatch({...updatedMatch});
        setIsAddModalOpen(false);
    } catch (e) {
        console.error(e);
    }
  };

  const handlePublishClick = () => {
    if (!match) return;
    setIsConfirmModalOpen(true);
  };

  const confirmPublish = () => {
      if (match) {
          setIsConfirmModalOpen(false);
          onPublish(match.id);
      }
  };

  // Get players currently in the match to filter them out of the add list
  const getPlayersInMatch = (): Set<string> => {
    if (!match) return new Set();
    const ids = new Set<string>();
    match.teams.forEach(t => t.players.forEach(p => ids.add(p.id)));
    return ids;
  };

  const availablePlayers = allPlayers.filter(p => {
    const inMatch = getPlayersInMatch().has(p.id);
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return !inMatch && matchesSearch;
  });

  if (loading || !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in space-y-6">
        <div className="relative">
          {/* Anel Externo */}
          <div className="w-20 h-20 border-4 border-slate-700 border-t-green-500 rounded-full animate-spin"></div>
          {/* Ícone Central Estático */}
          <div className="absolute inset-0 flex items-center justify-center text-slate-600">
             <Trophy size={24} />
          </div>
        </div>
        <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">Preparando Prancheta Tática</h3>
            <p className="text-slate-400 text-sm animate-pulse">Carregando escalações e calculando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-white">Editar Times</h2>
                    <p className="text-slate-400 text-sm">
                        {match.type} • {new Date(match.date).toLocaleDateString()} • {match.location}
                    </p>
                </div>
            </div>
            
            <button 
                onClick={handlePublishClick}
                disabled={isLoading}
                className={`flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-md font-bold shadow-lg shadow-green-900/30 transition-all active:scale-95 ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
            >
                {isLoading ? (
                    <>
                        <Loader2 size={18} className="animate-spin" />
                        Criando...
                    </>
                ) : (
                    <>
                        <Play size={18} fill="currentColor" />
                        CRIAR EVENTO OFICIAL
                    </>
                )}
            </button>
        </div>

        {/* Teams Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${match.teams.length > 2 ? 'xl:grid-cols-2' : ''} gap-6`}>
            {match.teams.map(team => (
                <div key={team.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
                    {/* Team Header */}
                    <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <div className="h-8 w-1 bg-green-500 rounded-full"></div>
                             <h3 className="font-bold text-lg text-white">{team.name}</h3>
                        </div>
                        <div className="text-right">
                            <span className="block text-xl font-bold text-white">{team.avgOvr}</span>
                            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">MÉDIA</span>
                        </div>
                    </div>

                    {/* Player List */}
                    <div className="divide-y divide-slate-700/50 bg-slate-800/50">
                        {team.players.map(player => (
                            <div key={player.id} className="p-3 flex items-center justify-between hover:bg-slate-700/30 group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                        {player.position.substring(0, 3).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-200 truncate">{player.name}</p>
                                        {player.playStyle && (
                                            <span className="text-[10px] text-yellow-500/80 flex items-center gap-0.5">
                                                <Zap size={8} /> {player.playStyle}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-sm text-slate-400">{player.initial_ovr}</span>
                                    <button 
                                        onClick={() => handleRemovePlayer(team.id, player.id)}
                                        className="text-slate-600 hover:text-red-500 transition-colors p-1"
                                        title="Remover jogador"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Player Button */}
                    <div className="p-3 bg-slate-900/30 border-t border-slate-700 mt-auto">
                        <button 
                            onClick={() => handleOpenAddModal(team.id)}
                            className="w-full py-2 border border-dashed border-slate-600 rounded text-slate-400 text-sm hover:text-white hover:border-slate-400 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Adicionar Jogador
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Add Player Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <UserPlus className="text-green-500" size={20} />
                            Adicionar Jogador
                        </h3>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-4 border-b border-slate-700">
                        <input 
                            type="text" 
                            placeholder="Buscar disponível..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-1 focus:ring-green-500 outline-none"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {availablePlayers.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">Nenhum jogador disponível.</div>
                        ) : (
                            availablePlayers.map(p => (
                                <div 
                                    key={p.id}
                                    onClick={() => handleAddPlayer(p)}
                                    className="p-3 rounded hover:bg-slate-700 cursor-pointer flex items-center justify-between group transition-colors"
                                >
                                    <div>
                                        <p className="text-white font-medium text-sm">{p.name}</p>
                                        <p className="text-xs text-slate-400">{p.position} • OVR {p.initial_ovr}</p>
                                    </div>
                                    <Plus size={18} className="text-slate-500 group-hover:text-green-500" />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Confirmation Modal */}
        {isConfirmModalOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                 <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                     <div className="flex flex-col items-center text-center space-y-4">
                         <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center border border-yellow-700/50">
                             <AlertTriangle size={32} className="text-yellow-500" />
                         </div>
                         
                         <div>
                             <h3 className="text-xl font-bold text-white">Oficializar Evento?</h3>
                             <p className="text-slate-400 text-sm mt-2">
                                 Ao confirmar, os times serão travados e a tabela de jogos será gerada automaticamente.
                             </p>
                         </div>

                         <div className="flex gap-3 w-full mt-4">
                             <button 
                                 onClick={() => setIsConfirmModalOpen(false)}
                                 className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                             >
                                 Cancelar
                             </button>
                             <button 
                                 onClick={confirmPublish}
                                 className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95"
                             >
                                 Sim, Criar
                             </button>
                         </div>
                     </div>
                 </div>
             </div>
        )}

    </div>
  );
};

export default DraftEditor;
