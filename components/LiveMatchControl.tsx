import React, { useState, useMemo, useEffect } from 'react';
import { Game, Match, Player, Goal, GamePhase, PenaltyKick } from '../types';
import { matchService } from '../services/matchService';
import { Timer, X, CheckCircle, UserPlus, Play, AlertTriangle, Edit2, Zap, Circle, Shield, Target, RotateCcw, Loader2 } from 'lucide-react';

interface LiveMatchControlProps {
  match: Match;
  game: Game;
  onUpdate: (updatedMatch: Match) => void;
}

const LiveMatchControl: React.FC<LiveMatchControlProps> = ({ match, game, onUpdate }) => {
  const [scoringTeamId, setScoringTeamId] = useState<string | null>(null);
  const [isEndGameConfirmOpen, setIsEndGameConfirmOpen] = useState(false);
  
  // Selection States
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const [selectedAssist, setSelectedAssist] = useState<string | null>(null);
  
  // Editing State
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Prevention State for Double Clicks
  const [isProcessing, setIsProcessing] = useState(false);

  // Score Animation States
  const [lastHomeScore, setLastHomeScore] = useState(game.homeScore);
  const [lastAwayScore, setLastAwayScore] = useState(game.awayScore);
  const [animateHome, setAnimateHome] = useState(false);
  const [animateAway, setAnimateAway] = useState(false);

  const homeTeam = match.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = match.teams.find(t => t.id === game.awayTeamId);

  const gameGoals = match.goals?.filter(g => g.gameId === game.id) || [];
  const isKnockout = game.phase === GamePhase.FINAL || game.phase === GamePhase.THIRD_PLACE;
  const isDraw = game.homeScore === game.awayScore;
  const requiresPenalties = isKnockout && isDraw;
  const inPenaltyMode = !!game.penaltyShootout;
  const maxKicks = game.phase === GamePhase.FINAL ? 5 : 3;

  useEffect(() => {
    if (game.homeScore > lastHomeScore) {
      setAnimateHome(true);
      const timer = setTimeout(() => setAnimateHome(false), 800);
      return () => clearTimeout(timer);
    }
    setLastHomeScore(game.homeScore);
  }, [game.homeScore]);

  useEffect(() => {
    if (game.awayScore > lastAwayScore) {
      setAnimateAway(true);
      const timer = setTimeout(() => setAnimateAway(false), 800);
      return () => clearTimeout(timer);
    }
    setLastAwayScore(game.awayScore);
  }, [game.awayScore]);

  if (!homeTeam || !awayTeam) return null;

  const scoringTeam = scoringTeamId === homeTeam.id ? homeTeam : awayTeam;

  const isPenaltyWinnerDecided = useMemo(() => {
      if (!game.penaltyShootout) return false;
      
      const history = game.penaltyShootout.history;
      const homeKicks = history.filter(k => k.teamId === homeTeam.id).length;
      const awayKicks = history.filter(k => k.teamId === awayTeam.id).length;
      
      const homeScore = game.penaltyShootout.homeScore;
      const awayScore = game.penaltyShootout.awayScore;
      
      if (homeKicks < maxKicks || awayKicks < maxKicks) {
          const homeRemaining = maxKicks - homeKicks;
          const awayRemaining = maxKicks - awayKicks;
          if (homeScore > awayScore + awayRemaining) return true;
          if (awayScore > homeScore + homeRemaining) return true;
          return false;
      }
      
      if (homeKicks === awayKicks) {
          if (homeScore !== awayScore) return true;
      }
      
      return false;
  }, [game.penaltyShootout, maxKicks, homeTeam.id, awayTeam.id]);

  const getPenaltyWinnerName = () => {
      if (!isPenaltyWinnerDecided || !game.penaltyShootout) return null;
      if (game.penaltyShootout.homeScore > game.penaltyShootout.awayScore) return homeTeam.name;
      return awayTeam.name;
  };

  const handleEndGameClick = () => {
    setIsEndGameConfirmOpen(true);
  };

  const confirmEndGame = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const updated = await matchService.endMatch(match.id, game.id);
    onUpdate(updated);
    setIsEndGameConfirmOpen(false);
    setIsProcessing(false);
  };

  const openGoalModal = (teamId: string) => {
    setScoringTeamId(teamId);
    setSelectedScorer(null);
    setSelectedAssist(null);
    setEditingGoalId(null); 
  };

  const openEditGoalModal = (goal: Goal) => {
      setEditingGoalId(goal.id);
      setScoringTeamId(goal.teamId);
      setSelectedScorer(goal.scorerId);
      setSelectedAssist(goal.assistId || 'none');
  };

  const confirmGoal = async () => {
    if (!scoringTeamId || !selectedScorer || isProcessing) return;
    
    setIsProcessing(true);
    const assist = selectedAssist === 'none' ? undefined : selectedAssist;
    
    let updated;
    if (editingGoalId) {
        updated = await matchService.updateGoal(match.id, editingGoalId, selectedScorer, assist || undefined);
    } else {
        updated = await matchService.scoreGoal(match.id, game.id, scoringTeamId, selectedScorer, assist || undefined);
    }
    
    onUpdate(updated);
    setScoringTeamId(null);
    setEditingGoalId(null);
    setIsProcessing(false);
  };

  const handleStartPenalties = async () => {
     if (isProcessing) return;
     setIsProcessing(true);
     const updated = await matchService.initializePenaltyShootout(match.id, game.id);
     onUpdate(updated);
     setIsProcessing(false);
  };

  const handlePenaltyKick = async (isGoal: boolean) => {
      if (isProcessing) return; // Prevent double clicks
      setIsProcessing(true);

      const history = game.penaltyShootout?.history || [];
      const kickCount = history.length;
      const kickerTeamId = kickCount % 2 === 0 ? homeTeam.id : awayTeam.id;

      const updated = await matchService.registerPenalty(match.id, game.id, kickerTeamId, isGoal);
      onUpdate(updated);
      
      // Small delay to allow UI to settle before enabling again
      setTimeout(() => setIsProcessing(false), 500);
  };

  const handleUndoPenalty = async () => {
      if (isProcessing || !game.penaltyShootout?.history.length) return;
      setIsProcessing(true);
      
      const updated = await matchService.undoLastPenalty(match.id, game.id);
      onUpdate(updated);
      setIsProcessing(false);
  };

  const getPlayerName = (playerId: string) => {
      const p = homeTeam.players.find(p => p.id === playerId) || awayTeam.players.find(p => p.id === playerId);
      return p ? p.name : 'Desconhecido';
  };

  const renderPenaltyDots = (teamId: string) => {
      const history = game.penaltyShootout?.history || [];
      const teamKicks = history.filter(k => k.teamId === teamId);
      const totalRounds = Math.max(maxKicks, Math.ceil(history.length / 2));
      const dots = [];

      for (let i = 0; i < totalRounds; i++) {
          const kick = teamKicks[i];
          if (kick) {
              dots.push(
                  <div key={i} className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center border-2 ${kick.isGoal ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400'}`}>
                      {kick.isGoal ? <CheckCircle size={12} className="text-white" /> : <X size={12} className="text-white" />}
                  </div>
              );
          } else {
              dots.push(
                  <div key={i} className="w-5 h-5 flex-shrink-0 rounded-full border-2 border-slate-600 bg-slate-800"></div>
              );
          }
      }
      return <div className="flex gap-1.5 justify-center flex-wrap max-w-[150px] mx-auto">{dots}</div>;
  };

  const historyLen = game.penaltyShootout?.history.length || 0;
  const currentKickerTeam = historyLen % 2 === 0 ? homeTeam : awayTeam;


  return (
    <div className="bg-slate-800 border-2 border-green-600/50 rounded-xl p-6 shadow-2xl relative overflow-hidden mb-8 animate-fade-in">
        <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-pulse"></div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
            <div className="flex-1 text-center md:text-left order-2 md:order-1">
                 <h3 className="text-2xl font-bold text-white mb-2">{homeTeam.name}</h3>
                 {!inPenaltyMode && (
                     <button 
                       onClick={() => openGoalModal(homeTeam.id)}
                       className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2 mx-auto md:mx-0"
                     >
                        <PlusIcon /> GOL
                     </button>
                 )}
            </div>

            <div className="flex flex-col items-center order-1 md:order-2">
                <div className="flex items-center gap-4 bg-black/40 px-8 py-4 rounded-lg border border-slate-700 relative">
                    <span className={`text-5xl font-mono font-bold transition-all duration-500 transform ${animateHome ? 'text-green-400 scale-125' : 'text-white'}`}>{game.homeScore}</span>
                    <span className="text-slate-500 text-2xl font-thin">:</span>
                    <span className={`text-5xl font-mono font-bold transition-all duration-500 transform ${animateAway ? 'text-green-400 scale-125' : 'text-white'}`}>{game.awayScore}</span>
                </div>
                {game.phase === GamePhase.FINAL && <span className="text-xs text-yellow-500 font-bold uppercase tracking-widest mt-2">GRANDE FINAL</span>}
                 {game.phase === GamePhase.THIRD_PLACE && <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">DISPUTA 3º LUGAR</span>}
            </div>

            <div className="flex-1 text-center md:text-right order-3">
                 <h3 className="text-2xl font-bold text-white mb-2">{awayTeam.name}</h3>
                 {!inPenaltyMode && (
                     <button 
                       onClick={() => openGoalModal(awayTeam.id)}
                       className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2 mx-auto md:ml-auto md:mr-0"
                     >
                        <PlusIcon /> GOL
                     </button>
                 )}
            </div>
        </div>

        {requiresPenalties && (
            <div className="mt-6 mb-6 bg-slate-900/80 rounded-xl border border-slate-700 p-6 animate-slide-down">
                {!inPenaltyMode ? (
                     <div className="text-center">
                         <div className="inline-flex items-center justify-center p-3 bg-slate-800 rounded-full mb-3 text-slate-400"><Target size={24} /></div>
                         <h3 className="text-xl font-bold text-white mb-1">Empate no Tempo Normal</h3>
                         <p className="text-slate-400 text-sm mb-4">A partida será decidida nos pênaltis ({maxKicks} cobranças).</p>
                         <button onClick={handleStartPenalties} disabled={isProcessing} className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-yellow-900/20 transition-transform active:scale-95">INICIAR PÊNALTIS</button>
                     </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-center gap-2 mb-2">
                             <Target size={18} className="text-yellow-500 animate-pulse" />
                             <h4 className="text-yellow-500 font-bold uppercase tracking-widest text-sm">Disputa de Pênaltis</h4>
                        </div>
                        
                        <div className="flex items-center justify-between px-4 sm:px-12">
                             <div className="flex flex-col items-center gap-2 w-1/3">
                                 <div className="text-3xl font-mono font-bold text-white">{game.penaltyShootout?.homeScore || 0}</div>
                                 {renderPenaltyDots(homeTeam.id)}
                             </div>
                             <div className="h-12 w-px bg-slate-700"></div>
                             <div className="flex flex-col items-center gap-2 w-1/3">
                                 <div className="text-3xl font-mono font-bold text-white">{game.penaltyShootout?.awayScore || 0}</div>
                                 {renderPenaltyDots(awayTeam.id)}
                             </div>
                        </div>

                        {!isPenaltyWinnerDecided ? (
                            <div className="flex flex-col items-center mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700 relative">
                                {game.penaltyShootout?.history.length! > 0 && (
                                    <button 
                                        onClick={handleUndoPenalty}
                                        disabled={isProcessing}
                                        className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                                        title="Desfazer última cobrança"
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                )}
                                
                                <p className="text-slate-400 text-sm mb-3">
                                    Cobrança de: <span className="text-white font-bold text-lg">{currentKickerTeam.name}</span>
                                </p>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => handlePenaltyKick(false)}
                                        disabled={isProcessing}
                                        className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-red-900/20 border-2 border-red-600 hover:bg-red-600 hover:text-white text-red-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        <X size={32} />
                                        <span className="font-bold text-xs mt-1">PERDEU</span>
                                    </button>
                                    <button 
                                        onClick={() => handlePenaltyKick(true)}
                                        disabled={isProcessing}
                                        className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-green-900/20 border-2 border-green-600 hover:bg-green-600 hover:text-white text-green-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        <CheckCircle size={32} />
                                        <span className="font-bold text-xs mt-1">GOL</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                             <div className="text-center py-4 bg-green-900/20 border border-green-800/50 rounded-lg animate-pulse">
                                 <h4 className="text-green-400 font-bold text-lg">Vencedor Definido!</h4>
                                 <p className="text-slate-300 text-sm">{getPenaltyWinnerName()} venceu nos pênaltis.</p>
                                 <p className="text-xs text-slate-500 mt-1">Pode encerrar a partida agora.</p>
                             </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {!inPenaltyMode && (
            <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4 mb-4">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                     <Zap size={12} className="text-yellow-500" />
                     Eventos da Partida
                 </h4>
                 {gameGoals.length === 0 ? (
                     <div className="text-center text-slate-500 text-sm italic py-2">Nenhum gol registrado.</div>
                 ) : (
                     <div className="space-y-2">
                         {gameGoals.map((goal) => {
                             const isHomeGoal = goal.teamId === homeTeam.id;
                             return (
                                 <div key={goal.id} className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700 hover:border-slate-600 transition-colors">
                                     <div className="flex items-center gap-3">
                                         <div className={`w-1 h-8 rounded-full ${isHomeGoal ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                         <div>
                                             <div className="flex items-center gap-2">
                                                 <span className="text-white font-bold text-sm">{getPlayerName(goal.scorerId)}</span>
                                                 <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 rounded">{isHomeGoal ? homeTeam.name : awayTeam.name}</span>
                                             </div>
                                             {goal.assistId && (<div className="text-xs text-slate-400">Assistência: {getPlayerName(goal.assistId)}</div>)}
                                         </div>
                                     </div>
                                     <button onClick={() => openEditGoalModal(goal)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition-colors" title="Editar gol"><Edit2 size={14} /></button>
                                 </div>
                             );
                         })}
                     </div>
                 )}
            </div>
        )}

        <div className="pt-4 border-t border-slate-700 flex justify-center">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-red-500 font-bold animate-pulse text-sm uppercase tracking-widest">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Em Andamento
                </span>
                {(!requiresPenalties || isPenaltyWinnerDecided) && (
                    <button onClick={handleEndGameClick} className="text-xs text-slate-400 hover:text-white underline">Encerrar Partida</button>
                )}
            </div>
        </div>

        {/* Modal content unchanged... */}
        {/* Goal Modal content unchanged... */}
        {scoringTeamId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-slate-800 border border-slate-600 rounded-lg w-full max-w-md p-6 shadow-2xl animate-scale-up">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xl font-bold text-white">
                            {editingGoalId ? 'Editar Gol' : `Novo Gol: ${scoringTeam?.name}`}
                        </h4>
                        <button onClick={() => { setScoringTeamId(null); setEditingGoalId(null); }} className="text-slate-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Scorer Selection */}
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Quem fez o gol?</label>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {scoringTeam?.players.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedScorer(p.id)}
                                        className={`p-2 text-sm rounded text-left truncate transition-colors border ${
                                            selectedScorer === p.id 
                                            ? 'bg-green-600 text-white border-green-500' 
                                            : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Assist Selection */}
                        {selectedScorer && (
                            <div className="animate-fade-in">
                                <label className="block text-sm text-slate-400 mb-2">Quem deu a assistência?</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    <button
                                        onClick={() => setSelectedAssist('none')}
                                        className={`p-2 text-sm rounded text-left transition-colors border ${
                                            selectedAssist === 'none' 
                                            ? 'bg-slate-500 text-white border-slate-400' 
                                            : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600'
                                        }`}
                                    >
                                        Sem assistência
                                    </button>
                                    {scoringTeam?.players.filter(p => p.id !== selectedScorer).map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setSelectedAssist(p.id)}
                                            className={`p-2 text-sm rounded text-left truncate transition-colors border ${
                                                selectedAssist === p.id 
                                                ? 'bg-blue-600 text-white border-blue-500' 
                                                : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600'
                                            }`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={confirmGoal}
                            disabled={!selectedScorer || !selectedAssist || isProcessing}
                            className="w-full mt-4 bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 text-white py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                            {editingGoalId ? 'Salvar Alterações' : 'Confirmar Gol'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* End Game Modal */}
        {isEndGameConfirmOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                 <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                     <div className="flex flex-col items-center text-center space-y-4">
                         <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center border border-yellow-700/50">
                             <AlertTriangle size={32} className="text-yellow-500" />
                         </div>
                         
                         <div>
                             <h3 className="text-xl font-bold text-white">Encerrar Partida?</h3>
                             <p className="text-slate-400 text-sm mt-2">
                                 O placar atual será registrado como final.
                             </p>
                             {inPenaltyMode && (
                                 <p className="text-xs text-green-400 mt-1">Resultado dos pênaltis será salvo.</p>
                             )}
                         </div>

                         <div className="flex gap-3 w-full mt-4">
                             <button 
                                 onClick={() => setIsEndGameConfirmOpen(false)}
                                 className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                             >
                                 Cancelar
                             </button>
                             <button 
                                 onClick={confirmEndGame}
                                 className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95"
                             >
                                 Sim, Encerrar
                             </button>
                         </div>
                     </div>
                 </div>
             </div>
        )}
    </div>
  );
};

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

export default LiveMatchControl;