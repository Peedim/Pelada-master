import React, { useEffect, useState } from 'react';
import { Match, MatchStatus } from '../types';
import { matchService } from '../services/matchService';
import { Calendar, MapPin, Users, ArrowRight, Trash2, AlertCircle, Loader2, AlertTriangle, PlayCircle, Edit } from 'lucide-react';

interface DraftListProps {
  onSelectMatch: (match: Match) => void; // Mudamos para receber o objeto Match inteiro
}

const DraftList: React.FC<DraftListProps> = ({ onSelectMatch }) => {
  const [drafts, setDrafts] = useState<Match[]>([]);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);

  const loadMatches = async () => {
    if (drafts.length === 0 && activeMatches.length === 0) setLoading(true);
    try {
        const allMatches = await matchService.getAll();
        
        // Separa Rascunhos de Ativos
        const sortedDrafts = allMatches
            .filter(m => m.status === MatchStatus.DRAFT)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
        const sortedActive = allMatches
            .filter(m => m.status === MatchStatus.OPEN)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setDrafts(sortedDrafts);
        setActiveMatches(sortedActive);
    } catch (error) {
        console.error("Failed to load matches", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    setMatchToDelete(id);
  };

  const confirmDelete = async () => {
    if (!matchToDelete) return;
    
    setDeletingId(matchToDelete);
    setMatchToDelete(null);

    try {
        await matchService.deleteMatch(matchToDelete);
        await loadMatches(); 
    } catch (error) {
        console.error("Erro ao excluir evento", error);
        alert("Ocorreu um erro ao tentar excluir.");
    } finally {
        setDeletingId(null);
    }
  };

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm animate-pulse">Carregando eventos...</p>
        </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in pb-20">
      
      <div className="mb-8 flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Calendar className="text-blue-500" />
                Gerenciar Eventos
            </h2>
            <p className="text-slate-400 text-sm mt-1">
                Acesse jogos em andamento ou edite rascunhos pendentes.
            </p>
        </div>
      </div>

      {/* --- SEÇÃO: EM ANDAMENTO --- */}
      {activeMatches.length > 0 && (
        <div className="mb-10">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Em Andamento
            </h3>
            <div className="grid gap-4">
                {activeMatches.map(match => (
                    <div 
                        key={match.id}
                        onClick={() => onSelectMatch(match)}
                        className="bg-slate-800 border border-green-500/30 hover:border-green-500 rounded-lg p-5 cursor-pointer transition-all hover:bg-slate-750 group relative overflow-hidden shadow-lg shadow-green-900/10"
                    >
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1">
                                        Ao Vivo
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {match.type}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-green-400 transition-colors">
                                    {match.location || 'Local indefinido'}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {new Date(match.date).toLocaleDateString()}
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <span className="block text-2xl font-bold text-white">{match.goals?.length || 0}</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Gols</span>
                                </div>
                                <div className="h-10 w-10 bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <PlayCircle size={24} fill="currentColor" className="text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* --- SEÇÃO: RASCUNHOS --- */}
      <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Edit size={14} />
              Rascunhos Salvos
          </h3>
          
          {drafts.length === 0 ? (
            <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-lg p-8 text-center">
                <p className="text-slate-500 text-sm">Nenhum rascunho pendente.</p>
            </div>
          ) : (
            <div className="grid gap-4">
                {drafts.map(draft => (
                    <div 
                        key={draft.id}
                        onClick={() => onSelectMatch(draft)}
                        className="bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-lg p-5 cursor-pointer transition-all hover:bg-slate-750 group relative"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-[10px] text-yellow-500 font-bold bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-800/50 uppercase tracking-wider">
                                        Rascunho
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {draft.type}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                                    {new Date(draft.date).toLocaleDateString()}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-slate-400 mt-2">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin size={14} /> {draft.location || 'Local não definido'}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Users size={14} /> {draft.teams.reduce((acc, t) => acc + t.players.length, 0)} Jogadores
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 self-center">
                                <button
                                    onClick={(e) => requestDelete(e, draft.id)}
                                    disabled={deletingId === draft.id}
                                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all"
                                >
                                    {deletingId === draft.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                </button>
                                <ArrowRight size={20} className="text-slate-600 group-hover:text-blue-500" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {matchToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center border border-red-700/50">
                          <AlertTriangle size={32} className="text-red-500" />
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-white">Excluir Evento?</h3>
                          <p className="text-slate-400 text-sm mt-2">Esta ação não pode ser desfeita.</p>
                      </div>
                      <div className="flex gap-3 w-full mt-4">
                          <button onClick={() => setMatchToDelete(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Cancelar</button>
                          <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold">Excluir</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DraftList;