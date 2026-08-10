import React, { useState } from 'react';
import { Match, Game, Goal, Team } from '../types';
import { matchService } from '../services/matchService';
import { X, CheckCircle, Edit2, Plus, Trash2, Loader2, Zap } from 'lucide-react';

interface GameEditModalProps {
  match: Match;
  game: Game;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedMatch: Match) => void;
}

const GameEditModal: React.FC<GameEditModalProps> = ({
  match,
  game,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [scoringTeamId, setScoringTeamId] = useState<string | null>(null);
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const [selectedAssist, setSelectedAssist] = useState<string | null>('none');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const homeTeam = match.teams.find(t => t.id === game.homeTeamId);
  const awayTeam = match.teams.find(t => t.id === game.awayTeamId);

  if (!homeTeam || !awayTeam) return null;

  const currentGame = match.games.find(g => g.id === game.id) || game;
  const gameGoals = match.goals?.filter(g => g.gameId === game.id) || [];
  const scoringTeam = scoringTeamId === homeTeam.id ? homeTeam : awayTeam;

  const getPlayerName = (playerId: string) => {
    const p = homeTeam.players.find(pl => pl.id === playerId) || awayTeam.players.find(pl => pl.id === playerId);
    return p ? p.name : 'Desconhecido';
  };

  const getTeamName = (teamId: string) => {
    return match.teams.find(t => t.id === teamId)?.name || 'Time';
  };

  const openAddGoalModal = (teamId: string) => {
    setScoringTeamId(teamId);
    setSelectedScorer(null);
    setSelectedAssist('none');
    setEditingGoalId(null);
    setErrorMessage(null);
  };

  const openEditGoalModal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setScoringTeamId(goal.teamId);
    setSelectedScorer(goal.scorerId);
    setSelectedAssist(goal.assistId || 'none');
    setErrorMessage(null);
  };

  const closeSubModal = () => {
    setScoringTeamId(null);
    setEditingGoalId(null);
    setSelectedScorer(null);
    setSelectedAssist('none');
    setErrorMessage(null);
  };

  const handleConfirmGoal = async () => {
    if (!scoringTeamId || !selectedScorer || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let updated: Match;
      const assist = selectedAssist === 'none' ? null : selectedAssist;

      if (editingGoalId) {
        updated = await matchService.updateGoal(match.id, editingGoalId, selectedScorer, assist);
      } else {
        updated = await matchService.scoreGoal(match.id, game.id, scoringTeamId, selectedScorer, assist);
      }

      onUpdate(updated);
      closeSubModal();
    } catch (err: any) {
      console.error('Erro ao salvar gol:', err);
      setErrorMessage(err.message || 'Erro ao salvar alterações no gol.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const updated = await matchService.deleteGoal(match.id, game.id, goalId);
      onUpdate(updated);
      closeSubModal();
    } catch (err: any) {
      console.error('Erro ao excluir gol:', err);
      setErrorMessage(err.message || 'Erro ao excluir gol.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-700 mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Edit2 size={20} className="text-green-400" />
              Editar Placar e Gols
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">{game.phase} • Partida entre os times</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Score Display */}
        <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/60 mb-6 flex items-center justify-between">
          <div className="flex-1 text-center font-bold text-slate-200 text-sm sm:text-base truncate px-2">
            {homeTeam.name}
          </div>
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">
            <span className="text-3xl font-mono font-bold text-white">{currentGame.homeScore}</span>
            <span className="text-slate-600 font-bold">:</span>
            <span className="text-3xl font-mono font-bold text-white">{currentGame.awayScore}</span>
          </div>
          <div className="flex-1 text-center font-bold text-slate-200 text-sm sm:text-base truncate px-2">
            {awayTeam.name}
          </div>
        </div>

        {/* Add Goal Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => openAddGoalModal(homeTeam.id)}
            className="bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-400 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Plus size={16} /> + Gol ({homeTeam.name})
          </button>
          <button
            onClick={() => openAddGoalModal(awayTeam.id)}
            className="bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-400 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Plus size={16} /> + Gol ({awayTeam.name})
          </button>
        </div>

        {/* Goals List Header */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          <Zap size={14} className="text-yellow-500" />
          Gols Registrados nesta Partida ({gameGoals.length})
        </div>

        {/* Goals List Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[120px] max-h-[220px]">
          {gameGoals.length === 0 ? (
            <div className="text-center text-slate-500 text-xs italic py-8 border border-dashed border-slate-700/50 rounded-xl">
              Nenhum gol registrado para esta partida.
            </div>
          ) : (
            gameGoals.map((goal) => {
              const isHomeGoal = goal.teamId === homeTeam.id;
              return (
                <div
                  key={goal.id}
                  className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-8 rounded-full ${isHomeGoal ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{getPlayerName(goal.scorerId)}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                          {getTeamName(goal.teamId)}
                        </span>
                      </div>
                      {goal.assistId && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Assistência: <span className="text-slate-400 font-medium">{getPlayerName(goal.assistId)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditGoalModal(goal)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Editar Gol"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={isProcessing}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Excluir Gol"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors"
          >
            Concluído
          </button>
        </div>

        {/* Sub-modal: Adicionar / Editar Gol */}
        {scoringTeamId && (
          <div className="absolute inset-0 z-[80] bg-slate-900/95 backdrop-blur-md p-6 flex flex-col animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                {editingGoalId ? <Edit2 size={18} className="text-blue-400" /> : <Plus size={18} className="text-green-400" />}
                {editingGoalId ? 'Editar Gol' : `Adicionar Gol: ${scoringTeam?.name}`}
              </h4>
              <button
                onClick={closeSubModal}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-2.5 rounded-lg text-xs mb-3">
                {errorMessage}
              </div>
            )}

            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Quem fez o gol?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {scoringTeam?.players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedScorer(p.id)}
                      className={`p-2.5 text-xs rounded-xl text-left truncate transition-all border ${
                        selectedScorer === p.id
                          ? 'bg-green-600 text-white border-green-500 shadow-md'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedScorer && (
                <div className="animate-fade-in">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Quem deu a assistência?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedAssist('none')}
                      className={`p-2.5 text-xs rounded-xl text-left transition-all border ${
                        selectedAssist === 'none'
                          ? 'bg-slate-600 text-white border-slate-500 font-bold'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      Sem assistência
                    </button>
                    {scoringTeam?.players
                      .filter(p => p.id !== selectedScorer)
                      .map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedAssist(p.id)}
                          className={`p-2.5 text-xs rounded-xl text-left truncate transition-all border ${
                            selectedAssist === p.id
                              ? 'bg-blue-600 text-white border-blue-500 shadow-md font-bold'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-700 mt-2">
              {editingGoalId && (
                <button
                  onClick={() => handleDeleteGoal(editingGoalId)}
                  disabled={isProcessing}
                  className="px-4 py-3 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              )}
              <button
                onClick={handleConfirmGoal}
                disabled={!selectedScorer || isProcessing}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-3 rounded-xl font-bold text-xs shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {editingGoalId ? 'Salvar Alterações' : 'Confirmar Gol'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameEditModal;
