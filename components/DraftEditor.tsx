import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Match, Player, PlayerPosition } from '../types';
import { matchService } from '../services/matchService';
import { playerService } from '../services/playerService';
import { ArrowLeft, Trash2, Plus, Play, Trophy, UserPlus, X, Zap, Loader2, AlertTriangle, Image as ImageIcon, Shirt } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { saveAs } from 'file-saver';

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, [matchId]);
  const loadData = async () => { setLoading(true); try { const [m, p] = await Promise.all([matchService.getById(matchId), playerService.getAll()]); setMatch(m); setAllPlayers(p); } catch (e) { console.error(e); alert("Erro ao carregar."); } finally { setLoading(false); } };
  const handleRemovePlayer = async (teamId: string, playerId: string) => { if (!match) return; const u = await matchService.removePlayerFromTeam(match.id, teamId, playerId); setMatch({...u}); };
  const handleOpenAddModal = (teamId: string) => { setTargetTeamId(teamId); setSearchTerm(''); setIsAddModalOpen(true); };
  const handleAddPlayer = async (player: Player) => { if (!match || !targetTeamId) return; const u = await matchService.addPlayerToTeam(match.id, targetTeamId, player); setMatch({...u}); setIsAddModalOpen(false); };
  const handlePublishClick = () => { if (!match) return; setIsConfirmModalOpen(true); };
  const confirmPublish = () => { if (match) { setIsConfirmModalOpen(false); onPublish(match.id); } };

  const handleExportImage = async () => {
      if (exportRef.current === null || isExporting) return;
      setIsExporting(true);
      try {
          const dataUrl = await htmlToImage.toPng(exportRef.current, { cacheBust: true, backgroundColor: '#0f172a', style: { padding: '20px' } });
          saveAs(dataUrl, `Escalacao_Oficial_${new Date().toISOString().split('T')[0]}.png`);
      } catch (err) { console.error('Erro ao exportar:', err); alert('Erro ao gerar imagem.'); } finally { setIsExporting(false); }
  };

  const getPlayersInMatch = (): Set<string> => { if (!match) return new Set(); const ids = new Set<string>(); match.teams.forEach(t => t.players.forEach(p => ids.add(p.id))); return ids; };
  const availablePlayers = allPlayers.filter(p => { const inMatch = getPlayersInMatch().has(p.id); const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()); return !inMatch && matchesSearch; });
  const getOvrColor = (ovr: number) => { if (ovr >= 80) return 'text-green-400'; if (ovr >= 70) return 'text-yellow-400'; if (ovr < 60) return 'text-red-400'; return 'text-slate-300'; };
  
  // Helper de Cores
  const getTeamStyle = (name: string) => {
      if (name.includes('Branco')) return { bgHeader: 'bg-slate-100', textHeader: 'text-slate-900', border: 'border-slate-300' };
      if (name.includes('Preto')) return { bgHeader: 'bg-slate-950', textHeader: 'text-white', border: 'border-slate-700' };
      if (name.includes('Vermelho')) return { bgHeader: 'bg-red-700', textHeader: 'text-white', border: 'border-red-600' };
      if (name.includes('Azul')) return { bgHeader: 'bg-blue-700', textHeader: 'text-white', border: 'border-blue-600' };
      return { bgHeader: 'bg-slate-800', textHeader: 'text-white', border: 'border-slate-700' };
  };

  if (loading || !match) return <div className="flex flex-col items-center justify-center min-h-[60vh]"><Loader2 size={48} className="text-green-500 animate-spin" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3"><button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><ArrowLeft size={24} /></button><div><h2 className="text-2xl font-bold text-white">Editar Times</h2><p className="text-slate-400 text-sm">{match.type} • {match.location}</p></div></div>
            <div className="flex gap-3">
                <button onClick={handleExportImage} disabled={isExporting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-md font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50">{isExporting ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}<span className="hidden sm:inline">Baixar Imagem</span></button>
                <button onClick={handlePublishClick} disabled={isLoading} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-md font-bold shadow-lg shadow-green-900/30 transition-all active:scale-95 disabled:opacity-70">{isLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}<span className="hidden sm:inline">CRIAR EVENTO</span></button>
            </div>
        </div>

        <div ref={exportRef} className="bg-slate-900 p-4 rounded-xl border border-slate-800/50">
            <div className="text-center mb-6"><h2 className="text-2xl font-bold text-white tracking-tight uppercase">Escalação Oficial</h2><p className="text-slate-400 text-sm">{new Date(match.date).toLocaleDateString()} - {match.location}</p></div>
            
            {/* REMOVIDO TABELA SEPARADA DE GOLEIROS AQUI */}

            <div className={`grid grid-cols-1 md:grid-cols-2 ${match.teams.length > 2 ? 'xl:grid-cols-2' : ''} gap-6`}>
                {match.teams.map(team => {
                    const style = getTeamStyle(team.name);
                    return (
                        <div key={team.id} className={`bg-slate-800 border ${style.border} rounded-lg overflow-hidden flex flex-col`}>
                            <div className={`${style.bgHeader} p-3 border-b ${style.border} flex justify-between items-center`}>
                                <h3 className={`font-bold text-lg ${style.textHeader}`}>{team.name}</h3>
                                <div className="text-right"><span className={`block text-xl font-bold leading-none ${style.textHeader}`}>{team.avgOvr}</span><span className="text-[9px] uppercase text-slate-500 font-bold tracking-wider">MÉDIA</span></div>
                            </div>
                            <div className="divide-y divide-slate-700/50 bg-slate-800/50 flex-1">
                                {/* REMOVIDO FILTRO DE GOLEIROS AQUI */}
                                {team.players.map(player => (
                                    <div key={player.id} className="p-2.5 flex items-center justify-between hover:bg-slate-700/30 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {/* Badge de Posição com cor especial para Goleiro */}
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${player.position === PlayerPosition.GOLEIRO ? 'bg-yellow-600' : 'bg-slate-700'}`}>
                                                {player.position.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-medium truncate ${player.position === PlayerPosition.GOLEIRO ? 'text-yellow-500' : 'text-slate-200'}`}>
                                                    {player.name}
                                                </p>
                                                {player.playStyle && (<span className="text-[9px] text-yellow-500/80 flex items-center gap-0.5"><Zap size={8} /> {player.playStyle}</span>)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3"><span className={`font-bold text-sm ${getOvrColor(player.initial_ovr)}`}>{player.initial_ovr}</span><button onClick={() => handleRemovePlayer(team.id, player.id)} className="text-slate-600 hover:text-red-500 transition-colors p-1" title="Remover"><Trash2 size={14} /></button></div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-2 bg-slate-900/30 border-t border-slate-700 mt-auto"><button onClick={() => handleOpenAddModal(team.id)} className="w-full py-1.5 border border-dashed border-slate-600 rounded text-slate-400 text-xs hover:text-white hover:border-slate-400 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><Plus size={14} /> Adicionar Jogador</button></div>
                        </div>
                    );
                })}
            </div>
        </div>

        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><UserPlus className="text-green-500" size={20} /> Adicionar Jogador</h3><button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button></div>
                    <div className="p-4 border-b border-slate-700"><input type="text" placeholder="Buscar disponível..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-1 focus:ring-green-500 outline-none" /></div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">{availablePlayers.length === 0 ? <div className="text-center py-8 text-slate-500">Nenhum jogador disponível.</div> : availablePlayers.map(p => (<div key={p.id} onClick={() => handleAddPlayer(p)} className="p-3 rounded hover:bg-slate-700 cursor-pointer flex items-center justify-between group transition-colors"><div><p className="text-white font-medium text-sm">{p.name}</p><p className="text-xs text-slate-400">{p.position} • OVR {p.initial_ovr}</p></div><Plus size={18} className="text-slate-500 group-hover:text-green-500" /></div>))}</div>
                </div>
            </div>
        )}
        {isConfirmModalOpen && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"><div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100"><div className="flex flex-col items-center text-center space-y-4"><div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center border border-yellow-700/50"><AlertTriangle size={32} className="text-yellow-500" /></div><div><h3 className="text-xl font-bold text-white">Oficializar Evento?</h3><p className="text-slate-400 text-sm mt-2">Ao confirmar, os times serão travados e a tabela de jogos será gerada automaticamente.</p></div><div className="flex gap-3 w-full mt-4"><button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Cancelar</button><button onClick={confirmPublish} className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95">Sim, Criar</button></div></div></div></div>)}
    </div>
  );
};

export default DraftEditor;