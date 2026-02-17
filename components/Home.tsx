import React, { useMemo, useState, useRef } from 'react';
import { Player, Match, MatchStatus } from '../types';
import { playerService, calculateWeightedOvr } from '../services/playerService';
import { matchService } from '../services/matchService';
import { Zap, TrendingUp, User, Camera, Upload, Check, ChevronsUp, ChevronsDown, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { ACHIEVEMENTS_LIST } from '../data/achievements';
import { imageService } from '../services/imageService';
import MatchDayBanner from './MatchDayBanner';
import { getSmoothPath, getSmoothAreaPath } from '../utils/graphUtils';

import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const getNameSizeClass = (name: string) => {
    const length = name.length;
    if (length > 16) return "text-base leading-tight";
    if (length > 9) return "text-xl leading-none";
    if (length > 6) return "text-2xl leading-[0.9]";
    return "text-3xl leading-[0.8]";
};

const StatsBox = ({ label, value, color, subtext }: { label: string, value: number, color: string, subtext?: string }) => (
    <div
        className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 flex flex-col items-center justify-center shadow-lg aspect-square hover:bg-slate-800 transition-colors cursor-default"
    >
        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">{label}</span>
        <span className={`text-3xl font-black ${color} leading-none`}>{value}</span>
        {subtext && <span className="text-[9px] text-slate-500 mt-1 truncate max-w-full">{subtext}</span>}
    </div>
);

interface HomeProps {
    player: Player;
    matches: Match[];
    onPlayerUpdate?: () => void;
    onNavigateToMatch?: (matchId: string) => void;
}

const Home: React.FC<HomeProps> = ({ player, matches, onNavigateToMatch }) => {
    const [isEditingPhoto, setIsEditingPhoto] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null); // Novo estado para guardar o arquivo
    const [isDeletePhotoConfirmOpen, setIsDeletePhotoConfirmOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // State do Gráfico Interativo
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number, y: number, ovr: number, date: string } | null>(null);

    // LÓGICA DA CONQUISTA EQUIPADA
    const featuredAchievement = player.featured_achievement_id
        ? ACHIEVEMENTS_LIST.find(a => a.id === player.featured_achievement_id)
        : null;

    const arrowIndicator = useMemo(() => {
        const { pace, shooting, passing, defending } = player.attributes;

        const gainPace = Math.round(player.accumulators.pace / 4);
        const gainShoot = Math.round(player.accumulators.shooting / 4);
        const gainPass = Math.round(player.accumulators.passing / 4);
        const gainDef = Math.round(player.accumulators.defending / 4);

        let pPace = Math.max(1, Math.min(99, pace + gainPace));
        let pShoot = Math.max(1, Math.min(99, shooting + gainShoot));
        let pPass = Math.max(1, Math.min(99, passing + gainPass));
        let pDef = Math.max(1, Math.min(99, defending + gainDef));

        const futureOvrRaw = calculateWeightedOvr(player.position as string, { pace: pPace, shooting: pShoot, passing: pPass, defending: pDef });
        
        const futureOvrRounded = Math.round(futureOvrRaw);
        const diffRounded = futureOvrRounded - player.initial_ovr;

        if (diffRounded > 0) return { icon: ChevronsUp, color: "text-emerald-400", show: true };
        if (diffRounded < 0) return { icon: ChevronsDown, color: "text-red-500", show: true };
        return { icon: null, color: "", show: false };
    }, [player]);

    const FormIcon = arrowIndicator.icon;
    const formColor = arrowIndicator.color;

    const stats = useMemo(() => {
        let gamesPlayed = 0; let goals = 0; let assists = 0; let titles = 0; let wins = 0;
        matches.forEach(match => {
            if (match.status !== MatchStatus.FINISHED) return;
            const playerTeam = match.teams.find(t => t.players.some(p => p.id === player.id));
            if (!playerTeam) return;

            const playedGames = match.games.filter(g => g.status === 'FINISHED' && (g.homeTeamId === playerTeam.id || g.awayTeamId === playerTeam.id));
            gamesPlayed += playedGames.length;

            playedGames.forEach(g => {
                const isHome = g.homeTeamId === playerTeam.id;
                const myScore = isHome ? g.homeScore : g.awayScore;
                const oppScore = isHome ? g.awayScore : g.homeScore;
                if (myScore > oppScore) wins++;
                else if (myScore === oppScore && g.penaltyShootout) {
                    const p = g.penaltyShootout;
                    if ((isHome ? p.homeScore : p.awayScore) > (isHome ? p.awayScore : p.homeScore)) wins++;
                }
            });

            match.goals?.forEach(g => { if (g.scorerId === player.id) goals++; if (g.assistId === player.id) assists++; });

            if (match.type === 'Quadrangular') {
                const finalGame = match.games.find(g => g.phase === 'FINAL' && g.status === 'FINISHED');
                if (finalGame) {
                    const isHome = finalGame.homeTeamId === playerTeam.id;
                    const isAway = finalGame.awayTeamId === playerTeam.id;

                    if (isHome || isAway) {
                        const pHomeScore = finalGame.homeScore;
                        const pAwayScore = finalGame.awayScore;
                        if (isHome && pHomeScore > pAwayScore) titles++;
                        else if (isAway && pAwayScore > pHomeScore) titles++;
                        else if (pHomeScore === pAwayScore && finalGame.penaltyShootout) {
                            const pen = finalGame.penaltyShootout;
                            if (isHome && pen.homeScore > pen.awayScore) titles++;
                            if (isAway && pen.awayScore > pen.homeScore) titles++;
                        }
                    }
                }
            } else {
                const standings = matchService.calculateStandings(match);
                if (standings[0]?.teamId === playerTeam.id) titles++;
            }
        });
        return { gamesPlayed, goals, assists, titles, wins };
    }, [matches, player.id]);

    const chartData = useMemo(() => {
        const startYear = 2026;
        const startTimestamp = new Date(startYear, 0, 1).getTime();
        const endTimestamp = new Date(startYear, 11, 31).getTime();
        const totalTime = endTimestamp - startTimestamp;

        let dataPoints = [{ date: new Date(startYear, 0, 1), ovr: player.initial_ovr }];

        if (player.ovr_history) {
            player.ovr_history.forEach(h => {
                dataPoints.push({ date: new Date(h.date), ovr: h.ovr });
            });
        }

        dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

        const ovrs = dataPoints.map(p => p.ovr);
        const minOvr = Math.min(...ovrs) - 2;
        const maxOvr = Math.max(...ovrs) + 2;
        const rangeOvr = maxOvr - minOvr || 1;

        const width = 350;
        const height = 100;
        const padding = 10;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;

        const points = dataPoints.map((p) => {
            let time = p.date.getTime();
            if (time < startTimestamp) time = startTimestamp;

            const percentX = (time - startTimestamp) / totalTime;
            const clampedPercentX = Math.min(1, Math.max(0, percentX));

            const x = padding + (clampedPercentX * graphWidth);
            const y = height - padding - ((p.ovr - minOvr) / rangeOvr) * graphHeight;

            const dateStr = p.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

            return { x, y, ovr: p.ovr, date: dateStr };
        });

        const pathD = getSmoothPath(points, 0.2);
        const areaPathD = getSmoothAreaPath(points, width, height, 0.2);

        const lastPoint = points[points.length - 1];
        
        const displayLabels = ["JAN", "MAR", "MAI", "JUL", "SET", "NOV"];

        return { pathD, areaPathD, lastX: lastPoint.x, lastY: lastPoint.y, displayLabels, points };
    }, [player]);

    const handleGraphHover = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        const svgRect = e.currentTarget.getBoundingClientRect();
        const hoverX = e.clientX - svgRect.left;

        // Find closest point
        let closest = chartData.points[0];
        let minDist = Infinity;

        chartData.points.forEach(p => {
            const dist = Math.abs(p.x - hoverX);
            if (dist < minDist) {
                minDist = dist;
                closest = p;
            }
        });

        // Só mostra se estiver perto o suficiente (ex: 50px)
        if (minDist < 50) {
            setHoveredPoint(closest);
        } else {
             setHoveredPoint(null);
        }
    };

    const handleGraphLeave = () => {
        setHoveredPoint(null);
    };

    // --- NOVA LÓGICA DE UPLOAD ---

    const triggerFileSelect = () => { fileInputRef.current?.click(); };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Guarda o arquivo real para upload posterior
            setSelectedFile(file);
            
            // Gera preview para a UI
            const reader = new FileReader();
            reader.onload = (e) => { setPreviewImage(e.target?.result as string); };
            reader.readAsDataURL(file);
        }
    };

    const cancelPreview = () => { 
        setPreviewImage(null); 
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
    };

    // Função de Salvar Corrigida: Usa o selectedFile para fazer upload no Supabase
    const confirmSavePhoto = async () => {
        if (!selectedFile) return;

        try {
            setIsUploading(true);
            
            // 1. Upload para o Storage (retorna URL pública)
            const publicUrl = await imageService.uploadImage(selectedFile, 'profiles', player.id);

            if (publicUrl) {
                // 2. Salva a URL no banco de dados
                await playerService.updatePhoto(player.id, publicUrl);
                
                toast.success("Foto atualizada com sucesso!");
                setPreviewImage(null);
                setSelectedFile(null);
                setIsEditingPhoto(false);
                setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.error('Erro ao fazer upload da imagem.');
            }

        } catch (error) {
            console.error('Erro:', error);
            toast.error('Erro ao atualizar foto.');
        } finally {
            setIsUploading(false);
        }
    };

    const confirmRemovePhoto = async () => {
        try {
            setIsUploading(true);
            await playerService.updatePhoto(player.id, ''); // Remove URL
            toast.success("Foto removida!");
            setIsDeletePhotoConfirmOpen(false);
            setTimeout(() => window.location.reload(), 500);
        } catch (error) {
             console.error(error);
             toast.error("Erro ao remover foto");
        } finally {
             setIsUploading(false);
        }
    };

    return (
        <div 
            className="w-full max-w-lg mx-auto pb-24 pt-2 relative"
        >
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-[420px] z-0 overflow-hidden rounded-b-3xl [mask-image:linear-gradient(to_top,transparent,black_50%)]">
                <img src="/fundo.png" alt="Background" className="w-full h-full object-cover opacity-10" />
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent"></div>
            </div>

            <div className="grid grid-cols-5 px-6 relative z-10 h-[420px] items-end">
                {/* Lado Esquerdo - Info Textual */}
                <div className="col-span-2 flex flex-col items-start self-center pb-20 z-20 pl-1">
                    <div 
                        className="flex flex-col items-start w-full mb-2"
                    >
                        <div className="relative leading-none">
                            <span className="text-[3.5rem] font-black text-white tracking-tighter drop-shadow-2xl block -ml-1">
                                {player.initial_ovr}
                            </span>
                            {arrowIndicator.show && FormIcon && (
                                <FormIcon size={30} className={`absolute top-4 -right-8 ${formColor} drop-shadow-lg`} strokeWidth={3} />
                            )}
                        </div>
                        <span className="text-2xl font-normal text-emerald-400 tracking-widest uppercase drop-shadow-md mt-[-2px]">
                            {player.position.substring(0, 3)}
                        </span>
                    </div>

                    <h1 
                        className={`${getNameSizeClass(player.name)} font-black text-white uppercase tracking-tighter mb-2 drop-shadow-lg w-full break-words`}
                    >
                        {player.name}
                    </h1>

                    <div 
                        className="flex items-center gap-1.5 text-emerald-400 drop-shadow-md opacity-90"
                    >
                        <Zap size={12} strokeWidth={1} fill="currentColor" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                            {player.playStyle}
                        </span>
                    </div>

                    {featuredAchievement && (
                        <div 
                            className="mt-3" 
                            title={`Ostentando: ${featuredAchievement.title}`}
                        >
                            {featuredAchievement.imageUrl ? (
                                <img
                                    src={featuredAchievement.imageUrl}
                                    alt={featuredAchievement.title}
                                    className="w-15 h-20 object-contain drop-shadow-md"
                                />
                            ) : (
                                <featuredAchievement.icon
                                    size={36}
                                    className={
                                        featuredAchievement.level === 'Elite' ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] filter" :
                                            featuredAchievement.level === 'Esmeralda' ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] filter" :
                                                featuredAchievement.level === 'Prata' ? "text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] filter" :
                                                    "text-amber-600 drop-shadow-sm filter"
                                    }
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Lado Direito - Foto */}
                <div className="col-span-3 relative h-full flex items-end justify-center">
                     <Dialog open={isEditingPhoto} onOpenChange={setIsEditingPhoto}>
                        <DialogTrigger asChild>
                            <div 
                                className="relative w-full h-full flex items-end justify-center cursor-pointer group transition-transform active:scale-95 hover:scale-[1.02]"
                            >
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-56 bg-emerald-400/20 rounded-full blur-3xl -z-10"></div>
                                {player.photo_url ? (
                                    <img src={player.photo_url} alt={player.name} className="w-full h-full object-contain object-bottom drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)] transform scale-125 -translate-y-11 transition-transform group-hover:scale-130 duration-300 [mask-image:linear-gradient(to_top,transparent,black_30%)]" />
                                ) : (
                                    <User size={180} className="text-slate-700 mb-10 opacity-50 transition-opacity group-hover:opacity-80" />
                                )}
                            </div>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-white flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-emerald-400"/> Alterar Foto
                                </DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    Escolha uma nova foto para o seu perfil.
                                </DialogDescription>
                            </DialogHeader>

                            {previewImage ? (
                                <div className="flex flex-col items-center gap-4 py-4">
                                     <div className="w-40 h-40 bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden border border-slate-700">
                                         <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
                                     </div>
                                     <div className="flex gap-2 w-full">
                                         <Button variant="outline" className="flex-1 bg-transparent border-slate-600 text-slate-200 hover:bg-slate-800" onClick={cancelPreview}>
                                            Trocar
                                         </Button>
                                         <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmSavePhoto} disabled={isUploading}>
                                            {isUploading ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Check className="w-4 h-4 mr-2"/>} 
                                            Salvar
                                         </Button>
                                     </div>
                                </div>
                            ) : (
                                <div className="grid gap-4 py-4">
                                    <div 
                                        onClick={triggerFileSelect}
                                        className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group"
                                    >
                                        <div className="p-4 rounded-full bg-slate-800 group-hover:bg-emerald-500/10 mb-3 transition-colors">
                                            <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-400" />
                                        </div>
                                        <p className="text-sm text-slate-300 font-medium">Clique para selecionar</p>
                                        <p className="text-xs text-slate-500">PNG, JPG ou WEBP</p>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                                     {player.photo_url && (
                                        <Button variant="destructive" className="w-full mt-2" onClick={() => setIsDeletePhotoConfirmOpen(true)}>
                                            <Trash2 className="w-4 h-4 mr-2" /> Remover Foto Atual
                                        </Button>
                                    )}
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isDeletePhotoConfirmOpen} onOpenChange={setIsDeletePhotoConfirmOpen}>
                         <DialogContent className="bg-slate-900 border-slate-700">
                             <DialogHeader>
                                 <DialogTitle className="text-white flex items-center gap-2"><AlertTriangle className="text-red-500 w-5 h-5" /> Remover Foto?</DialogTitle>
                                 <DialogDescription className="text-slate-400">Tem certeza que deseja remover sua foto de perfil? A imagem padrão será exibida.</DialogDescription>
                             </DialogHeader>
                             <DialogFooter className="gap-2 sm:gap-0">
                                 <Button variant="ghost" className="text-slate-300 hover:bg-slate-800" onClick={() => setIsDeletePhotoConfirmOpen(false)}>Cancelar</Button>
                                 <Button variant="destructive" onClick={confirmRemovePhoto}>Sim, remover</Button>
                             </DialogFooter>
                         </DialogContent>
                    </Dialog>
                </div>
            </div>

            {onNavigateToMatch && (
                <div 
                    className="px-4 mt-2"
                >
                    <MatchDayBanner onNavigate={onNavigateToMatch} />
                </div>
            )}

            <div className="grid grid-cols-4 gap-2 px-4 mb-8 mt-2">
                <StatsBox label="TÍTULOS" value={stats.titles} color="text-emerald-400" subtext={`_`} />
                <StatsBox label="JOGOS" value={stats.gamesPlayed} color="text-emerald-400" subtext={`${stats.wins} Vitórias`} />
                <StatsBox label="GOLS" value={stats.goals} color="text-emerald-400" subtext={`${stats.gamesPlayed ? (stats.goals / stats.gamesPlayed).toFixed(1) : '0'} G/J`}  />
                <StatsBox label="ASSIST" value={stats.assists} color="text-emerald-400" subtext={`${stats.gamesPlayed ? (stats.assists / stats.gamesPlayed).toFixed(1) : '0'} A/J`} />
            </div>

            <div className="px-4">
                <Card className="bg-slate-800 border-slate-700 shadow-xl overflow-hidden">
                    <CardHeader className="pb-2 pt-6 px-6">
                        <CardTitle className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                            <TrendingUp className="text-emerald-400 w-4 h-4" /> Evolução OVR (2026)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-44 relative p-0">
                         <div className="w-full h-full p-4 pt-0 flex flex-col justify-end">
                            {/* SVG Grafico */}
                            <div className="flex-1 relative z-10 w-full" onMouseMove={handleGraphHover} onMouseLeave={handleGraphLeave}>
                                <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
                                            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                                        </linearGradient>
                                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                                            <stop offset="100%" stopColor="#34d399" />
                                        </linearGradient>
                                    </defs>

                                    {/* Area Fill */}
                                    <path
                                        d={chartData.areaPathD}
                                        fill="url(#areaGradient)"
                                    />

                                    {/* Line Path */}
                                    <path 
                                        d={chartData.pathD} 
                                        fill="none" 
                                        stroke="url(#lineGradient)" 
                                        strokeWidth="4" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        className="drop-shadow-lg" 
                                    />

                                    {/* Last Point */}
                                    {!hoveredPoint && <circle 
                                        cx={chartData.lastX} 
                                        cy={chartData.lastY} 
                                        r="5" 
                                        fill="#34d399" 
                                        stroke="white" 
                                        strokeWidth="2" 
                                    />}

                                    {/* Interactive Hover Point & Tooltip */}
                                    {hoveredPoint && (
                                        <g>
                                            {/* Line to bottom */}
                                            <line 
                                                x1={hoveredPoint.x} 
                                                y1={hoveredPoint.y} 
                                                x2={hoveredPoint.x} 
                                                y2="100%" 
                                                stroke="#cbd5e1" 
                                                strokeWidth="1" 
                                                strokeDasharray="4 2" 
                                                opacity="0.5" 
                                            />
                                            
                                            {/* Point */}
                                            <circle 
                                                cx={hoveredPoint.x} 
                                                cy={hoveredPoint.y} 
                                                r="6" 
                                                fill="#34d399" 
                                                stroke="white" 
                                                strokeWidth="3" 
                                                className="drop-shadow-md"
                                            />

                                            {/* Tooltip Label */}
                                            <g transform={`translate(${hoveredPoint.x}, ${hoveredPoint.y - 15})`}>
                                                <rect 
                                                    x="-35" 
                                                    y="-35" 
                                                    width="70" 
                                                    height="30" 
                                                    rx="6" 
                                                    fill="#1e293b" 
                                                    className="drop-shadow-lg"
                                                />
                                                <text 
                                                    x="0" 
                                                    y="-20" 
                                                    fill="white" 
                                                    fontSize="12" 
                                                    fontWeight="bold" 
                                                    textAnchor="middle" 
                                                    dominantBaseline="middle"
                                                >
                                                    {hoveredPoint.ovr} OVR
                                                </text>
                                                <text 
                                                    x="0" 
                                                    y="-8" 
                                                    fill="#94a3b8" 
                                                    fontSize="8" 
                                                    textAnchor="middle" 
                                                    dominantBaseline="middle"
                                                >
                                                    {hoveredPoint.date}
                                                </text>
                                            </g>
                                        </g>
                                    )}
                                </svg>
                            </div>
                            
                            {/* X Axis Labels */}
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase pt-2 border-t border-slate-700/50 mt-2">
                                {chartData.displayLabels.map((label, i) => (
                                    <span key={i} className={i === chartData.displayLabels.length - 1 ? 'text-emerald-400' : ''}>{label}</span>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Home;