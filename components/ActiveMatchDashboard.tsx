import React, { useEffect, useState, useMemo } from 'react';
import { GameStatus, Match, GamePhase, Standing, MatchStatus, Game } from '../types';
import { matchService } from '../services/matchService';
import LiveMatchControl from './LiveMatchControl';
import { ArrowLeft, Trophy, Calendar, List, PlayCircle, CheckCircle2, AlertCircle, Archive, AlertTriangle, Trash2 } from 'lucide-react';

interface ActiveMatchDashboardProps {
  matchId: string;
  onBack: () => void;
  onMatchUpdate?: () => void;
}

const ActiveMatchDashboard: React.FC<ActiveMatchDashboardProps> = ({ matchId, onBack, onMatchUpdate }) => {
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'games' | 'standings'>('games');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [isFinishEventConfirmOpen, setIsFinishEventConfirmOpen] = useState(false);
  const [isCancelEventConfirmOpen, setIsCancelEventConfirmOpen] = useState(false);

  useEffect(() => {
    loadMatch();
  }, [matchId]);

  const loadMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      await matchService.ensureFixtures(matchId);
      const data = await matchService.getById(matchId);
      if (!data) throw new Error("Evento não encontrado.");
      setMatch(data);
    } catch (e) {
      console.error(e);
      setError("Não foi possível carregar os dados do evento.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async (gameId: string) => {
    if (!match || match.status === MatchStatus.FINISHED) return;
    const updated = await matchService.startGame(match.id, gameId);
    setMatch({ ...updated });
  };

  const handleUpdateMatch = (updated: Match) => {
    setMatch({ ...updated });
  };

  // --- ACTIONS ---
  const handleFinishEventClick = () => {
    if (!match) return;
    setIsFinishEventConfirmOpen(true);
  };

  const confirmFinishEvent = async () => {
    if (!match) return;
    await matchService.finishMatch(match.id);
    setIsFinishEventConfirmOpen(false);
    if (onMatchUpdate) onMatchUpdate(); 
    onBack();
  };

  const handleCancelEventClick = () => {
      setIsCancelEventConfirmOpen(true);
  };

  const confirmCancelEvent = async () => {
      if (!match) return;
      await matchService.revertToDraft(match.id);
      setIsCancelEventConfirmOpen(false);
      if (onMatchUpdate) onMatchUpdate();
      onBack(); // Will return to main, then user can navigate to drafts to see it
  };

  const standings = useMemo(() => {
    if (!match) return [];
    return matchService.calculateStandings(match);
  }, [match]);

  const liveGame = match?.games.find(g => g.status === GameStatus.LIVE);
  
  const gamesByPhase = useMemo(() => {
      if (!match) return {};
      const groups: Record<string, Game[]> = {};
      
      const phaseLabels: Record<string, string> = {
          [GamePhase.PHASE_1]: 'Fase 1 (Pontos Corridos)',
          [GamePhase.PHASE_2]: 'Fase 2 (Intermediária)',
          [GamePhase.THIRD_PLACE]: 'Disputa de 3º Lugar',
          [GamePhase.FINAL]: 'Grande Final'
      };

      match.games.sort((a,b) => a.sequence - b.sequence).forEach(game => {
          const label = phaseLabels[game.phase] || 'Outros';
          if (!groups[label]) groups[label] = [];
          groups[label].push(game);
      });
      return groups;
  }, [match]);

  const getTeamName = (id: string) => {
      if (id === 'TBD') return 'A Definir';
      return match?.teams.find(t => t.id === id)?.name || 'Desconhecido';
  };

  if (loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
             <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-slate-400 animate-pulse">Carregando tabelas e jogos...</p>
        </div>
      );
  }

  if (error || !match) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            <div className="text-center"><h3 className="text-xl font-bold text-white">Erro ao carregar evento</h3></div>
            <button onClick={onBack} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"><ArrowLeft size={18} /> Voltar</button>
        </div>
    );
  }

  const isEventFinished = match.status === MatchStatus.FINISHED;
  const hasFinishedGames = match.games.some(g => g.status === GameStatus.FINISHED);

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><ArrowLeft size={24} /></button>
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    {isEventFinished ? (<div className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs uppercase">Finalizado</div>) : (<div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>)}
                    Evento Ativo
                </h2>
                <p className="text-slate-400 text-sm">{match.type} • {match.location}</p>
            </div>
        </div>
      </div>

      {liveGame && !isEventFinished && (<LiveMatchControl match={match} game={liveGame} onUpdate={handleUpdateMatch} />)}

      <div className="flex border-b border-slate-700 mb-6">
          <button onClick={() => setActiveTab('games')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'games' ? 'border-green-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}><div className="flex items-center gap-2"><List size={16} /> Jogos</div></button>
          <button onClick={() => setActiveTab('standings')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'standings' ? 'border-green-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}><div className="flex items-center gap-2"><Trophy size={16} /> Classificação</div></button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'games' && (
            <div className="space-y-8">
                {Object.entries(gamesByPhase).map(([phaseName, games]) => (
                    <div key={phaseName}>
                        <h3 className="text-green-500 text-sm font-bold uppercase tracking-wider mb-3 pl-1 border-l-2 border-green-500">{phaseName}</h3>
                        <div className="grid gap-3">
                            {games.map(game => (
                                <div key={game.id} className={`border p-4 rounded-lg flex items-center justify-between transition-colors ${game.status === GameStatus.FINISHED ? 'bg-slate-900/50 border-slate-800 opacity-75' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
                                    <div className="flex-1 flex items-center justify-end gap-3">
                                        <span className={`font-bold ${game.status === GameStatus.FINISHED && game.homeScore > game.awayScore ? 'text-green-400' : 'text-white'}`}>{getTeamName(game.homeTeamId)}</span>
                                        {game.status === GameStatus.FINISHED && (<span className="text-xl font-mono text-white bg-slate-800 px-2 rounded">{game.homeScore}</span>)}
                                    </div>
                                    <div className="px-4 flex flex-col items-center">{game.status === GameStatus.FINISHED ? (<span className="text-slate-600 text-xs">Final</span>) : (<span className="text-slate-500 font-bold text-sm">VS</span>)}</div>
                                    <div className="flex-1 flex items-center justify-start gap-3">
                                        {game.status === GameStatus.FINISHED && (<span className="text-xl font-mono text-white bg-slate-800 px-2 rounded">{game.awayScore}</span>)}
                                        <span className={`font-bold ${game.status === GameStatus.FINISHED && game.awayScore > game.homeScore ? 'text-green-400' : 'text-white'}`}>{getTeamName(game.awayTeamId)}</span>
                                    </div>
                                    <div className="ml-6 border-l border-slate-700 pl-6 w-24 text-center">
                                        {game.status === GameStatus.WAITING && (
                                            game.homeTeamId !== 'TBD' && game.awayTeamId !== 'TBD' && !isEventFinished ? (
                                                <button onClick={() => handleStartGame(game.id)} disabled={!!liveGame} className="bg-slate-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 w-full justify-center"><PlayCircle size={14} /> INICIAR</button>
                                            ) : (<span className="text-xs text-slate-500 italic">{game.homeTeamId === 'TBD' ? 'Aguardando' : 'Próximo'}</span>)
                                        )}
                                        {game.status === GameStatus.FINISHED && (<CheckCircle2 size={20} className="text-slate-600 mx-auto" />)}
                                        {game.status === GameStatus.LIVE && (<span className="text-xs text-red-500 font-bold animate-pulse">AO VIVO</span>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Tab Standings... (Existing code) */}
        {activeTab === 'standings' && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <div className="p-4 bg-slate-900 border-b border-slate-700 text-xs text-slate-400">* Pontuação soma Fase 1 e Fase 2. Finais são eliminatórias diretas.</div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900 text-slate-400 font-medium">
                        <tr>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3 text-center">PTS</th>
                            <th className="px-4 py-3 text-center">J</th>
                            <th className="px-4 py-3 text-center">V</th>
                            <th className="px-4 py-3 text-center">E</th>
                            <th className="px-4 py-3 text-center">D</th>
                            <th className="px-4 py-3 text-center">SG</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {standings.map((team, index) => (
                            <tr key={team.teamId} className="hover:bg-slate-700/30">
                                <td className="px-4 py-3 font-medium text-white flex items-center gap-2"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${index < 2 ? 'bg-yellow-900/50 text-yellow-500' : 'bg-slate-800 text-slate-500'}`}>{index + 1}</span>{team.teamName}</td>
                                <td className="px-4 py-3 text-center font-bold text-green-400">{team.points}</td>
                                <td className="px-4 py-3 text-center text-slate-300">{team.played}</td>
                                <td className="px-4 py-3 text-center text-slate-400">{team.wins}</td>
                                <td className="px-4 py-3 text-center text-slate-400">{team.draws}</td>
                                <td className="px-4 py-3 text-center text-slate-400">{team.losses}</td>
                                <td className="px-4 py-3 text-center text-slate-300">{team.goalDiff}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* Footer Actions: Cancel OR Finish */}
        {!isEventFinished && (
            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                 {hasFinishedGames ? (
                     <button 
                        onClick={handleFinishEventClick}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-green-600 text-slate-300 hover:text-white transition-colors text-sm font-bold px-6 py-3 rounded-lg border border-slate-700 hover:border-green-500 shadow-lg"
                     >
                        <Archive size={18} /> Encerrar Evento Oficialmente
                     </button>
                 ) : (
                     <button 
                        onClick={handleCancelEventClick}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors text-sm font-bold px-6 py-3 rounded-lg border border-slate-700 hover:border-red-500 shadow-lg"
                     >
                        <Trash2 size={18} /> Cancelar Evento (Voltar p/ Rascunho)
                     </button>
                 )}
            </div>
        )}
      </div>

      {/* Confirmation Modals */}
      {isFinishEventConfirmOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                 <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                     <div className="flex flex-col items-center text-center space-y-4">
                         <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center border border-green-700/50">
                             <Trophy size={32} className="text-green-500" />
                         </div>
                         <div>
                             <h3 className="text-xl font-bold text-white">Encerrar Evento?</h3>
                             <p className="text-slate-400 text-sm mt-2">Isso marcará o evento como finalizado e aplicará os pontos de OVR.</p>
                         </div>
                         <div className="flex gap-3 w-full mt-4">
                             <button onClick={() => setIsFinishEventConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                             <button onClick={confirmFinishEvent} className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95">Confirmar</button>
                         </div>
                     </div>
                 </div>
             </div>
      )}

      {isCancelEventConfirmOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                 <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                     <div className="flex flex-col items-center text-center space-y-4">
                         <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center border border-red-700/50">
                             <AlertTriangle size={32} className="text-red-500" />
                         </div>
                         <div>
                             <h3 className="text-xl font-bold text-white">Cancelar Evento?</h3>
                             <p className="text-slate-400 text-sm mt-2">O evento voltará para a fase de <strong>Rascunho</strong>. <br/><span className="text-red-400">Todos os jogos e gols registrados serão apagados.</span></p>
                         </div>
                         <div className="flex gap-3 w-full mt-4">
                             <button onClick={() => setIsCancelEventConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Não</button>
                             <button onClick={confirmCancelEvent} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-transform active:scale-95">Sim, Cancelar</button>
                         </div>
                     </div>
                 </div>
             </div>
      )}
    </div>
  );
};

export default ActiveMatchDashboard;