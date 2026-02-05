import React, { useState, useMemo, useEffect } from 'react';
import { Game, Match, Goal, GamePhase } from '../types';
import { matchService } from '../services/matchService';
import { X, CheckCircle, AlertTriangle, Edit2, Zap, Target, RotateCcw, Loader2, Play, Pause, Square, Clock, Plus } from 'lucide-react';

interface LiveMatchControlProps {
  match: Match;
  game: Game;
  onUpdate: (updatedMatch: Match) => void;
  onScoreGoal: (gameId: string, teamId: string, scorerId: string, assistId?: string | null) => Promise<void>;
}

const LiveMatchControl: React.FC<LiveMatchControlProps> = ({ match, game, onUpdate, onScoreGoal }) => {
  const [scoringTeamId, setScoringTeamId] = useState<string | null>(null);
  const [isEndGameConfirmOpen, setIsEndGameConfirmOpen] = useState(false);
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const [selectedAssist, setSelectedAssist] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Storage Key
  const STORAGE_KEY = `match_timer_${match.id}_${game.id}`;

  const defaultTime = 9 * 60; // 9 minutes in seconds

  // Timer State (Visual)
  const [timeLeft, setTimeLeft] = useState(defaultTime);
  const [initialTime, setInitialTime] = useState(defaultTime);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [tempMinutes, setTempMinutes] = useState("9");
  
  // Animação do Placar
  const [lastHomeScore, setLastHomeScore] = useState(game.homeScore);
  const [lastAwayScore, setLastAwayScore] = useState(game.awayScore);
  const [animateHome, setAnimateHome] = useState(false);
  const [animateAway, setAnimateAway] = useState(false);

  // --- Persistence Logic ---
  
  // Load from storage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            const savedInitial = parsed.initialTime || defaultTime;
            setInitialTime(savedInitial);
            setTempMinutes(Math.floor(savedInitial / 60).toString());

            if (parsed.isRunning && parsed.targetEndTime) {
                const now = Date.now();
                const diff = Math.ceil((parsed.targetEndTime - now) / 1000);
                if (diff > 0) {
                    setTimeLeft(diff);
                    setIsTimerRunning(true);
                } else {
                    setTimeLeft(0);
                    setIsTimerRunning(false);
                    // Time expired while away, update storage ensuring stopped state
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({
                        isRunning: false,
                        timeLeft: 0,
                        targetEndTime: null,
                        initialTime: savedInitial
                    }));
                }
            } else {
                setTimeLeft(parsed.timeLeft !== undefined ? parsed.timeLeft : savedInitial);
                setIsTimerRunning(false);
            }
        } catch (e) {
            console.error("Failed to parse timer state", e);
        }
    }
  }, [STORAGE_KEY]); // Only run once on mount (STORAGE_KEY stable)

  // Update storage helper
  const updateStorage = (running: boolean, remaining: number, targetEnd: number | null, init: number) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
          isRunning: running,
          timeLeft: remaining,
          targetEndTime: targetEnd,
          initialTime: init
      }));
  };

  // Timer Interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        // Double check storage to respect other tabs (optimistic concurrency not handled but good enough for single user)
        // OR better: use local state as source of truth for "tick" but validate against real time
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.isRunning && parsed.targetEndTime) {
                const now = Date.now();
                const newTimeLeft = Math.ceil((parsed.targetEndTime - now) / 1000);
                
                if (newTimeLeft <= 0) {
                    setTimeLeft(0);
                    setIsTimerRunning(false);
                    updateStorage(false, 0, null, initialTime);
                } else {
                    // Only update state if diff is significant to avoid jitter
                    if (Math.abs(newTimeLeft - timeLeft) > 0) {
                         setTimeLeft(newTimeLeft);
                    }
                }
            } else {
                 // Fallback
                 setTimeLeft(prev => Math.max(0, prev - 1));
            }
        } else {
             setTimeLeft(prev => Math.max(0, prev - 1));
        }
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
        setIsTimerRunning(false);
        updateStorage(false, 0, null, initialTime);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, STORAGE_KEY, initialTime]);

  const toggleTimer = () => {
      const newRunningState = !isTimerRunning;
      setIsTimerRunning(newRunningState);

      if (newRunningState) {
          // Starting/Resuming: Calculate target end time based on CURRENT timeLeft
          const targetEnd = Date.now() + (timeLeft * 1000);
          updateStorage(true, timeLeft, targetEnd, initialTime);
      } else {
          // Pausing
          updateStorage(false, timeLeft, null, initialTime);
      }
  };
  
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(initialTime);
    updateStorage(false, initialTime, null, initialTime);
  };

  const handleTimeEdit = () => {
    setIsEditingTime(true);
    setTempMinutes(Math.floor(initialTime / 60).toString());
    
    // Pause when editing
    if (isTimerRunning) {
        setIsTimerRunning(false);
        updateStorage(false, timeLeft, null, initialTime);
    }
  };

  const saveTimeEdit = () => {
    const mins = parseInt(tempMinutes);
    if (!isNaN(mins) && mins > 0) {
      const newSeconds = mins * 60;
      setInitialTime(newSeconds);
      setTimeLeft(newSeconds);
      updateStorage(false, newSeconds, null, newSeconds);
    }
    setIsEditingTime(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const homeTeam = match.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = match.teams.find(t => t.id === game.awayTeamId);

  const gameGoals = match.goals?.filter(g => g.gameId === game.id) || [];
  
  const isKnockout = game.phase === GamePhase.FINAL || game.phase === GamePhase.THIRD_PLACE || game.phase === GamePhase.TIE_BREAKER;
  const isDraw = game.homeScore === game.awayScore;
  const requiresPenalties = (isKnockout && isDraw) || game.phase === GamePhase.TIE_BREAKER;
  const inPenaltyMode = !!game.penaltyShootout;
  const maxKicks = game.phase === GamePhase.FINAL ? 5 : 3;

  useEffect(() => {
    if (game.homeScore > lastHomeScore) { setAnimateHome(true); setTimeout(() => setAnimateHome(false), 800); }
    setLastHomeScore(game.homeScore);
  }, [game.homeScore]);

  useEffect(() => {
    if (game.awayScore > lastAwayScore) { setAnimateAway(true); setTimeout(() => setAnimateAway(false), 800); }
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
      if (homeKicks === awayKicks) { if (homeScore !== awayScore) return true; }
      return false;
  }, [game.penaltyShootout, maxKicks, homeTeam.id, awayTeam.id]);

  const getPenaltyWinnerName = () => {
      if (!isPenaltyWinnerDecided || !game.penaltyShootout) return null;
      return game.penaltyShootout.homeScore > game.penaltyShootout.awayScore ? homeTeam.name : awayTeam.name;
  };

  const handleEndGameClick = () => setIsEndGameConfirmOpen(true);
  
  const confirmEndGame = async () => { 
    if (isProcessing) return; 
    setIsProcessing(true); 
    const updated = await matchService.endMatch(match.id, game.id); 
    
    // Clear timer storage
    localStorage.removeItem(STORAGE_KEY);
    
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
    if (!scoringTeamId || !selectedScorer) return; 
    
    if (editingGoalId) {
        if (isProcessing) return;
        setIsProcessing(true);
        const assist = selectedAssist === 'none' ? undefined : selectedAssist;
        const updated = await matchService.updateGoal(match.id, editingGoalId, selectedScorer, assist || undefined);
        onUpdate(updated);
        setScoringTeamId(null);
        setEditingGoalId(null);
        setIsProcessing(false);
        return;
    }

    const teamId = scoringTeamId;
    const scorer = selectedScorer;
    const assist = selectedAssist === 'none' ? null : selectedAssist;

    setScoringTeamId(null);
    setEditingGoalId(null);
    setSelectedScorer(null);
    setSelectedAssist(null);
    
    onScoreGoal(game.id, teamId, scorer, assist);
  };

  const handleStartPenalties = async () => { if (isProcessing) return; setIsProcessing(true); const updated = await matchService.initializePenaltyShootout(match.id, game.id); onUpdate(updated); setIsProcessing(false); };
  const handlePenaltyKick = async (isGoal: boolean) => { if (isProcessing) return; setIsProcessing(true); const history = game.penaltyShootout?.history || []; const kickCount = history.length; const kickerTeamId = kickCount % 2 === 0 ? homeTeam.id : awayTeam.id; const updated = await matchService.registerPenalty(match.id, game.id, kickerTeamId, isGoal); onUpdate(updated); setTimeout(() => setIsProcessing(false), 500); };
  const handleUndoPenalty = async () => { if (isProcessing || !game.penaltyShootout?.history.length) return; setIsProcessing(true); const updated = await matchService.undoLastPenalty(match.id, game.id); onUpdate(updated); setIsProcessing(false); };
  
  const getPlayerName = (playerId: string) => { 
      const p = homeTeam.players.find(p => p.id === playerId) || awayTeam.players.find(p => p.id === playerId); 
      return p ? p.name : 'Desconhecido'; 
  };
  
  const renderPenaltyDots = (teamId: string) => { const history = game.penaltyShootout?.history || []; const teamKicks = history.filter(k => k.teamId === teamId); const totalRounds = Math.max(maxKicks, Math.ceil(history.length / 2)); const dots = []; for (let i = 0; i < totalRounds; i++) { const kick = teamKicks[i]; if (kick) dots.push(<div key={i} className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center border-2 ${kick.isGoal ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400'}`}>{kick.isGoal ? <CheckCircle size={12} className="text-white" /> : <X size={12} className="text-white" />}</div>); else dots.push(<div key={i} className="w-5 h-5 flex-shrink-0 rounded-full border-2 border-slate-600 bg-slate-800"></div>); } return <div className="flex gap-1.5 justify-center flex-wrap max-w-[150px] mx-auto">{dots}</div>; };
  
  const historyLen = game.penaltyShootout?.history.length || 0;
  const currentKickerTeam = historyLen % 2 === 0 ? homeTeam : awayTeam;

  const getTeamTextColor = (name: string) => {
      if (name.includes('Branco')) return 'text-slate-200';
      if (name.includes('Preto')) return 'text-slate-400';
      if (name.includes('Vermelho')) return 'text-red-500';
      if (name.includes('Azul')) return 'text-blue-500';
      return 'text-white';
  };

  const showGoalButtons = !inPenaltyMode && game.phase !== GamePhase.TIE_BREAKER;

  return (
    <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden mb-8 animate-fade-in group">
        {/* Glow Effects - mais sutis */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/50 via-green-400 to-green-500/50"></div>
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/15 transition-all duration-700"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/15 transition-all duration-700"></div>

        <div className="flex flex-col xl:flex-row items-center justify-between gap-8 mb-8 relative z-10">
            {/* Home Team */}
            <div className="flex-1 text-center xl:text-left order-2 xl:order-1 w-full xl:w-auto">
                 <h3 className={`text-2xl md:text-3xl font-black mb-3 tracking-tight drop-shadow-sm ${getTeamTextColor(homeTeam.name)}`}>{homeTeam.name}</h3>
                 {showGoalButtons && ( 
                    <button onClick={() => openGoalModal(homeTeam.id)} 
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mx-auto xl:mx-0 w-full xl:w-auto border border-green-500/30">
                        <PlusIcon /> GOL
                    </button> 
                 )}
            </div>

            {/* Scoreboard & Timer */}
            <div className="flex flex-col items-center order-1 xl:order-2">
                <div className="relative">
                    {/* Scoreboard Container */}
                    <div className="flex items-center gap-6 md:gap-8 bg-slate-900/60 px-8 py-5 rounded-2xl border border-slate-700/50 backdrop-blur-sm shadow-xl">
                        <span className={`text-6xl md:text-7xl font-mono font-bold transition-all duration-500 transform drop-shadow-[0_0_15px_rgba(74,222,128,0.3)] ${animateHome ? 'text-green-400 scale-110' : 'text-white'}`}>{game.homeScore}</span>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="text-slate-600 text-3xl font-thin opacity-50">:</span>
                        </div>
                        <span className={`text-6xl md:text-7xl font-mono font-bold transition-all duration-500 transform drop-shadow-[0_0_15px_rgba(74,222,128,0.3)] ${animateAway ? 'text-green-400 scale-110' : 'text-white'}`}>{game.awayScore}</span>
                    </div>
                    
                    {/* Game Phase Badge */}
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        {game.phase === GamePhase.FINAL && <span className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-yellow-400/50 uppercase tracking-wider whitespace-nowrap">Grande Final</span>}
                        {game.phase === GamePhase.THIRD_PLACE && <span className="bg-slate-600 text-slate-200 text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-slate-500/50 uppercase tracking-wider whitespace-nowrap">Disputa 3º Lugar</span>}
                        {game.phase === GamePhase.TIE_BREAKER && <span className="bg-red-600 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-red-400/50 uppercase tracking-wider animate-pulse whitespace-nowrap">Pênaltis</span>}
                    </div>
                </div>

                {/* Timer Section */}
                <div className="mt-6 flex flex-col items-center animate-slide-up">
                    <div className={`flex items-center gap-3 bg-slate-900/40 p-1.5 pr-4 pl-4 rounded-full border mb-3 transition-colors ${timeLeft === 0 ? 'border-red-500/50 bg-red-900/20' : 'border-slate-700/50'}`}>
                         {isEditingTime ? (
                             <div className="flex items-center gap-2">
                                 <input 
                                    type="number" 
                                    value={tempMinutes}
                                    onChange={(e) => setTempMinutes(e.target.value)}
                                    className="w-16 bg-slate-800 border border-slate-600 text-white rounded px-2 py-1 text-center font-mono focus:border-green-500 focus:outline-none"
                                    autoFocus
                                 />
                                 <span className="text-slate-400 text-sm">min</span>
                                 <button onClick={saveTimeEdit} className="p-1 bg-green-600 hover:bg-green-500 text-white rounded-full"><CheckCircle size={14} /></button>
                             </div>
                         ) : (
                             <div 
                                onClick={() => {
                                    if (!isTimerRunning && (timeLeft === initialTime || timeLeft === 0)) {
                                        handleTimeEdit();
                                    }
                                }} 
                                className={`group/timer relative flex items-center justify-center px-2 py-1 ${!isTimerRunning && (timeLeft === initialTime || timeLeft === 0) ? 'cursor-pointer' : 'cursor-default'}`}
                                title={!isTimerRunning && (timeLeft === initialTime || timeLeft === 0) ? "Clique para editar o tempo" : ""}
                             >
                                <Clock size={16} className={`mr-2 ${timeLeft < 60 && timeLeft > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                                <span className={`text-2xl font-mono font-bold tabular-nums tracking-wider transition-colors 
                                    ${timeLeft === 0 ? 'text-red-500' : ''}
                                    ${timeLeft < 60 && timeLeft > 0 ? 'text-red-400' : ''}
                                    ${!isTimerRunning && timeLeft !== initialTime && timeLeft > 0 ? 'text-yellow-500' : 'text-slate-200'}
                                    ${!isTimerRunning && (timeLeft === initialTime || timeLeft === 0) ? 'group-hover/timer:text-white' : ''}
                                `}>
                                    {formatTime(timeLeft)}
                                </span>
                                {!isTimerRunning && (timeLeft === initialTime || timeLeft === 0) && (
                                    <Edit2 size={12} className="absolute -right-3 top-0 opacity-0 group-hover/timer:opacity-100 text-slate-500 transition-opacity" />
                                )}
                             </div>
                         )}
                    </div>
                    
                    {timeLeft === 0 && (
                        <div className="text-red-500 font-bold text-sm uppercase tracking-widest mb-3 animate-pulse">Fim da Partida</div>
                    )}

                    {/* Timer Controls */}
                    <div className="flex items-center gap-3">
                        {!isTimerRunning ? (
                            <button 
                                onClick={toggleTimer} 
                                disabled={timeLeft === 0}
                                className="p-3 bg-green-600 hover:bg-green-500 text-white rounded-full transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-green-900/20"
                                title="Iniciar"
                            >
                                <Play size={20} fill="currentColor" />
                            </button>
                        ) : (
                            <button 
                                onClick={toggleTimer} 
                                className="p-3 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-full transition-all active:scale-95 shadow-lg shadow-yellow-900/20"
                                title="Pausar"
                            >
                                <Pause size={20} fill="currentColor" />
                            </button>
                        )}
                        <button 
                            onClick={resetTimer} 
                            className="p-3 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-full transition-all active:scale-95 shadow-lg"
                            title="Parar / Reiniciar"
                        >
                            <Square size={18} fill="currentColor" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Away Team */}
            <div className="flex-1 text-center xl:text-right order-3 w-full xl:w-auto">
                 <h3 className={`text-2xl md:text-3xl font-black mb-3 tracking-tight drop-shadow-sm ${getTeamTextColor(awayTeam.name)}`}>{awayTeam.name}</h3>
                 {showGoalButtons && ( 
                    <button onClick={() => openGoalModal(awayTeam.id)} 
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mx-auto xl:mx-0 w-full xl:w-auto border border-green-500/30">
                        <PlusIcon /> GOL
                    </button> 
                 )}
            </div>
        </div>

        {requiresPenalties && (
            <div className="mt-8 mb-6 bg-slate-900/60 rounded-xl border border-slate-700/50 p-6 animate-slide-down">
                {!inPenaltyMode ? (
                     <div className="text-center">
                         <div className="inline-flex items-center justify-center p-3 bg-slate-800 rounded-full mb-3 text-slate-400 ring-4 ring-slate-800/50"><Target size={24} /></div>
                         <h3 className="text-xl font-bold text-white mb-1">
                             {game.phase === GamePhase.TIE_BREAKER ? 'Disputa de Pênaltis' : 'Decisão por Pênaltis'}
                         </h3>
                         <p className="text-slate-400 text-sm mb-5">O tempo normal terminou empatado.</p>
                         <button onClick={handleStartPenalties} disabled={isProcessing} className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-yellow-900/20 transition-transform active:scale-95 border border-yellow-500/30">INICIAR PÊNALTIS</button>
                     </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4 sm:px-12 bg-slate-950/30 py-6 rounded-xl border border-slate-800/50">
                             <div className="flex flex-col items-center gap-3 w-1/3"><div className="text-4xl font-mono font-bold text-white">{game.penaltyShootout?.homeScore || 0}</div>{renderPenaltyDots(homeTeam.id)}</div>
                             <div className="h-16 w-px bg-slate-700"></div>
                             <div className="flex flex-col items-center gap-3 w-1/3"><div className="text-4xl font-mono font-bold text-white">{game.penaltyShootout?.awayScore || 0}</div>{renderPenaltyDots(awayTeam.id)}</div>
                        </div>
                        {!isPenaltyWinnerDecided ? (
                            <div className="flex flex-col items-center mt-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 relative">
                                {game.penaltyShootout?.history.length! > 0 && (<button onClick={handleUndoPenalty} disabled={isProcessing} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-full"><RotateCcw size={18} /></button>)}
                                <p className="text-slate-400 text-sm mb-4">Cobrança de: <span className={`font-bold text-lg ml-2 ${getTeamTextColor(currentKickerTeam.name)}`}>{currentKickerTeam.name}</span></p>
                                <div className="flex gap-6">
                                    <button onClick={() => handlePenaltyKick(false)} disabled={isProcessing} className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/50 hover:bg-red-500 hover:border-red-500 hover:text-white text-red-500 transition-all active:scale-95 disabled:opacity-50 group/miss"><X size={32} className="group-hover/miss:scale-110 transition-transform" /><span className="font-bold text-xs mt-2 uppercase tracking-wide">Perdeu</span></button>
                                    <button onClick={() => handlePenaltyKick(true)} disabled={isProcessing} className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500/50 hover:bg-green-500 hover:border-green-500 hover:text-white text-green-500 transition-all active:scale-95 disabled:opacity-50 group/goal"><CheckCircle size={32} className="group-hover/goal:scale-110 transition-transform" /><span className="font-bold text-xs mt-2 uppercase tracking-wide">Gol</span></button>
                                </div>
                            </div>
                        ) : (<div className="text-center py-6 bg-gradient-to-b from-green-900/20 to-green-900/10 border border-green-800/50 rounded-xl animate-pulse"><h4 className="text-green-400 font-bold text-xl mb-2">Vencedor Definido!</h4><p className="text-slate-300 text-base">{getPenaltyWinnerName()} venceu nos pênaltis.</p><p className="text-sm text-slate-500 mt-2">Pode encerrar a partida agora.</p></div>)}
                    </div>
                )}
            </div>
        )}

        {showGoalButtons && (
            <div className="bg-slate-900/30 rounded-xl border border-slate-700/30 p-4 mb-4">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2 pl-1"><Zap size={14} className="text-yellow-500" /> Eventos da Partida</h4>
                 {gameGoals.length === 0 ? (<div className="text-center text-slate-600 text-sm italic py-4">Nenhum gol registrado. A partida está morna!</div>) : (
                     <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                         {gameGoals.map((goal) => {
                             const isHomeGoal = goal.teamId === homeTeam.id;
                             return (
                                 <div key={goal.id} className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800 transition-all group/event">
                                     <div className="flex items-center gap-3"><div className={`w-1 h-8 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isHomeGoal ? 'bg-green-500 shadow-green-500/30' : 'bg-green-500 shadow-green-500/30'}`}></div><div><div className="flex items-center gap-2"><span className="text-white font-bold text-sm">{getPlayerName(goal.scorerId)}</span><span className="text-[10px] text-slate-400 bg-slate-950/50 px-2 py-0.5 rounded-full border border-slate-800">{isHomeGoal ? homeTeam.name : awayTeam.name}</span></div>{goal.assistId && (<div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><span className="w-1 h-1 bg-slate-500 rounded-full"></span>Assist: {getPlayerName(goal.assistId)}</div>)}</div></div>
                                     <button onClick={() => openEditGoalModal(goal)} className="p-2 text-slate-600 hover:text-white hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover/event:opacity-100" title="Editar gol"><Edit2 size={14} /></button>
                                 </div>
                             );
                         })}
                     </div>
                 )}
            </div>
        )}

        <div className="pt-5 border-t border-slate-700/50 flex justify-center">
            <div className="flex items-center gap-6">
                <span className="flex items-center gap-2 text-red-500 font-bold animate-pulse text-xs uppercase tracking-widest"><div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_red]"></div> Em Andamento</span>
                {(!requiresPenalties || isPenaltyWinnerDecided) && (<button onClick={handleEndGameClick} className="text-xs text-slate-500 hover:text-white underline transition-colors decoration-slate-600 hover:decoration-white underline-offset-4">Encerrar Partida</button>)}
            </div>
        </div>

        {/* Goal Modal */}
        {scoringTeamId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-slate-800 border border-slate-600/50 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-up">
                    <div className="flex justify-between items-center mb-6"><h4 className="text-xl font-bold text-white flex items-center gap-2">{editingGoalId ? <Edit2 size={20} className="text-blue-400" /> : <div className="p-1.5 bg-green-500/20 rounded-lg"><Plus size={18} className="text-green-400" /></div>} {editingGoalId ? 'Editar Gol' : `Gol: ${scoringTeam?.name}`}</h4><button onClick={() => { setScoringTeamId(null); setEditingGoalId(null); }} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700/50 rounded-full transition-colors"><X size={20} /></button></div>
                    <div className="space-y-5">
                        <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quem fez o gol?</label><div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">{scoringTeam?.players.map(p => (<button key={p.id} onClick={() => setSelectedScorer(p.id)} className={`p-3 text-sm rounded-lg text-left truncate transition-all border ${selectedScorer === p.id ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-900/20 scale-[1.02]' : 'bg-slate-700/50 text-slate-300 border-transparent hover:bg-slate-700 hover:border-slate-600'}`}>{p.name}</button>))}</div></div>
                        {selectedScorer && (<div className="animate-fade-in"><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quem deu a assistência?</label><div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1"><button onClick={() => setSelectedAssist('none')} className={`p-3 text-sm rounded-lg text-left transition-all border ${selectedAssist === 'none' ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-700/50 text-slate-300 border-transparent hover:bg-slate-700 hover:border-slate-600'}`}>Sem assistência</button>{scoringTeam?.players.filter(p => p.id !== selectedScorer).map(p => (<button key={p.id} onClick={() => setSelectedAssist(p.id)} className={`p-3 text-sm rounded-lg text-left truncate transition-all border ${selectedAssist === p.id ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20 scale-[1.02]' : 'bg-slate-700/50 text-slate-300 border-transparent hover:bg-slate-700 hover:border-slate-600'}`}>{p.name}</button>))}</div></div>)}
                        <button onClick={confirmGoal} disabled={!selectedScorer || !selectedAssist || (editingGoalId ? isProcessing : false)} className="w-full mt-2 bg-gradient-to-r from-green-600 to-emerald-600 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-500 hover:to-emerald-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-green-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2">{isProcessing && editingGoalId ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}{editingGoalId ? 'Salvar Alterações' : 'Confirmar Gol'}</button>
                    </div>
                </div>
            </div>
        )}

        {/* End Game Modal */}
        {isEndGameConfirmOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                 <div className="bg-slate-800 border border-slate-600/50 rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                     <div className="flex flex-col items-center text-center space-y-4"><div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20 ring-4 ring-yellow-500/5"><AlertTriangle size={32} className="text-yellow-500" /></div><div><h3 className="text-xl font-bold text-white">Encerrar Partida?</h3><p className="text-slate-400 text-sm mt-2 leading-relaxed">O placar atual será registrado como final e não poderá ser alterado depois.</p>{inPenaltyMode && (<p className="text-xs text-green-400 mt-2 bg-green-900/20 py-1 px-3 rounded-full border border-green-500/20 inline-block">Resultado dos pênaltis será salvo.</p>)}</div><div className="flex gap-3 w-full mt-4"><button onClick={() => setIsEndGameConfirmOpen(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors">Cancelar</button><button onClick={confirmEndGame} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95">Sim, Encerrar</button></div></div>
                 </div>
             </div>
        )}
    </div>
  );
};

const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);

export default LiveMatchControl;