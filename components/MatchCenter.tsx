import React, { useEffect, useState, useMemo } from 'react';
import { Match, GameStatus, Team } from '../types';
import { matchService } from '../services/matchService';
import { supabase } from '../services/supabaseClient';
import { formationService, TacticalSetup, AVAILABLE_FORMATIONS } from '../services/formationService';
import TacticalBoard from './TacticalBoard';
import { ArrowLeft, RefreshCw, Clock, Calendar, Zap, ShieldAlert, Trophy, Users, Medal, Footprints, Shield, TrendingUp, Percent, MoveRight, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Componentes Shadcn
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MatchCenterProps {
  matchId: string;
  onBack: () => void;
}

type TableEntry = { teamId: string; name: string; points: number; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDiff: number; isLive: boolean; };
type StatEntry = { playerId: string; name: string; teamName: string; photoUrl?: string; count: number; position?: string; };

const OVR_WEIGHTS: Record<string, { pace: number; shooting: number; passing: number; defending: number }> = {
  'Goleiro': { pace: 0.2, shooting: 0.05, passing: 0.15, defending: 0.6 },
  'Defensor': { pace: 0.2, shooting: 0.05, passing: 0.25, defending: 0.5 },
  'Meio-campo': { pace: 0.2, shooting: 0.2, passing: 0.5, defending: 0.1 },
  'Atacante': { pace: 0.2, shooting: 0.6, passing: 0.15, defending: 0.05 },
  'default': { pace: 0.25, shooting: 0.25, passing: 0.25, defending: 0.25 },
};

const MatchCenter: React.FC<MatchCenterProps> = ({ matchId, onBack }) => {
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [tacticalSetup, setTacticalSetup] = useState<TacticalSetup | null>(null);
  const [fullTeamPlayers, setFullTeamPlayers] = useState<any[]>([]);
  
  // Novo estado para contagem de jogos do mês (para a média justa)
  const [playerMatchCounts, setPlayerMatchCounts] = useState<Record<string, number>>({});
  
  const [homeImgError, setHomeImgError] = useState(false);
  const [awayImgError, setAwayImgError] = useState(false);

  useEffect(() => {
    loadData();
    const subscription = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => loadData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => loadData(false))
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [matchId]);

  const saveTacticsLocally = (teamId: string, setup: TacticalSetup) => {
    try { localStorage.setItem(`c13_tactics_${matchId}_${teamId}`, JSON.stringify(setup)); } catch (e) { console.error(e); }
  };

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Busca a partida atual
      const matchData = await matchService.getById(matchId);
      if (!matchData) throw new Error("Partida não encontrada");
      setMatch(matchData);

      // 2. Busca TODAS as partidas para calcular a média de jogos do mês (Lógica Justa)
      const allMatches = await matchService.getAll();
      const now = new Date();
      const currentMonthMatches = allMatches.filter(m => {
          const mDate = new Date(m.date);
          return mDate.getMonth() === now.getMonth() && mDate.getFullYear() === now.getFullYear();
      });

      // Cria um mapa: { 'player_id': qtd_jogos }
      const counts: Record<string, number> = {};
      // Varre todos os times da partida atual para preencher o mapa
      matchData.teams.forEach(t => t.players.forEach(p => {
          const played = currentMonthMatches.filter(m => 
              m.teams.some(team => team.players.some(pl => pl.id === p.id))
          ).length;
          counts[p.id] = played > 0 ? played : 1; // Evita divisão por zero
      }));
      setPlayerMatchCounts(counts);

      // 3. Configurações do Time do Usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (matchData.teams && !tacticalSetup) { 
        let foundTeam: Team | undefined;
        if (user) { for (const team of matchData.teams) { if (team.players.some(p => p.email === user.email || p.id === user.id)) { foundTeam = team; break; } } }
        const teamToUse = foundTeam || matchData.teams[0];
        if (teamToUse) {
            setMyTeamId(teamToUse.id);
            setFullTeamPlayers(teamToUse.players);
            const savedTactics = localStorage.getItem(`c13_tactics_${matchId}_${teamToUse.id}`);
            if (savedTactics) { try { setTacticalSetup(JSON.parse(savedTactics)); } catch (e) { setTacticalSetup(formationService.suggestTacticalSetup(teamToUse.players)); } } 
            else { setTacticalSetup(formationService.suggestTacticalSetup(teamToUse.players)); }
        }
      }
    } catch (error) { console.error(error); } 
    finally { if (showLoading) setLoading(false); }
  };

  const getTeamBarColor = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('branco')) return 'bg-slate-200 text-slate-900'; 
      if (lower.includes('amarelo')) return 'bg-yellow-400 text-slate-900';
      if (lower.includes('rosa')) return 'bg-pink-300 text-slate-900';
      if (lower.includes('preto')) return 'bg-slate-950 text-white border-r border-slate-800';
      if (lower.includes('vermelho')) return 'bg-red-600 text-white';
      if (lower.includes('azul')) return 'bg-blue-600 text-white';
      if (lower.includes('verde')) return 'bg-emerald-600 text-white';
      if (lower.includes('laranja')) return 'bg-orange-500 text-white';
      return 'bg-slate-500 text-white';
  };

  // --- ESTATÍSTICAS DO MEU TIME (Com Divisor Justo) ---
  const myTeamStats = useMemo(() => {
      if (!fullTeamPlayers || fullTeamPlayers.length === 0 || !match) return [];

      return fullTeamPlayers.map(player => {
          const goals = match.goals.filter(g => g.scorerId === player.id).length;
          const assists = match.goals.filter(g => g.assistId === player.id).length;

          const w = OVR_WEIGHTS[player.position] || OVR_WEIGHTS['default'];
          const divisor = playerMatchCounts[player.id] || 1; // <--- O PULO DO GATO 😺

          // Calcula média ponderada (exatamente como no service)
          const weightedAcc = 
              (((player.accumulators?.pace || 0) / divisor) * w.pace) + 
              (((player.accumulators?.shooting || 0) / divisor) * w.shooting) + 
              (((player.accumulators?.passing || 0) / divisor) * w.passing) + 
              (((player.accumulators?.defending || 0) / divisor) * w.defending);

          return { ...player, goals, assists, totalAcc: weightedAcc };
      }).sort((a, b) => {
          if (b.goals !== a.goals) return b.goals - a.goals;
          return b.assists - a.assists;
      });
  }, [fullTeamPlayers, match, playerMatchCounts]); // <--- Dependência nova

  const renderPhaseIcon = (acc: number) => {
      // Ajustado: Como dividimos, os valores ficam menores, mantemos a sensibilidade alta
      if (acc >= 0.1) return <div className="flex items-center justify-center text-emerald-500"><TrendingUp size={16} /></div>;
      if (acc <= -0.1) return <div className="flex items-center justify-center text-red-500"><TrendingDown size={16} /></div>;
      return <div className="flex items-center justify-center text-slate-500"><Minus size={16} /></div>;
  };

  // --- WIN PROBABILITY (Com Divisor Justo) ---
  const winProbability = useMemo(() => {
      const targetGame = match?.games.find(g => g.status === GameStatus.LIVE) || 
                         match?.games.find(g => g.status === GameStatus.WAITING && g.homeTeamId !== 'TBD');
      if (!match || !targetGame) return null;
      const homeTeam = match.teams.find(t => t.id === targetGame.homeTeamId);
      const awayTeam = match.teams.find(t => t.id === targetGame.awayTeamId);
      if (!homeTeam || !awayTeam) return null;

      const isFieldPlayer = (p: any) => p.position !== 'GK' && p.position !== 'Goleiro';
      const homeField = homeTeam.players.filter(isFieldPlayer);
      const awayField = awayTeam.players.filter(isFieldPlayer);

      const getPlayerStrength = (p: any) => {
          const divisor = playerMatchCounts[p.id] || 1;
          // Soma os acumuladores médios ao OVR
          const avgAcc = 
            ((p.accumulators?.pace || 0) / divisor) + 
            ((p.accumulators?.shooting || 0) / divisor) + 
            ((p.accumulators?.passing || 0) / divisor) + 
            ((p.accumulators?.defending || 0) / divisor);
          
          return (p.initial_ovr || 50) + avgAcc;
      };

      const homeStrength = homeField.reduce((sum, p) => sum + getPlayerStrength(p), 0);
      const awayStrength = awayField.reduce((sum, p) => sum + getPlayerStrength(p), 0);
      const drawWeight = (homeStrength + awayStrength) * 0.20; 
      const total = homeStrength + awayStrength + drawWeight;
      
      if (total === 0) return { homePct: 33, awayPct: 33, drawPct: 34, method: 'OVR Base', homeTeam, awayTeam, homeColor: getTeamBarColor(homeTeam.name), awayColor: getTeamBarColor(awayTeam.name) };

      const homePct = Math.round((homeStrength / total) * 100);
      const drawPct = Math.round((drawWeight / total) * 100);
      const awayPct = 100 - homePct - drawPct;

      return { homePct, awayPct, drawPct, method: 'Desempenho (Média Mensal)', homeTeam, awayTeam, homeColor: getTeamBarColor(homeTeam.name), awayColor: getTeamBarColor(awayTeam.name) };
  }, [match, playerMatchCounts]); // <--- Recalcula se as contagens mudarem

  const liveTable = useMemo(() => {
      if (!match) return [];
      const stats: Record<string, TableEntry> = {};
      match.teams.forEach(team => { stats[team.id] = { teamId: team.id, name: team.name, points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, isLive: false }; });
      match.games.forEach(game => {
          if (game.status === GameStatus.WAITING || game.homeTeamId === 'TBD') return;
          const home = stats[game.homeTeamId]; const away = stats[game.awayTeamId];
          if (!home || !away) return;
          if (game.status === GameStatus.LIVE) { home.isLive = true; away.isLive = true; }
          home.goalsFor += game.homeScore; home.goalsAgainst += game.awayScore; home.goalDiff = home.goalsFor - home.goalsAgainst; away.goalsFor += game.awayScore; away.goalsAgainst += game.homeScore; away.goalDiff = away.goalsFor - away.goalsAgainst; home.played += 1; away.played += 1;
          if (game.homeScore > game.awayScore) { home.points += 3; home.wins += 1; away.losses += 1; } else if (game.awayScore > game.homeScore) { away.points += 3; away.wins += 1; home.losses += 1; } else { home.points += 1; home.draws += 1; away.points += 1; away.draws += 1; }
      });
      return Object.values(stats).sort((a, b) => { if (b.points !== a.points) return b.points - a.points; if (b.wins !== a.wins) return b.wins - a.wins; if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff; return b.goalsFor - a.goalsFor; });
  }, [match]);

  const tournamentStats = useMemo(() => {
      if (!match) return { scorers: [], assists: [], cleanSheets: [] };
      const getPlayer = (id: string) => { for (const t of match.teams) { const p = t.players.find(pl => pl.id === id); if (p) return { ...p, teamName: t.name }; } return null; };
      const goalsMap: Record<string, number> = {}; const assistsMap: Record<string, number> = {};
      (match.goals || []).forEach(g => { if (g.scorerId) goalsMap[g.scorerId] = (goalsMap[g.scorerId] || 0) + 1; if (g.assistId) assistsMap[g.assistId] = (assistsMap[g.assistId] || 0) + 1; });
      const teamCleanSheets: Record<string, number> = {};
      match.games.forEach(g => { if (g.status === GameStatus.FINISHED || g.status === GameStatus.LIVE) { if (g.awayScore === 0) teamCleanSheets[g.homeTeamId] = (teamCleanSheets[g.homeTeamId] || 0) + 1; if (g.homeScore === 0) teamCleanSheets[g.awayTeamId] = (teamCleanSheets[g.awayTeamId] || 0) + 1; } });
      const formatList = (map: Record<string, number>) => Object.entries(map).map(([id, count]) => { const p = getPlayer(id); return p ? { playerId: id, name: p.name, teamName: p.teamName, photoUrl: p.photo_url, count, position: p.position } : null; }).filter(Boolean).sort((a, b) => b!.count - a!.count) as StatEntry[];
      const muralhasList: StatEntry[] = [];
      match.teams.forEach(t => { const csCount = teamCleanSheets[t.id] || 0; if (csCount > 0) { const gk = t.players.find(p => p.position === 'Goleiro' || p.position === 'GK') || t.players[0]; if (gk) { muralhasList.push({ playerId: gk.id, name: gk.name, teamName: t.name, photoUrl: gk.photo_url, count: csCount, position: 'GK' }); } } });
      muralhasList.sort((a, b) => b.count - a.count);
      return { scorers: formatList(goalsMap), assists: formatList(assistsMap), cleanSheets: muralhasList };
  }, [match]);

  const handleFormationChange = (value: string) => { if (fullTeamPlayers.length > 0) { const newSetup = formationService.createSetupForFormation(value, fullTeamPlayers); if (newSetup) { setTacticalSetup(newSetup); if (myTeamId) saveTacticsLocally(myTeamId, newSetup); } } };
  const handlePlayerSwap = (sourceId: string, targetId: string, sourceType: 'field' | 'bench', targetType: 'field' | 'bench') => { if (!tacticalSetup) return; const newSetup = { ...tacticalSetup }; const newStarters = [...newSetup.starters]; const newBench = [...newSetup.bench]; if (sourceType === 'field' && targetType === 'field') { const sIdx = newStarters.findIndex(s => s.positionId === sourceId); const tIdx = newStarters.findIndex(s => s.positionId === targetId); if (sIdx >= 0 && tIdx >= 0) { const temp = newStarters[sIdx].player; newStarters[sIdx].player = newStarters[tIdx].player; newStarters[tIdx].player = temp; } } const finalSetup = { ...newSetup, starters: newStarters, bench: newBench }; setTacticalSetup(finalSetup); if (myTeamId) saveTacticsLocally(myTeamId, finalSetup); };
  
  const liveGame = match?.games.find(g => g.status === GameStatus.LIVE);
  const nextGame = match?.games.find(g => g.status === GameStatus.WAITING && g.homeTeamId !== 'TBD');
  const getTeamName = (id: string) => match?.teams.find(t => t.id === id)?.name || '...';
  const getTeamLogo = (name: string) => { const lowerName = name.toLowerCase(); if (lowerName.includes('branco')) return '/shields/shield-white.png'; if (lowerName.includes('preto')) return '/shields/shield-black.png'; if (lowerName.includes('vermelho')) return '/shields/shield-red.png'; if (lowerName.includes('azul')) return '/shields/shield-blue.png'; return '/shields/shield-generic.png'; };
  const getTeamGoals = (teamId: string) => { if (!match || !liveGame) return []; return match.goals.filter(g => g.gameId === liveGame.id && g.teamId === teamId); };
  const getPlayerName = (playerId: string) => { for (const team of match?.teams || []) { const p = team.players.find(pl => pl.id === playerId); if (p) return p.name.split(' ')[0]; } return 'Jog.'; };

  if (loading) return <div className="flex justify-center items-center h-screen bg-slate-900 text-white"><RefreshCw className="animate-spin mr-2" /> Carregando...</div>;
  if (!match) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-slate-900 pb-20">
      <div className="sticky top-0 z-30 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 px-4 py-3 flex items-center justify-between shadow-md">
         <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-400 hover:text-white hover:bg-slate-700"><ArrowLeft size={24} /></Button>
         <h1 className="text-lg font-bold text-white flex items-center gap-2"><ShieldAlert size={20} className="text-emerald-500" /> Vestiário</h1>
         <div className="w-8"></div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        
        {/* HEADER JOGO AO VIVO + A SEGUIR */}
        <AnimatePresence>
        {liveGame ? (
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-6 relative overflow-hidden mb-6">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-10 pointer-events-none"></div>
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                
                <div className="flex justify-center mb-4 relative z-10"><span className="bg-black/40 border border-slate-600 text-slate-300 text-[10px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]"></div>{liveGame.phase}</span></div>
                
                <div className="flex items-start justify-between relative z-10">
                    <div className="flex flex-col items-center w-1/3"><div className="relative mb-2 group">{!homeImgError ? ( <motion.img whileHover={{ scale: 1.1 }} src={getTeamLogo(getTeamName(liveGame.homeTeamId))} className="w-20 h-20 object-contain drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" onError={() => setHomeImgError(true)} /> ) : ( <div className="w-16 h-16 rounded-full border-4 border-slate-600 bg-slate-800 flex items-center justify-center"><span className="text-xl font-bold text-slate-400">{getTeamName(liveGame.homeTeamId).charAt(0)}</span></div> )}</div><h3 className="text-white font-bold text-sm uppercase tracking-tight text-center leading-none mb-2">{getTeamName(liveGame.homeTeamId)}</h3><div className="flex flex-col gap-1 w-full items-center">{getTeamGoals(liveGame.homeTeamId).map(g => ( <div key={g.id} className="text-[10px] text-slate-400 flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded"><div className="w-1 h-1 bg-green-500 rounded-full"></div> {getPlayerName(g.scorerId)}</div> ))}</div></div>
                    <div className="flex flex-col items-center justify-start pt-4 w-1/3"><div className="flex items-center gap-2 mb-2"><span className="text-4xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{liveGame.homeScore}</span><span className="text-slate-500 text-2xl font-light">:</span><span className="text-4xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{liveGame.awayScore}</span></div></div>
                    <div className="flex flex-col items-center w-1/3"><div className="relative mb-2 group">{!awayImgError ? ( <motion.img whileHover={{ scale: 1.1 }} src={getTeamLogo(getTeamName(liveGame.awayTeamId))} className="w-20 h-20 object-contain drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" onError={() => setAwayImgError(true)} /> ) : ( <div className="w-16 h-16 rounded-full border-4 border-slate-600 bg-slate-800 flex items-center justify-center"><span className="text-xl font-bold text-slate-400">{getTeamName(liveGame.awayTeamId).charAt(0)}</span></div> )}</div><h3 className="text-white font-bold text-sm uppercase tracking-tight text-center leading-none mb-2">{getTeamName(liveGame.awayTeamId)}</h3><div className="flex flex-col gap-1 w-full items-center">{getTeamGoals(liveGame.awayTeamId).map(g => ( <div key={g.id} className="text-[10px] text-slate-400 flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded"><div className="w-1 h-1 bg-green-500 rounded-full"></div> {getPlayerName(g.scorerId)}</div> ))}</div></div>
                </div>

                {nextGame && (
                    <div className="mt-6 -mb-3 pt-3 border-t border-white/10 flex items-center justify-center gap-2 relative z-10">
                        <span className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1"><Calendar size={10} className="text-emerald-500" /> A SEGUIR:</span>
                        <div className="flex items-center gap-1 text-[10px]"><span className="text-white font-bold">{getTeamName(nextGame.homeTeamId)}</span><span className="text-slate-600 text-[9px] px-1">VS</span><span className="text-white font-bold">{getTeamName(nextGame.awayTeamId)}</span></div>
                        <span className="text-[9px] text-emerald-500/80 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">{nextGame.phase}</span>
                    </div>
                )}
            </motion.div>
        ) : (
            <Card className="bg-slate-800 border-slate-700 mb-6">
                <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
                    <span className="text-slate-400 text-sm flex items-center gap-2 mb-1"><Clock size={16} /> Sem jogo rolando agora.</span>
                    {nextGame && ( <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700/50"><span className="text-[10px] text-emerald-500 font-bold">PRÓXIMO:</span><span className="text-xs text-white font-bold">{getTeamName(nextGame.homeTeamId)}</span><span className="text-[10px] text-slate-500">vs</span><span className="text-xs text-white font-bold">{getTeamName(nextGame.awayTeamId)}</span></div> )}
                </CardContent>
            </Card>
        )}
        </AnimatePresence>

        {/* ABAS */}
        <Tabs defaultValue="my-team" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800 border border-slate-700 rounded-lg h-12 p-1">
                <TabsTrigger value="my-team" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 font-bold transition-all"><Users size={16} className="mr-2" /> Meu Time</TabsTrigger>
                <TabsTrigger value="tournament" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 font-bold transition-all"><Trophy size={16} className="mr-2" /> Torneio</TabsTrigger>
            </TabsList>

            <TabsContent value="my-team" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-white font-bold flex items-center gap-2"><Zap className="text-yellow-500" size={18} /> Prancheta</h2>
                    {tacticalSetup && ( <div className="w-40"><Select onValueChange={handleFormationChange} value={tacticalSetup.formation.id}><SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Formação" /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-700 text-white">{AVAILABLE_FORMATIONS.map(f => ( <SelectItem key={f.id} value={f.id} className="text-xs hover:bg-slate-700 cursor-pointer">{f.name}</SelectItem> ))}</SelectContent></Select></div> )}
                </div>
                
                {tacticalSetup ? ( <TacticalBoard setup={tacticalSetup} teamName={getTeamName(myTeamId || '')} onPlayerSwap={handlePlayerSwap} /> ) : ( <div className="text-center py-10 text-slate-500 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">Nenhuma sugestão disponível.</div> )}

                {/* --- TABELA DE ESTATÍSTICAS DO TIME (COM CÁLCULO PONDERADO E DIVISOR) --- */}
                {myTeamStats.length > 0 && (
                    <Card className="bg-slate-800 border-slate-700 shadow-md mt-4">
                        <CardHeader className="pb-2 pt-3 bg-slate-900/50 border-b border-slate-700">
                             <CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Medal size={12} /> Desempenho do Elenco</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-slate-700 hover:bg-transparent">
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead className="text-slate-500 text-[10px]">JOGADOR</TableHead>
                                        <TableHead className="text-slate-500 text-[10px] text-center w-12">GOLS</TableHead>
                                        <TableHead className="text-slate-500 text-[10px] text-center w-12">AST</TableHead>
                                        <TableHead className="text-slate-500 text-[10px] text-center w-14">FASE</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {myTeamStats.map((p: any) => (
                                        <TableRow key={p.id} className="border-slate-700/50 hover:bg-slate-700/30">
                                            <TableCell className="py-2 pl-3">
                                                <Avatar className="w-6 h-6 border border-slate-600">
                                                    <AvatarImage src={p.photo_url} />
                                                    <AvatarFallback className="bg-slate-700 text-[9px]">{p.name.substring(0,2)}</AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className="py-2 font-bold text-white text-xs">{p.name.split(' ')[0]}</TableCell>
                                            <TableCell className="py-2 text-center text-xs text-emerald-400 font-bold">{p.goals > 0 ? p.goals : '-'}</TableCell>
                                            <TableCell className="py-2 text-center text-xs text-blue-400">{p.assists > 0 ? p.assists : '-'}</TableCell>
                                            <TableCell className="py-2 flex justify-center">{renderPhaseIcon(p.totalAcc)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </TabsContent>

            <TabsContent value="tournament" className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4">
                 {/* ... (CONTEÚDO DA ABA TORNEIO MANTIDO) ... */}
                 {winProbability && (
                     <Card className="bg-slate-800 border-slate-700 shadow-md overflow-hidden">
                         <CardHeader className="pb-2 pt-3">
                             <CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                                 <span className="flex items-center gap-2"><TrendingUp size={12} className="text-blue-400"/> Probabilidade de Vitória</span>
                                 <span className="text-[9px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-700">{winProbability.method}</span>
                             </CardTitle>
                         </CardHeader>
                         <CardContent className="p-4 pt-1 pb-4">
                             <div className="flex justify-between text-xs font-bold text-white mb-2"><span>{winProbability.homeTeam.name}</span><span>{winProbability.awayTeam.name}</span></div>
                             <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden flex relative shadow-inner border border-slate-700">
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${winProbability.homePct}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full ${winProbability.homeColor} relative flex items-center justify-center`}>{winProbability.homePct > 10 && <span className="text-[9px] font-bold opacity-90">{winProbability.homePct}%</span>}</motion.div>
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${winProbability.drawPct}%` }} transition={{ duration: 1, ease: "easeOut", delay: 0.2 }} className="h-full bg-slate-500 flex items-center justify-center border-l border-r border-black/20"><span className="text-[8px] font-bold text-white/80">X</span></motion.div>
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${winProbability.awayPct}%` }} transition={{ duration: 1, ease: "easeOut", delay: 0.4 }} className={`h-full ${winProbability.awayColor} flex items-center justify-center`}>{winProbability.awayPct > 10 && <span className="text-[9px] font-bold opacity-90">{winProbability.awayPct}%</span>}</motion.div>
                             </div>
                             {winProbability.drawPct > 0 && <div className="flex justify-center mt-1"><span className="text-[9px] text-slate-500 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div> Empate: {winProbability.drawPct}%</span></div>}
                         </CardContent>
                     </Card>
                 )}
                 <Card className="bg-slate-800 border-slate-700 shadow-md overflow-hidden">
                    <CardHeader className="pb-2 bg-slate-900/50 border-b border-slate-700"><div className="flex items-center justify-between"><CardTitle className="text-sm font-bold text-white flex items-center gap-2"><Trophy size={14} className="text-yellow-500" /> Classificação (Ao Vivo)</CardTitle>{liveGame && <span className="text-[10px] bg-red-600/20 text-red-500 px-2 py-0.5 rounded animate-pulse font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> ATUALIZANDO</span>}</div></CardHeader>
                    <CardContent className="p-0"><Table><TableHeader><TableRow className="border-slate-700 hover:bg-transparent"><TableHead className="w-12 text-slate-500 text-[10px] text-center">POS</TableHead><TableHead className="text-slate-500 text-[10px]">TIME</TableHead><TableHead className="text-slate-500 text-[10px] text-center">P</TableHead><TableHead className="text-slate-500 text-[10px] text-center">V</TableHead><TableHead className="text-slate-500 text-[10px] text-center">SG</TableHead></TableRow></TableHeader><TableBody>{liveTable.map((row, index) => (<TableRow key={row.teamId} className={`border-slate-700/50 ${row.isLive ? 'bg-emerald-900/10' : ''}`}><TableCell className="text-center font-bold text-slate-400 py-3 text-xs">{index + 1}º</TableCell><TableCell className="font-bold text-white py-3 text-xs flex items-center gap-2"><img src={getTeamLogo(row.name)} className="w-5 h-5 object-contain" /><span className={row.teamId === myTeamId ? "text-emerald-400" : ""}>{row.name}</span>{row.isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-auto"></span>}</TableCell><TableCell className={`text-center font-bold py-3 text-xs ${row.isLive ? 'text-green-400 scale-110 transition-transform' : 'text-white'}`}>{row.points}</TableCell><TableCell className="text-center text-slate-400 py-3 text-xs">{row.wins}</TableCell><TableCell className="text-center text-slate-400 py-3 text-xs">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</TableCell></TableRow>))}</TableBody></Table></CardContent>
                 </Card>
                 <Card className="bg-slate-800 border-slate-700 shadow-md">
                    <CardHeader className="pb-0"><CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2"><Medal size={12} /> Destaques do Torneio</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-2">
                        <Tabs defaultValue="scorers">
                            <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-700 h-8 mb-4"><TabsTrigger value="scorers" className="text-[10px] data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Artilheiros</TabsTrigger><TabsTrigger value="assists" className="text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white">Garçons</TabsTrigger><TabsTrigger value="cleanSheets" className="text-[10px] data-[state=active]:bg-yellow-600 data-[state=active]:text-white">Muralhas</TabsTrigger></TabsList>
                            <TabsContent value="scorers" className="space-y-2">{tournamentStats.scorers.length > 0 ? tournamentStats.scorers.slice(0, 5).map((p, i) => ( <div key={p.playerId} className="flex items-center justify-between bg-slate-700/50 p-2 rounded border border-slate-700/50"><div className="flex items-center gap-3"><div className="font-mono text-slate-500 text-xs w-4">#{i+1}</div><Avatar className="w-8 h-8 border border-slate-600"><AvatarImage src={p.photoUrl} /><AvatarFallback className="bg-slate-800 text-[10px]">{p.name.substring(0,2)}</AvatarFallback></Avatar><div><div className="text-xs font-bold text-white">{p.name}</div><div className="text-[10px] text-slate-400 flex items-center gap-1"><img src={getTeamLogo(p.teamName)} className="w-3 h-3"/> {p.teamName}</div></div></div><div className="font-bold text-emerald-400 text-sm flex items-center gap-1">{p.count} ⚽</div></div> )) : <div className="text-center text-xs text-slate-500 py-4">Nenhum gol marcado ainda.</div>}</TabsContent>
                            <TabsContent value="assists" className="space-y-2">{tournamentStats.assists.length > 0 ? tournamentStats.assists.slice(0, 5).map((p, i) => ( <div key={p.playerId} className="flex items-center justify-between bg-slate-700/50 p-2 rounded border border-slate-700/50"><div className="flex items-center gap-3"><div className="font-mono text-slate-500 text-xs w-4">#{i+1}</div><Avatar className="w-8 h-8 border border-slate-600"><AvatarImage src={p.photoUrl} /><AvatarFallback className="bg-slate-800 text-[10px]">{p.name.substring(0,2)}</AvatarFallback></Avatar><div><div className="text-xs font-bold text-white">{p.name}</div><div className="text-[10px] text-slate-400 flex items-center gap-1"><img src={getTeamLogo(p.teamName)} className="w-3 h-3"/> {p.teamName}</div></div></div><div className="font-bold text-blue-400 text-sm flex items-center gap-1">{p.count} <Footprints size={12}/></div></div> )) : <div className="text-center text-xs text-slate-500 py-4">Nenhuma assistência ainda.</div>}</TabsContent>
                            <TabsContent value="cleanSheets" className="space-y-2">{tournamentStats.cleanSheets.length > 0 ? tournamentStats.cleanSheets.slice(0, 5).map((p, i) => ( <div key={p.playerId} className="flex items-center justify-between bg-slate-700/50 p-2 rounded border border-slate-700/50"><div className="flex items-center gap-3"><div className="font-mono text-slate-500 text-xs w-4">#{i+1}</div><Avatar className="w-8 h-8 border border-yellow-600/50"><AvatarImage src={p.photoUrl} /><AvatarFallback className="bg-slate-800 text-[10px]">{p.name.substring(0,2)}</AvatarFallback></Avatar><div><div className="text-xs font-bold text-white">{p.name}</div><div className="text-[10px] text-slate-400 flex items-center gap-1"><img src={getTeamLogo(p.teamName)} className="w-3 h-3"/> {p.teamName}</div></div></div><div className="font-bold text-yellow-500 text-sm flex items-center gap-1">{p.count} <Shield size={12}/></div></div> )) : <div className="text-center text-xs text-slate-500 py-4">Nenhum "Clean Sheet".</div>}</TabsContent>
                        </Tabs>
                    </CardContent>
                 </Card>
            </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};

export default MatchCenter;