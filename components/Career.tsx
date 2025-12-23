import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Match, Player, MatchStatus, Game, GamePhase } from '../types';
import { matchService } from '../services/matchService';
import { Trophy, Calendar, ChevronDown, ChevronUp, Zap, Image as ImageIcon, Download, Upload, Loader2, Camera, Medal, Star, Activity, Shield, Users } from 'lucide-react';
import { saveAs } from 'file-saver';

interface CareerProps {
  currentUser: Player;
}

const Career: React.FC<CareerProps> = ({ currentUser }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Expansão e Abas
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'squads'>('matches');
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetMatchId, setUploadTargetMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadCareer();
  }, []);

  const loadCareer = async () => {
    setLoading(true);
    const allMatches = await matchService.getAll();
    const history = allMatches
      .filter(m => m.status === MatchStatus.FINISHED)
      .filter(m => m.teams.some(t => t.players.some(p => p.id === currentUser.id)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setMatches(history);
    setLoading(false);
  };

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    matches.forEach(match => {
      const date = new Date(match.date);
      const monthYear = date.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(match);
    });
    return groups;
  }, [matches]);

  // Função para abrir/fechar o acordeão e resetar a aba
  const toggleMatch = (matchId: string) => {
      if (expandedMatchId === matchId) {
          setExpandedMatchId(null);
      } else {
          setExpandedMatchId(matchId);
          setActiveTab('matches'); // Sempre volta para a aba principal ao abrir
      }
  };

  const getTeamColorClass = (teamName: string) => {
      if (teamName.includes('Branco')) return 'bg-slate-100 border-slate-300';
      if (teamName.includes('Preto')) return 'bg-slate-950 border-slate-700';
      if (teamName.includes('Vermelho')) return 'bg-red-600 border-red-500';
      if (teamName.includes('Azul')) return 'bg-blue-600 border-blue-500';
      return 'bg-slate-700 border-slate-600';
  };

  const getTeamTextColor = (teamName: string) => {
    if (teamName.includes('Branco')) return 'text-slate-200';
    if (teamName.includes('Preto')) return 'text-slate-400';
    if (teamName.includes('Vermelho')) return 'text-red-500';
    if (teamName.includes('Azul')) return 'text-blue-500';
    return 'text-white';
  };

  const getPlayerName = (match: Match, playerId: string) => {
    for (const team of match.teams) {
      const player = team.players.find(p => p.id === playerId);
      if (player) return player.name;
    }
    return 'Desconhecido';
  };

  const getMatchStats = (match: Match) => {
      const playerTeam = match.teams.find(t => t.players.some(p => p.id === currentUser.id));
      const myTeamId = playerTeam?.id;
      const myTeamName = playerTeam?.name || ''; 
      
      let goals = 0;
      let assists = 0;
      match.goals.forEach(g => {
          if (g.scorerId === currentUser.id) goals++;
          if (g.assistId === currentUser.id) assists++;
      });

      let cleanSheets = 0;
      if (myTeamId) {
          const myGames = match.games.filter(g => 
              g.status === 'FINISHED' && 
              (g.homeTeamId === myTeamId || g.awayTeamId === myTeamId)
          );
          
          myGames.forEach(g => {
              const isHome = g.homeTeamId === myTeamId;
              const opponentScore = isHome ? g.awayScore : g.homeScore;
              if (opponentScore === 0) cleanSheets++;
          });
      }

      const standings = matchService.calculateStandings(match);
      const myRank = standings.findIndex(s => s.teamId === myTeamId) + 1;
      const championName = standings[0]?.teamName;
      const isChampion = myRank === 1;

      return { 
          goals, 
          assists,
          cleanSheets, 
          rank: myRank, 
          isChampion, 
          championName,
          myTeamName,
          dateDay: new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      };
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !uploadTargetMatchId) return;

      setIsUploading(true);
      try {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async () => {
              const base64 = reader.result as string;
              await matchService.updateChampionPhoto(uploadTargetMatchId, base64);
              await loadCareer(); 
              setIsUploading(false);
          };
      } catch (error) {
          console.error(error);
          setIsUploading(false);
      }
  };

  const triggerUpload = (matchId: string) => {
      setUploadTargetMatchId(matchId);
      fileInputRef.current?.click();
  };

  const groupGamesByPhase = (match: Match) => {
      const games = match.games.filter(g => g.status === 'FINISHED');
      const grouped = games.reduce((acc, game) => {
          const phase = game.phase || 'OUTROS';
          if (!acc[phase]) acc[phase] = [];
          acc[phase].push(game);
          return acc;
      }, {} as Record<string, Game[]>);
      return grouped;
  };

  const phaseLabels: Record<string, string> = {
      [GamePhase.FINAL]: 'Grande Final',
      [GamePhase.THIRD_PLACE]: 'Disputa de 3º Lugar',
      [GamePhase.PHASE_2]: 'Fase Intermediária',
      [GamePhase.PHASE_1]: 'Fase de Classificação'
  };

  const phaseOrder = [GamePhase.FINAL, GamePhase.THIRD_PLACE, GamePhase.PHASE_2, GamePhase.PHASE_1];

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen pb-20">
              <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
              <p className="text-slate-500 mt-2">Carregando carreira...</p>
          </div>
      );
  }

  return (
    <div className="w-full max-w-lg mx-auto pb-24 animate-fade-in pt-6 px-4">
        
        <div className="text-center mb-8">
            <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">PELADA MANAGER</h2>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">CARREIRA</h1>
        </div>

        {Object.keys(groupedMatches).length === 0 && (
            <div className="text-center text-slate-500 py-10 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                Você ainda não participou de jogos finalizados.
            </div>
        )}

        {Object.entries(groupedMatches).map(([month, monthMatches]) => (
            <div key={month} className="mb-8">
                <h3 className="text-slate-400 text-xs font-bold uppercase mb-3 pl-2 border-l-2 border-slate-600">{month}</h3>
                
                <div className="space-y-3">
                    {monthMatches.map(match => {
                        const { goals, assists, cleanSheets, rank, isChampion, championName, myTeamName, dateDay } = getMatchStats(match);
                        const isExpanded = expandedMatchId === match.id;
                        const groupedGames = groupGamesByPhase(match);
                        
                        return (
                            <div key={match.id} className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 transition-all duration-300">
                                
                                {/* RESUMO (Card Principal) */}
                                <div 
                                    onClick={() => toggleMatch(match.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-750"
                                >
                                    {/* Esquerda: Data e COR DO MEU TIME */}
                                    <div className="flex flex-col items-center gap-2 min-w-[3rem]">
                                        <span className="text-[10px] text-slate-400 font-mono">{dateDay}</span>
                                        <div 
                                            className={`w-8 h-8 rounded-full border-2 ${getTeamColorClass(myTeamName)} shadow-md`}
                                            title={`Você jogou pelo time: ${myTeamName}`}
                                        ></div>
                                    </div>

                                    {/* Centro: Stats */}
                                    <div className="flex gap-4 sm:gap-6 text-center">
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase block">GOLS</span>
                                            <span className="text-xl font-black text-emerald-400">{goals}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase block">ASSIST</span>
                                            <span className="text-xl font-black text-emerald-400">{assists}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase block" title="Clean Sheets">CS</span>
                                            <span className="text-xl font-black text-emerald-400">{cleanSheets}</span>
                                        </div>
                                    </div>

                                    {/* Direita: Posição */}
                                    <div className="min-w-[3rem] flex justify-end">
                                        {isChampion ? (
                                            <div className="bg-green-500/10 p-2 rounded-lg border border-green-500/30">
                                                <Trophy size={24} className="text-green-500" />
                                            </div>
                                        ) : (
                                            <span className="text-3xl font-black text-slate-600">{rank}º</span>
                                        )}
                                    </div>
                                </div>

                                {/* DETALHES (Accordion) */}
                                {isExpanded && (
                                    <div className="bg-slate-900/50 border-t border-slate-700 p-4 animate-slide-down">
                                        
                                        {/* NAVEGAÇÃO DE ABAS */}
                                        <div className="flex gap-4 mb-5 border-b border-slate-700/50">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveTab('matches'); }}
                                                className={`pb-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'matches' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <Activity size={16} /> Partidas
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveTab('squads'); }}
                                                className={`pb-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'squads' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <Users size={16} /> Elencos
                                            </button>
                                        </div>

                                        {/* --- ABA DE PARTIDAS --- */}
                                        {activeTab === 'matches' && (
                                            <>
                                                <div className="space-y-6 mb-6">
                                                    {phaseOrder.map(phase => {
                                                        const games = groupedGames[phase];
                                                        if (!games || games.length === 0) return null;

                                                        let phaseIcon = <Activity size={12} />;
                                                        let phaseColor = "text-slate-500";
                                                        
                                                        if (phase === GamePhase.FINAL) {
                                                            phaseIcon = <Trophy size={12} />;
                                                            phaseColor = "text-yellow-500";
                                                        } else if (phase === GamePhase.THIRD_PLACE) {
                                                            phaseIcon = <Medal size={12} />;
                                                            phaseColor = "text-orange-400";
                                                        } else if (phase === GamePhase.PHASE_2) {
                                                            phaseIcon = <Star size={12} />;
                                                            phaseColor = "text-blue-400";
                                                        }

                                                        return (
                                                            <div key={phase}>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${phaseColor}`}>
                                                                        {phaseIcon} {phaseLabels[phase] || phase}
                                                                    </span>
                                                                    <div className="h-px flex-1 bg-slate-800"></div>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {games.sort((a,b) => a.sequence - b.sequence).map(game => {
                                                                        const homeName = match.teams.find(t => t.id === game.homeTeamId)?.name || 'Time A';
                                                                        const awayName = match.teams.find(t => t.id === game.awayTeamId)?.name || 'Time B';
                                                                        const gameGoals = match.goals.filter(g => g.gameId === game.id);

                                                                        return (
                                                                            <div key={game.id} className="bg-slate-800 p-2 rounded border border-slate-700/50">
                                                                                <div className="flex justify-between items-center text-xs mb-1.5">
                                                                                    <span className="flex-1 text-right font-bold text-slate-200">{homeName}</span>
                                                                                    <div className="px-3 bg-slate-900 rounded py-0.5 mx-2 text-white font-mono border border-slate-700">
                                                                                        {game.homeScore} - {game.awayScore}
                                                                                    </div>
                                                                                    <span className="flex-1 text-left font-bold text-slate-200">{awayName}</span>
                                                                                </div>

                                                                                {gameGoals.length > 0 && (
                                                                                    <div className="mt-2 pt-2 border-t border-slate-700/30 flex flex-col items-center gap-1">
                                                                                        {gameGoals.map(goal => {
                                                                                            const isMe = goal.scorerId === currentUser.id;
                                                                                            const isMyAssist = goal.assistId === currentUser.id;
                                                                                            return (
                                                                                                <div key={goal.id} className="text-[10px] flex items-center justify-center gap-1.5 flex-wrap text-slate-400">
                                                                                                    <Zap size={10} className={isMe ? "text-emerald-400" : "text-yellow-500"} />
                                                                                                    <span className={`${isMe ? "text-emerald-400 font-bold" : "text-slate-300"}`}>
                                                                                                        {getPlayerName(match, goal.scorerId)}
                                                                                                    </span>
                                                                                                    {goal.assistId && (
                                                                                                        <span className="text-slate-500">
                                                                                                            (ast. <span className={isMyAssist ? "text-emerald-400 font-bold" : ""}>{getPlayerName(match, goal.assistId)}</span>)
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                                    <h4 className="text-xs text-yellow-500 font-bold uppercase mb-2 flex items-center gap-1">
                                                        <Trophy size={12} /> Campeão: {championName}
                                                    </h4>
                                                    
                                                    {match.champion_photo_url ? (
                                                        <div className="relative group rounded-lg overflow-hidden border border-slate-700 shadow-xl">
                                                            <img src={match.champion_photo_url} className="w-full h-auto object-cover" alt="Campeão" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <button 
                                                                    onClick={() => saveAs(match.champion_photo_url!, `Campeao_${dateDay}.png`)} 
                                                                    className="p-2 bg-white text-slate-900 rounded-full hover:bg-slate-200 transition-colors"
                                                                >
                                                                    <Download size={20} />
                                                                </button>
                                                                {currentUser.is_admin && (
                                                                    <button 
                                                                        onClick={() => triggerUpload(match.id)}
                                                                        className="p-2 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors"
                                                                    >
                                                                        <Camera size={20} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            onClick={() => currentUser.is_admin && triggerUpload(match.id)}
                                                            className={`border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-slate-500 ${currentUser.is_admin ? 'cursor-pointer hover:border-slate-500 hover:bg-slate-800' : ''} transition-all`}
                                                        >
                                                            <ImageIcon size={32} className="mb-2 opacity-50" />
                                                            <p className="text-xs">Foto oficial não disponível</p>
                                                            {currentUser.is_admin && <p className="text-[10px] text-green-500 mt-1">Clique para adicionar</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {/* --- ABA DE ELENCOS --- */}
                                        {activeTab === 'squads' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {match.teams.map(team => (
                                                    <div key={team.id} className="bg-slate-800 rounded border border-slate-700 overflow-hidden">
                                                        <div className="bg-slate-700/30 px-3 py-2 border-b border-slate-700 flex justify-between items-center">
                                                            <span className="font-bold text-white text-sm">{team.name}</span>
                                                            {/* Se quiser mostrar o OVR Médio */}
                                                            {team.avgOvr && <span className="text-xs bg-slate-900 px-2 py-0.5 rounded text-slate-400">{team.avgOvr} OVR</span>}
                                                        </div>
                                                        <div className="p-2 space-y-1">
                                                            {team.players.map(player => (
                                                                <div key={player.id} className={`flex justify-between items-center text-xs p-1 rounded ${player.id === currentUser.id ? 'bg-green-500/10 border border-green-500/20' : 'hover:bg-slate-700/20'}`}>
                                                                    <span className={player.id === currentUser.id ? 'text-green-400 font-bold' : 'text-slate-300'}>
                                                                        {player.name}
                                                                    </span>
                                                                    <span className="text-slate-500">{player.position}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                    </div>
                                )}
                                
                                {/* Indicador de Expandir */}
                                <div 
                                    className={`h-4 w-full flex justify-center items-center bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors ${isExpanded ? 'bg-slate-700' : ''}`}
                                    onClick={() => toggleMatch(match.id)}
                                >
                                    {isExpanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-600" />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}
        
        {/* Input Oculto para Upload */}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
    </div>
  );
};

export default Career;