
import React, { useEffect, useState } from 'react';
import { Match, MatchStatus, Player, Game, Goal } from '../types';
import { matchService } from '../services/matchService';
import { Trophy, Calendar, AlertCircle, ChevronDown, ChevronUp, Users, Activity, Zap, Medal } from 'lucide-react';

interface MatchHistoryProps {
  onSelectMatch: (matchId: string) => void;
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ onSelectMatch }) => {
  const [history, setHistory] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const allMatches = await matchService.getAll();
      const finished = allMatches
        .filter(m => m.status === MatchStatus.FINISHED)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(finished);
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const getChampionName = (match: Match) => {
    if (match.type === 'Quadrangular') {
      const finalGame = match.games.find(g => g.phase === 'FINAL' && g.status === 'FINISHED');
      if (finalGame) {
        if (finalGame.homeScore > finalGame.awayScore) return match.teams.find(t => t.id === finalGame.homeTeamId)?.name;
        if (finalGame.awayScore > finalGame.homeScore) return match.teams.find(t => t.id === finalGame.awayTeamId)?.name;
        // Check standings if draw/penalties logic missing
      }
    }
    const standings = matchService.calculateStandings(match);
    return standings[0]?.teamName;
  };

  const getPlayerName = (match: Match, playerId: string) => {
    for (const team of match.teams) {
      const player = team.players.find(p => p.id === playerId);
      if (player) return player.name;
    }
    return 'Desconhecido';
  };

  const getTeamName = (match: Match, teamId: string) => {
    return match.teams.find(t => t.id === teamId)?.name || 'Time';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in pb-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="text-yellow-500" />
          Galeria de Troféus
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Histórico de eventos realizados. Clique em um evento para ver os detalhes.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-700">
            <AlertCircle className="text-slate-500" size={32} />
          </div>
          <h3 className="text-white font-medium mb-1">Nenhum evento finalizado</h3>
          <p className="text-slate-500 text-sm">Os eventos encerrados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.map(match => {
            const isExpanded = expandedId === match.id;
            const championName = getChampionName(match) || 'Indefinido';

            return (
              <div 
                  key={match.id} 
                  className={`bg-slate-800 border transition-all overflow-hidden rounded-lg ${isExpanded ? 'border-green-500 ring-1 ring-green-500/50' : 'border-slate-700 hover:border-slate-600'}`}
              >
                {/* Card Header (Clickable) */}
                <div 
                  onClick={() => toggleExpand(match.id)}
                  className="p-5 flex flex-col md:flex-row items-center justify-between gap-4 cursor-pointer relative bg-slate-800 z-10 hover:bg-slate-750 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded uppercase tracking-wider">
                        {match.type}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar size={12} /> {new Date(match.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Pelada em {match.location}</h3>
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                      <Trophy size={14} />
                      <span className="font-semibold">Campeão: {championName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center hidden sm:block">
                      <span className="block text-xl font-bold text-white">{match.goals?.length || 0}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Gols</span>
                    </div>
                    <div className="text-slate-500">
                       {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Accordion Content */}
                {isExpanded && (
                   <MatchDetails match={match} getPlayerName={getPlayerName} getTeamName={getTeamName} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Internal component for details
const MatchDetails: React.FC<{ 
    match: Match; 
    getPlayerName: (m: Match, id: string) => string;
    getTeamName: (m: Match, id: string) => string;
}> = ({ match, getPlayerName, getTeamName }) => {
    const [activeTab, setActiveTab] = useState<'squads' | 'matches'>('matches');

    return (
        <div className="border-t border-slate-700 bg-slate-900/50 p-4 animate-slide-down">
            {/* Tabs */}
            <div className="flex gap-4 mb-4 border-b border-slate-700">
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveTab('matches'); }}
                    className={`pb-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'matches' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-400 hover:text-white'}`}
                >
                    <Activity size={16} /> Partidas & Gols
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveTab('squads'); }}
                    className={`pb-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'squads' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-400 hover:text-white'}`}
                >
                    <Users size={16} /> Elencos
                </button>
            </div>

            {/* Content: Matches */}
            {activeTab === 'matches' && (
                <div className="space-y-4">
                    {match.games.filter(g => g.status === 'FINISHED').sort((a,b) => b.sequence - a.sequence).map(game => {
                        const gameGoals = match.goals?.filter(gl => gl.gameId === game.id) || [];
                        return (
                            <div key={game.id} className="bg-slate-800 rounded border border-slate-700 p-3">
                                {/* Scoreboard Header */}
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
                                    <div className="flex-1 text-right font-bold text-slate-200">{getTeamName(match, game.homeTeamId)}</div>
                                    <div className="px-4 flex items-center gap-2">
                                        <span className="text-xl font-mono text-white bg-slate-900 px-2 rounded">{game.homeScore}</span>
                                        <span className="text-slate-600 text-xs">x</span>
                                        <span className="text-xl font-mono text-white bg-slate-900 px-2 rounded">{game.awayScore}</span>
                                    </div>
                                    <div className="flex-1 text-left font-bold text-slate-200">{getTeamName(match, game.awayTeamId)}</div>
                                </div>

                                {/* Goals List */}
                                {gameGoals.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {gameGoals.map(goal => (
                                            <div key={goal.id} className="text-xs flex items-center justify-center gap-2 text-slate-400">
                                                <Zap size={10} className="text-yellow-500" />
                                                <span className="text-slate-300 font-medium">{getPlayerName(match, goal.scorerId)}</span>
                                                {goal.assistId && (
                                                    <span className="text-slate-500 italic">
                                                        (ast. {getPlayerName(match, goal.assistId)})
                                                    </span>
                                                )}
                                                <span className="bg-slate-700 px-1.5 rounded text-[10px] text-slate-400">
                                                    {getTeamName(match, goal.teamId)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-xs text-slate-600 italic">Sem gols registrados</div>
                                )}
                            </div>
                        );
                    })}
                    {match.games.filter(g => g.status === 'FINISHED').length === 0 && (
                        <div className="text-center text-slate-500 py-4">Nenhuma partida registrada com placar.</div>
                    )}
                </div>
            )}

            {/* Content: Squads */}
            {activeTab === 'squads' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {match.teams.map(team => (
                        <div key={team.id} className="bg-slate-800 rounded border border-slate-700 overflow-hidden">
                            <div className="bg-slate-700/30 px-3 py-2 border-b border-slate-700 flex justify-between items-center">
                                <span className="font-bold text-white text-sm">{team.name}</span>
                                <span className="text-xs bg-slate-900 px-2 py-0.5 rounded text-slate-400">{team.avgOvr} OVR</span>
                            </div>
                            <div className="p-2 space-y-1">
                                {team.players.map(player => (
                                    <div key={player.id} className="flex justify-between items-center text-xs p-1 hover:bg-slate-700/20 rounded">
                                        <span className="text-slate-300">{player.name}</span>
                                        <span className="text-slate-500">{player.position}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MatchHistory;
