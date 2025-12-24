import React, { useEffect, useState, useMemo } from 'react';
import { GameStatus, Match, GamePhase, Standing, MatchStatus, Game, PlayerPosition } from '../types';
import { matchService } from '../services/matchService';
import LiveMatchControl from './LiveMatchControl';
import { ArrowLeft, Trophy, List, PlayCircle, CheckCircle2, Archive, AlertTriangle, Trash2, ChevronDown, ChevronUp, Zap, Shield, Footprints, Scale } from 'lucide-react';

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
  
  // States para Modais
  const [isFinishEventConfirmOpen, setIsFinishEventConfirmOpen] = useState(false);
  const [isCancelEventConfirmOpen, setIsCancelEventConfirmOpen] = useState(false);
  
  // State para o Acordeão da Tabela
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  useEffect(() => { loadMatch(); }, [matchId]);

  const loadMatch = async () => {
    setLoading(true); setError(null);
    try { 
        await matchService.ensureFixtures(matchId); 
        const data = await matchService.getById(matchId); 
        if (!data) throw new Error("Evento não encontrado."); 
        setMatch(data); 
    } 
    catch (e) { console.error(e); setError("Erro ao carregar dados."); } finally { setLoading(false); }
  };

  const handleStartGame = async (gameId: string) => { if (!match || match.status === MatchStatus.FINISHED) return; const updated = await matchService.startGame(match.id, gameId); setMatch({ ...updated }); };
  const handleUpdateMatch = (updated: Match) => { setMatch({ ...updated }); };
  const handleFinishEventClick = () => { if (!match) return; setIsFinishEventConfirmOpen(true); };
  const confirmFinishEvent = async () => { if (!match) return; await matchService.finishMatch(match.id); setIsFinishEventConfirmOpen(false); if (onMatchUpdate) onMatchUpdate(); onBack(); };
  const handleCancelEventClick = () => { setIsCancelEventConfirmOpen(true); };
  const confirmCancelEvent = async () => { if (!match) return; await matchService.revertToDraft(match.id); setIsCancelEventConfirmOpen(false); if (onMatchUpdate) onMatchUpdate(); onBack(); };

  const handleCreateTieBreaker = async () => {
      if (!match) return;
      const standings = matchService.calculateStandings(match);
      const t2 = standings[1];
      const t3 = standings[2];
      
      if (!t2 || !t3) return;
      
      try {
          const updated = await matchService.createTieBreakerGame(match.id, t2.teamId, t3.teamId);
          setMatch({ ...updated });
          setActiveTab('games'); 
      } catch (e) {
          console.error(e);
          alert("Erro ao criar jogo de desempate.");
      }
  };

  const standings = useMemo(() => { if (!match) return []; return matchService.calculateStandings(match); }, [match]);
  const liveGame = match?.games.find(g => g.status === GameStatus.LIVE);
  
  const gamesByPhase = useMemo(() => {
      if (!match) return {};
      const groups: Record<string, Game[]> = {};
      match.games.forEach(game => { 
          if (!groups[game.phase]) groups[game.phase] = []; 
          groups[game.phase].push(game); 
      });
      Object.keys(groups).forEach(key => { groups[key].sort((a,b) => a.sequence - b.sequence); });
      return groups;
  }, [match]);

  const needsTieBreaker = useMemo(() => {
      if (!match || match.type !== 'Quadrangular') return false; 
      const phase2Games = match.games.filter(g => g.phase === GamePhase.PHASE_1 || g.phase === GamePhase.PHASE_2);
      const allFinished = phase2Games.every(g => g.status === GameStatus.FINISHED);
      if (!allFinished) return false;
      const hasTieBreaker = match.games.some(g => g.phase === GamePhase.TIE_BREAKER);
      if (hasTieBreaker) return false;
      const s = matchService.calculateStandings(match);
      if (s.length < 3) return false;
      const p2 = s[1];
      const p3 = s[2];
      return p2.points === p3.points;
  }, [match]);

  const getTeamName = (id: string) => { if (id === 'TBD') return 'A Definir'; return match?.teams.find(t => t.id === id)?.name || 'Desconhecido'; };
  const getTeamTextColor = (name: string) => {
      if (name.includes('Branco')) return 'text-slate-200';
      if (name.includes('Preto')) return 'text-slate-400';
      if (name.includes('Vermelho')) return 'text-red-500';
      if (name.includes('Azul')) return 'text-blue-500';
      return 'text-white';
  };

  const getPlayerStatsInMatch = (playerId: string, teamId: string) => {
      if (!match) return { goals: 0, assists: 0, cleanSheets: 0 };
      const goals = match.goals.filter(g => g.scorerId === playerId).length;
      const assists = match.goals.filter(g => g.assistId === playerId).length;
      let cleanSheets = 0;
      const teamGames = match.games.filter(g => g.status === GameStatus.FINISHED && (g.homeTeamId === teamId || g.awayTeamId === teamId));
      teamGames.forEach(g => {
          const isHome = g.homeTeamId === teamId;
          const opponentScore = isHome ? g.awayScore : g.homeScore;
          if (opponentScore === 0) cleanSheets++;
      });
      return { goals, assists, cleanSheets };
  };

  if (loading) return <div className="flex flex-col items-center justify-center min-h-[60vh]"><div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (error || !match) return <div className="text-center p-8"><h3 className="text-white">Erro ao carregar</h3><button onClick={onBack} className="text-slate-400">Voltar</button></div>;

  const isEventFinished = match.status === MatchStatus.FINISHED;
  const hasFinishedGames = match.games.some(g => g.status === GameStatus.FINISHED);

  const displayOrder = [
      { phase: GamePhase.PHASE_1, label: 'Fase 1 (Pontos Corridos)', color: 'text-green-500 border-green-500' },
      { phase: GamePhase.PHASE_2, label: 'Fase 2 (Intermediária)', color: 'text-green-500 border-green-500' },
      { phase: GamePhase.TIE_BREAKER, label: 'Desempate (Pênaltis)', color: 'text-yellow-500 border-yellow-500' },
      { phase: GamePhase.THIRD_PLACE, label: 'Disputa de 3º Lugar', color: 'text-blue-400 border-blue-400' },
      { phase: GamePhase.FINAL, label: 'Grande Final', color: 'text-yellow-500 border-yellow-500' }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in pb-20 px-2 sm:px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><ArrowLeft size={24} /></button><div><h2 className="text-2xl font-bold text-white flex items-center gap-2">{isEventFinished ? (<div className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs uppercase">Finalizado</div>) : (<div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>)} Evento Ativo</h2><p className="text-slate-400 text-sm">{match.type} • {match.location}</p></div></div>
      </div>

      {liveGame && !isEventFinished && (<LiveMatchControl match={match} game={liveGame} onUpdate={handleUpdateMatch} />)}

      <div className="flex border-b border-slate-700 mb-6"><button onClick={() => setActiveTab('games')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'games' ? 'border-green-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}><div className="flex items-center gap-2"><List size={16} /> Jogos</div></button><button onClick={() => setActiveTab('standings')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'standings' ? 'border-green-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}><div className="flex items-center gap-2"><Trophy size={16} /> Classificação</div></button></div>

      <div className="min-h-[400px]">
        {needsTieBreaker && !isEventFinished && activeTab === 'standings' && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-scale-up">
                <div className="flex items-center gap-3"><div className="bg-yellow-600/20 p-2 rounded-full"><Scale className="text-yellow-500" size={24} /></div><div><h4 className="text-yellow-500 font-bold">Empate no 2º Lugar!</h4><p className="text-slate-400 text-xs">O 2º e 3º colocados têm a mesma pontuação. Pelas regras, é necessário um desempate.</p></div></div>
                <button onClick={handleCreateTieBreaker} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded font-bold shadow-lg transition-all active:scale-95 text-sm whitespace-nowrap">Criar Jogo de Pênaltis</button>
            </div>
        )}

        {activeTab === 'games' && (
            <div className="space-y-8">
                {displayOrder.map(({ phase, label, color }) => {
                    const games = gamesByPhase[phase];
                    if (!games || games.length === 0) return null;

                    return (
                        <div key={phase}>
                            <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 pl-1 border-l-2 ${color}`}>{label}</h3>
                            <div className="grid gap-3">
                                {games.map(game => {
                                    const homeName = getTeamName(game.homeTeamId);
                                    const awayName = getTeamName(game.awayTeamId);
                                    return (
                                    <div key={game.id} className="border border-slate-700 bg-slate-800 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 transition-colors hover:border-slate-600">
                                        {/* Container de Times e Placar (Ocupa largura total no mobile) */}
                                        <div className="flex items-center justify-between w-full sm:w-auto sm:flex-1">
                                            {/* Time Casa */}
                                            <div className="flex-1 flex items-center justify-end gap-2 text-right">
                                                <span className={`font-bold text-xs sm:text-base leading-tight ${getTeamTextColor(homeName)}`}>{homeName}</span>
                                                {game.status === GameStatus.FINISHED && (<span className="text-lg sm:text-xl font-mono text-white bg-slate-900 px-2 rounded">{game.homeScore}</span>)}
                                            </div>

                                            {/* VS / Status */}
                                            <div className="px-2 flex flex-col items-center min-w-[40px]">
                                                {game.phase === GamePhase.TIE_BREAKER ? <span className="text-yellow-500 text-[10px] font-bold uppercase">Penal</span> : (game.status === GameStatus.FINISHED ? (<span className="text-slate-600 text-xs">Final</span>) : (<span className="text-slate-500 font-bold text-xs">VS</span>))}
                                            </div>

                                            {/* Time Fora */}
                                            <div className="flex-1 flex items-center justify-start gap-2 text-left">
                                                {game.status === GameStatus.FINISHED && (<span className="text-lg sm:text-xl font-mono text-white bg-slate-900 px-2 rounded">{game.awayScore}</span>)}
                                                <span className={`font-bold text-xs sm:text-base leading-tight ${getTeamTextColor(awayName)}`}>{awayName}</span>
                                            </div>
                                        </div>

                                        {/* Container de Ação (Linha de baixo no mobile / Coluna direita no desktop) */}
                                        <div className="w-full sm:w-auto sm:ml-4 sm:border-l sm:border-slate-700 sm:pl-4 flex justify-center pt-2 sm:pt-0 border-t border-slate-700 sm:border-t-0 mt-1 sm:mt-0">
                                            {game.status === GameStatus.WAITING && (
                                                game.homeTeamId !== 'TBD' && game.awayTeamId !== 'TBD' && !isEventFinished ? (
                                                    <button onClick={() => handleStartGame(game.id)} disabled={!!liveGame} className="bg-slate-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700 text-white px-6 py-2 sm:px-3 sm:py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-2 w-full sm:w-24 justify-center shadow-md sm:shadow-none"><PlayCircle size={14} /> INICIAR</button>
                                                ) : (<span className="text-xs text-slate-500 italic py-1">{game.homeTeamId === 'TBD' ? 'Aguardando' : 'Próximo'}</span>)
                                            )}
                                            {game.status === GameStatus.FINISHED && (<CheckCircle2 size={20} className="text-slate-600" />)}
                                            {game.status === GameStatus.LIVE && (<span className="text-xs text-red-500 font-bold animate-pulse py-1">AO VIVO</span>)}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Standings Tab */}
        {activeTab === 'standings' && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                <div className="p-4 bg-slate-900 border-b border-slate-700 text-xs text-slate-400">* Pontuação soma Fase 1 e Fase 2. Finais são eliminatórias diretas.</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-[350px]">
                        <thead className="bg-slate-900 text-slate-400 font-medium"><tr><th className="px-3 sm:px-4 py-3 whitespace-nowrap">Time</th><th className="px-2 sm:px-4 py-3 text-center">PTS</th><th className="px-2 sm:px-4 py-3 text-center">J</th><th className="px-2 sm:px-4 py-3 text-center">V</th><th className="px-2 sm:px-4 py-3 text-center">E</th><th className="px-2 sm:px-4 py-3 text-center">D</th><th className="px-2 sm:px-4 py-3 text-center">SG</th><th className="w-8"></th></tr></thead>
                        <tbody className="divide-y divide-slate-700">
                            {standings.map((teamStats, index) => {
                                const isExpanded = expandedTeamId === teamStats.teamId;
                                const fullTeam = match.teams.find(t => t.id === teamStats.teamId);
                                return (
                                    <React.Fragment key={teamStats.teamId}>
                                        <tr className={`cursor-pointer transition-colors ${isExpanded ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'}`} onClick={() => setExpandedTeamId(isExpanded ? null : teamStats.teamId)}>
                                            <td className={`px-3 sm:px-4 py-3 font-medium flex items-center gap-2 whitespace-nowrap ${getTeamTextColor(teamStats.teamName)}`}><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${index < 2 ? 'bg-yellow-900/50 text-yellow-500' : 'bg-slate-800 text-slate-500'}`}>{index + 1}</span>{teamStats.teamName}</td>
                                            <td className="px-2 sm:px-4 py-3 text-center font-bold text-green-400">{teamStats.points}</td><td className="px-2 sm:px-4 py-3 text-center text-slate-300">{teamStats.played}</td><td className="px-2 sm:px-4 py-3 text-center text-slate-400">{teamStats.wins}</td><td className="px-2 sm:px-4 py-3 text-center text-slate-400">{teamStats.draws}</td><td className="px-2 sm:px-4 py-3 text-center text-slate-400">{teamStats.losses}</td><td className="px-2 sm:px-4 py-3 text-center text-slate-300">{teamStats.goalDiff}</td><td className="px-2 text-slate-500">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                                        </tr>
                                        {isExpanded && fullTeam && (<tr className="bg-slate-900/30"><td colSpan={8} className="p-0"><div className="p-3 border-y border-slate-700/50 animate-slide-down"><h4 className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase mb-2 pl-1">Desempenho no Evento</h4><div className="grid grid-cols-1 gap-2">{fullTeam.players.map(player => { const { goals, assists, cleanSheets } = getPlayerStatsInMatch(player.id, teamStats.teamId); const isGK = player.position === PlayerPosition.GOLEIRO; const hasStats = goals > 0 || assists > 0 || (isGK && cleanSheets > 0); return (<div key={player.id} className={`flex items-center justify-between p-2 rounded text-xs ${hasStats ? 'bg-slate-800 border border-slate-700' : 'bg-slate-800/30 border border-transparent'}`}><div className="flex items-center gap-2"><span className={`font-bold truncate max-w-[100px] sm:max-w-none ${isGK ? 'text-yellow-500' : 'text-slate-300'}`}>{player.name}</span><span className="text-[9px] text-slate-500 bg-slate-900 px-1.5 rounded">{player.position.substring(0,3)}</span></div><div className="flex items-center gap-3">{(isGK || cleanSheets > 0) && (<div className="flex items-center gap-1" title="Clean Sheets"><Shield size={12} className={cleanSheets > 0 ? "text-blue-400" : "text-slate-600"} /><span className={cleanSheets > 0 ? "text-blue-400 font-bold" : "text-slate-600"}>{cleanSheets}</span></div>)}<div className="flex items-center gap-1" title="Gols"><Zap size={12} className={goals > 0 ? "text-emerald-400" : "text-slate-600"} /><span className={goals > 0 ? "text-emerald-400 font-bold" : "text-slate-600"}>{goals}</span></div><div className="flex items-center gap-1" title="Assistências"><Footprints size={12} className={assists > 0 ? "text-cyan-400" : "text-slate-600"} /><span className={assists > 0 ? "text-cyan-400 font-bold" : "text-slate-600"}>{assists}</span></div></div></div>) })}</div></div></td></tr>)}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {!isEventFinished && (<div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">{hasFinishedGames ? (<button onClick={handleFinishEventClick} className="flex items-center gap-2 bg-slate-800 hover:bg-green-600 text-slate-300 hover:text-white transition-colors text-sm font-bold px-6 py-3 rounded-lg border border-slate-700 hover:border-green-500 shadow-lg"><Archive size={18} /> Encerrar Evento Oficialmente</button>) : (<button onClick={handleCancelEventClick} className="flex-1 items-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors text-sm font-bold px-6 py-3 rounded-lg border border-slate-700 hover:border-red-500 shadow-lg flex justify-center"><Trash2 size={18} /> Cancelar Evento (Voltar p/ Rascunho)</button>)}</div>)}
      </div>

      {isFinishEventConfirmOpen && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"><div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100"><div className="flex flex-col items-center text-center space-y-4"><div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center border border-green-700/50"><Trophy size={32} className="text-green-500" /></div><div><h3 className="text-xl font-bold text-white">Encerrar Evento?</h3><p className="text-slate-400 text-sm mt-2">Isso marcará o evento como finalizado e aplicará os pontos de OVR.</p></div><div className="flex gap-3 w-full mt-4"><button onClick={() => setIsFinishEventConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Cancelar</button><button onClick={confirmFinishEvent} className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95">Confirmar</button></div></div></div></div>)}
      {isCancelEventConfirmOpen && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"><div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100"><div className="flex flex-col items-center text-center space-y-4"><div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center border border-red-700/50"><AlertTriangle size={32} className="text-red-500" /></div><div><h3 className="text-xl font-bold text-white">Cancelar Evento?</h3><p className="text-slate-400 text-sm mt-2">O evento voltará para a fase de <strong>Rascunho</strong>. <br/><span className="text-red-400">Todos os jogos e gols registrados serão apagados.</span></p></div><div className="flex gap-3 w-full mt-4"><button onClick={() => setIsCancelEventConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Não</button><button onClick={confirmCancelEvent} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-transform active:scale-95">Sim, Cancelar</button></div></div></div></div>)}
    </div>
  );
};

export default ActiveMatchDashboard;