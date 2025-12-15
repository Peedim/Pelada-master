import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Match, Player, MatchStatus, Game, GamePhase } from '../types';
import { matchService } from '../services/matchService';
import { Trophy, Calendar, ChevronDown, ChevronUp, Zap, Image as ImageIcon, Download, Upload, Loader2, Camera } from 'lucide-react';
import { saveAs } from 'file-saver';

interface CareerProps {
  currentUser: Player;
}

const Career: React.FC<CareerProps> = ({ currentUser }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  
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
    // Filtra apenas jogos finalizados onde o jogador participou
    const history = allMatches
      .filter(m => m.status === MatchStatus.FINISHED)
      .filter(m => m.teams.some(t => t.players.some(p => p.id === currentUser.id)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setMatches(history);
    setLoading(false);
  };

  // Helper: Agrupar por Mês
  const groupedMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    matches.forEach(match => {
      const date = new Date(match.date);
      // Ex: "NOVEMBRO"
      const monthYear = date.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(match);
    });
    return groups;
  }, [matches]);

  // Helper: Cores do Time (Mesma lógica do Sorteador)
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

  // Processa dados de uma partida específica para o card
  const getMatchStats = (match: Match) => {
      const playerTeam = match.teams.find(t => t.players.some(p => p.id === currentUser.id));
      const myTeamId = playerTeam?.id;
      
      // Stats Individuais
      let goals = 0;
      let assists = 0;
      match.goals.forEach(g => {
          if (g.scorerId === currentUser.id) goals++;
          if (g.assistId === currentUser.id) assists++;
      });

      // Posição Final
      const standings = matchService.calculateStandings(match);
      const myRank = standings.findIndex(s => s.teamId === myTeamId) + 1;
      const championId = standings[0]?.teamId;
      const championName = standings[0]?.teamName;
      
      // Se for mata-mata (Quadrangular), a lógica de ranking pode ser refinada
      // Mas usar a tabela de pontos é um bom proxy se não salvamos o rank final no banco
      const isChampion = myRank === 1;

      return { 
          goals, 
          assists, 
          rank: myRank, 
          isChampion, 
          championName,
          dateDay: new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      };
  };

  // --- Lógica de Imagem ---
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !uploadTargetMatchId) return;

      setIsUploading(true);
      try {
          // Converter para Base64 (Armazenamento simples, ideal seria Bucket)
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async () => {
              const base64 = reader.result as string;
              await matchService.updateChampionPhoto(uploadTargetMatchId, base64);
              await loadCareer(); // Reload
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
                        const { goals, assists, rank, isChampion, championName, dateDay } = getMatchStats(match);
                        const isExpanded = expandedMatchId === match.id;
                        
                        return (
                            <div key={match.id} className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 transition-all duration-300">
                                
                                {/* RESUMO (Card Principal) */}
                                <div 
                                    onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-750"
                                >
                                    {/* Esquerda: Data e Campeão */}
                                    <div className="flex flex-col items-center gap-2 min-w-[3rem]">
                                        <span className="text-[10px] text-slate-400 font-mono">{dateDay}</span>
                                        {/* Círculo com a cor do campeão */}
                                        <div className={`w-8 h-8 rounded-full border-2 ${getTeamColorClass(championName || '')} shadow-md`}></div>
                                    </div>

                                    {/* Centro: Stats */}
                                    <div className="flex gap-6 text-center">
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase block">GOLS</span>
                                            <span className="text-xl font-black text-emerald-400">{goals}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase block">ASSIST</span>
                                            <span className="text-xl font-black text-emerald-400">{assists}</span>
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
                                        
                                        {/* Lista de Jogos */}
                                        <div className="space-y-2 mb-6">
                                            <h4 className="text-xs text-slate-500 font-bold uppercase mb-2">Confrontos</h4>
                                            {match.games.filter(g => g.status === 'FINISHED').sort((a,b) => a.sequence - b.sequence).map(game => {
                                                const homeName = match.teams.find(t => t.id === game.homeTeamId)?.name || 'Time A';
                                                const awayName = match.teams.find(t => t.id === game.awayTeamId)?.name || 'Time B';
                                                return (
                                                    <div key={game.id} className="flex justify-between items-center text-xs bg-slate-800 p-2 rounded border border-slate-700">
                                                        <span className={`flex-1 text-right font-bold ${getTeamTextColor(homeName)}`}>{homeName}</span>
                                                        <div className="px-3 bg-slate-900 rounded py-0.5 mx-2 text-white font-mono">
                                                            {game.homeScore} - {game.awayScore}
                                                        </div>
                                                        <span className={`flex-1 text-left font-bold ${getTeamTextColor(awayName)}`}>{awayName}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Foto do Campeão */}
                                        <div className="mt-4">
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

                                    </div>
                                )}
                                
                                {/* Indicador de Expandir */}
                                <div 
                                    className={`h-1.5 w-full flex justify-center items-center bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors ${isExpanded ? 'bg-slate-700' : ''}`}
                                    onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                                >
                                    {isExpanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-600" />}
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