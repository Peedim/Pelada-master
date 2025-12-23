import React, { useEffect, useState } from 'react';
import { Match, MatchStatus, Player, Game, Goal, GamePhase } from '../types';
import { matchService } from '../services/matchService';
import { Trophy, Calendar, AlertCircle, ChevronDown, ChevronUp, Users, Activity, Zap, Medal, Star } from 'lucide-react';

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
          Histórico de eventos realizados e seus campeões.
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
                {/* Card Header */}
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

                {/* Expanded Details */}
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

    // Agrupamento por Fase
    const gamesByPhase = match.games
        .filter(g => g.status === 'FINISHED')
        .reduce((acc, game) => {
            const phase = game.phase || 'OUTROS';
            if (!acc[phase]) acc[phase] = [];
            acc[phase].push(game);
            return acc;
        }, {} as Record<string, Game[]>);

    // Ordem de exibição das fases (Inverso da cronologia para destaque nas finais)
    const phaseOrder = [GamePhase.FINAL, GamePhase.THIRD_PLACE, GamePhase.PHASE_2, GamePhase.PHASE_1];
    
    const phaseLabels: Record<string, string> = {
        [GamePhase.FINAL]: 'Grande Final',
        [GamePhase.THIRD_PLACE]: 'Disputa de 3º Lugar',
        [GamePhase.PHASE_2]: 'Fase Intermediária',
        [GamePhase.PHASE_1]: 'Fase de Classificação'
    };

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

            {/* Content: Matches (AGORA COM DIVISÃO DE FASES) */}
            {activeTab === 'matches' && (
                <div className="space-y-6">
                    {phaseOrder.map(phase => {
                        const games = gamesByPhase[phase];
                        if (!games || games.length === 0) return null;

                        // Ícone e Cor baseados na fase
                        let phaseIcon = <Activity size={14} />;
                        let phaseColor = "text-slate-400";
                        let borderColor = "border-slate-700";

                        if (phase === GamePhase.FINAL) {
                            phaseIcon = <Trophy size={14} />;
                            phaseColor = "text-yellow-500";
                            borderColor = "border-yellow-500/30";
                        } else if (phase === GamePhase.THIRD_PLACE) {
                            phaseIcon = <Medal size={14} />;
                            phaseColor = "text-orange-400";
                        } else if (phase === GamePhase.PHASE_2) {
                            phaseIcon = <Star size={14} />;
                            phaseColor = "text-blue-400";
                        }

                        return (
                            <div key={phase} className="animate-fade-in">
                                {/* Cabeçalho da Fase */}
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${phaseColor}`}>
                                        {phaseIcon} {phaseLabels[phase] || phase}
                                    </span>
                                    <div className={`h-px flex-1 bg-gradient-to-r from-slate-700 to-transparent`}></div>
                                </div>

                                {/* Lista de Jogos da Fase */}
                                <div className="space-y-3">
                                    {games.sort((a,b) => b.sequence - a.sequence).map(game => {
                                        const gameGoals = match.goals?.filter(gl => gl.gameId === game.id) || [];
                                        const isFinal = phase === GamePhase.FINAL;
                                        
                                        return (
                                            <div key={game.id} className={`bg-slate-800 rounded border p-3 ${isFinal ? 'border-yellow-500/30 ring-1 ring-yellow-500/10' : 'border-slate-700'}`}>
                                                {/* Scoreboard */}
                                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
                                                    <div className="flex-1 text-right font-bold text-slate-200 text-sm sm:text-base">{getTeamName(match, game.homeTeamId)}</div>
                                                    <div className="px-3 flex items-center gap-2">
                                                        <span className={`text-lg font-mono font-bold px-2 rounded ${isFinal ? 'text-yellow-400 bg-yellow-900/20' : 'text-white bg-slate-900'}`}>{game.homeScore}</span>
                                                        <span className="text-slate-600 text-xs">x</span>
                                                        <span className={`text-lg font-mono font-bold px-2 rounded ${isFinal ? 'text-yellow-400 bg-yellow-900/20' : 'text-white bg-slate-900'}`}>{game.awayScore}</span>
                                                    </div>
                                                    <div className="flex-1 text-left font-bold text-slate-200 text-sm sm:text-base">{getTeamName(match, game.awayTeamId)}</div>
                                                </div>

                                                {/* Goals List */}
                                                {gameGoals.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {gameGoals.map(goal => (
                                                            <div key={goal.id} className="text-xs flex items-center justify-center gap-2 text-slate-400 flex-wrap">
                                                                <Zap size={10} className="text-yellow-500" />
                                                                <span className="text-slate-300 font-medium">{getPlayerName(match, goal.scorerId)}</span>
                                                                {goal.assistId && (
                                                                    <span className="text-slate-500 italic">
                                                                        (ast. {getPlayerName(match, goal.assistId)})
                                                                    </span>
                                                                )}
                                                                <span className="bg-slate-700/50 px-1.5 rounded text-[10px] text-slate-500 border border-slate-700">
                                                                    {getTeamName(match, goal.teamId)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-[10px] text-slate-600 italic">Sem gols registrados</div>
                                                )}
                                                
                                                {/* Pênaltis Info (se houver) */}
                                                {game.homeScore === game.awayScore && game.penaltyShootout && (
                                                    <div className="mt-2 text-center pt-2 border-t border-slate-700/30">
                                                        <span className="text-xs text-slate-400">Pênaltis: </span>
                                                        <span className="text-xs font-bold text-white">
                                                            {game.penaltyShootout.homeScore} - {game.penaltyShootout.awayScore}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    
                    {match.games.filter(g => g.status === 'FINISHED').length === 0 && (
                        <div className="text-center text-slate-500 py-8 border-2 border-dashed border-slate-700 rounded-lg">
                            Nenhuma partida registrada com placar neste evento.
                        </div>
                    )}
                </div>
            )}

            {/* Content: Squads (Mantido Igual) */}
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