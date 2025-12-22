import React, { useMemo, useState, useRef } from 'react';
import { Player, Match, MatchStatus, PlayerFormData } from '../types';
import { playerService, calculateWeightedOvr } from '../services/playerService';
import { matchService } from '../services/matchService'; 
import { Zap, TrendingUp, User, Camera, Upload, X, Loader2, Trash2, Check, RefreshCw, ChevronsUp, ChevronsDown, Minus, AlertTriangle } from 'lucide-react';
import { ACHIEVEMENTS_LIST } from '../data/achievements';
import { Trophy, Shield, Target, Crown, Medal, Star, Flame, Activity } from 'lucide-react';

const getNameSizeClass = (name: string) => {
    const length = name.length;
    if (length > 16) return "text-base leading-tight"; 
    if (length > 9) return "text-xl leading-none"; 
    if (length > 6) return "text-2xl leading-[0.9]";
    return "text-3xl leading-[0.8]"; 
};

const StatsBox = ({ label, value, color, subtext }: { label: string, value: number, color: string, subtext?: string }) => (
  <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-3 flex flex-col items-center justify-center shadow-lg aspect-square"> 
    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">{label}</span>
    <span className={`text-3xl font-black ${color} leading-none`}>{value}</span>
    {subtext && <span className="text-[9px] text-slate-500 mt-1 truncate max-w-full">{subtext}</span>}
  </div>
);

interface HomeProps {
  player: Player;
  matches: Match[]; 
  onPlayerUpdate?: () => void;
}

const Home: React.FC<HomeProps> = ({ player, matches, onPlayerUpdate }) => {
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDeletePhotoConfirmOpen, setIsDeletePhotoConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      const futureOvr = Math.round(futureOvrRaw);
      
      const diff = futureOvr - player.initial_ovr;
      
      if (diff > 0) return { icon: ChevronsUp, color: "text-emerald-400", show: true };
      if (diff < 0) return { icon: ChevronsDown, color: "text-red-500", show: true };
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
      const standings = matchService.calculateStandings(match); 
      if (standings[0]?.teamId === playerTeam.id) titles++;
    });
    return { gamesPlayed, goals, assists, titles, wins };
  }, [matches, player.id]);

  const chartData = useMemo(() => {
    const startDate = player.created_at ? new Date(player.created_at) : new Date();
    let points = [];
    const startOvr = player.ovr_history && player.ovr_history.length > 0 ? player.ovr_history[0].ovr : player.initial_ovr;
    points.push({ date: startDate, ovr: startOvr });
    if (player.ovr_history) { player.ovr_history.forEach(h => { points.push({ date: new Date(h.date), ovr: h.ovr }); }); }
    if (points.length === 1) { points.push({ date: new Date(), ovr: player.initial_ovr }); }
    points.sort((a, b) => a.date.getTime() - b.date.getTime());
    const width = 350; const height = 100; const padding = 10;
    const ovrs = points.map(p => p.ovr);
    const minOvr = Math.min(...ovrs) - 2; const maxOvr = Math.max(...ovrs) + 2; const rangeOvr = maxOvr - minOvr || 1;
    const minTime = points[0].date.getTime(); const maxTime = points[points.length - 1].date.getTime(); const rangeTime = maxTime - minTime || 1;
    const pathD = points.map((p, i) => {
        const x = ((p.date.getTime() - minTime) / rangeTime) * (width - 2 * padding) + padding;
        const y = height - ((p.ovr - minOvr) / rangeOvr) * (height - 2 * padding) - padding;
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');
    const lastPoint = points[points.length - 1];
    const lastX = width - padding;
    const lastY = height - ((lastPoint.ovr - minOvr) / rangeOvr) * (height - 2 * padding) - padding;
    const displayLabels = points.map((p) => {
         const month = p.date.toLocaleString('default', { month: 'short' });
         const year = p.date.getFullYear().toString().slice(2);
         return `${month} ${year}`;
    });
    const finalLabels = displayLabels.length > 6 ? displayLabels.filter((_, i) => i === 0 || i === displayLabels.length - 1 || i % Math.ceil(displayLabels.length / 5) === 0) : displayLabels;
    return { pathD, lastX, lastY, displayLabels: finalLabels };
  }, [player]);

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 500; const MAX_HEIGHT = 500;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png')); 
            }; img.onerror = (err) => reject(err);
        }; reader.onerror = (err) => reject(err);
    });
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return; setIsUploading(true);
      try { const base64Image = await processImage(file); setPreviewImage(base64Image); } 
      catch (error) { console.error(error); alert("Erro na imagem."); } finally { setIsUploading(false); }
  };
  const confirmSavePhoto = async () => { if (previewImage) await savePhoto(previewImage); };
  const cancelPreview = () => { setPreviewImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const savePhoto = async (url: string) => {
      try {
          setIsUploading(true);
          const currentPlayerData = await playerService.getAll().then(list => list.find(p => p.id === player.id));
          if (!currentPlayerData) throw new Error("Jogador não encontrado.");
          const { attributes, ...rest } = currentPlayerData;
          const updatePayload: PlayerFormData = {
              name: rest.name, email: rest.email, position: rest.position, playStyle: rest.playStyle,
              shirt_number: rest.shirt_number, initial_ovr: rest.initial_ovr, is_admin: rest.is_admin,
              photo_url: url, pace: attributes.pace, shooting: attributes.shooting, passing: attributes.passing,
              defending: attributes.defending
          };
          await playerService.update(player.id, updatePayload);
          setPreviewImage(null); setIsEditingPhoto(false); setIsDeletePhotoConfirmOpen(false); window.location.reload();
      } catch (error: any) { console.error(error); alert(`Erro: ${error.message}`); } finally { setIsUploading(false); }
  };
  const handleRemovePhoto = () => setIsDeletePhotoConfirmOpen(true);
  const confirmRemovePhoto = async () => await savePhoto('');
  const closePhotoModal = () => { setIsEditingPhoto(false); setPreviewImage(null); }

  return (
    <div className="w-full max-w-lg mx-auto pb-24 animate-fade-in pt-2 relative">
      
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-[420px] z-0 overflow-hidden rounded-3x1 [mask-image:linear-gradient(to_top,transparent,black_50%)]">
          <img src="/fundo.png" alt="Background" className="w-full h-full object-cover opacity-10"/>
          <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-slate-1900 to-transparent"></div>
      </div>

      <div className="grid grid-cols-5 px-6 relative z-10 h-[420px] items-end">
          
          <div className="col-span-2 flex flex-col items-start self-center pb-20 z-20 pl-1">
              <div className="flex flex-col items-start w-full mb-2">
                   <div className="relative leading-none">
                       <span className="text-[3.5rem] font-black text-white tracking-tighter drop-shadow-2xl block -ml-1">
                           {player.initial_ovr}
                       </span>
                       {arrowIndicator.show && FormIcon && (
                           <FormIcon size={30} className={`absolute top-4 -right-8 ${formColor} drop-shadow-lg animate-pulse`} strokeWidth={3} />
                       )}
                   </div>
                   <span className="text-2xl font-normal text-emerald-400 tracking-widest uppercase drop-shadow-md mt-[-2px]">
                       {player.position.substring(0, 3)}
                   </span>
              </div>
              
              <h1 className={`${getNameSizeClass(player.name)} font-black text-white uppercase tracking-tighter mb-2 drop-shadow-lg w-full break-words`}>
                  {player.name}
              </h1>
              
              <div className="flex items-center gap-1.5 text-emerald-400 drop-shadow-md opacity-90">
                  <Zap size={12} strokeWidth={1} fill="currentColor" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      {player.playStyle}
                  </span>
              </div>

              {/* --- CONQUISTA OSTENTADA (Lado Esquerdo, sem moldura) --- */}
              {featuredAchievement && (
                <div className="mt-5" title={`Ostentando: ${featuredAchievement.title}`}>
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

          <div className="col-span-3 relative h-full flex items-end justify-center cursor-pointer group" onClick={() => setIsEditingPhoto(true)}>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-56 bg-emerald-400/20 rounded-full blur-3xl -z-10"></div>
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-contain object-bottom drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)] transform scale-125 -translate-y-11 transition-transform group-hover:scale-130 duration-300 [mask-image:linear-gradient(to_top,transparent,black_30%)]" />
              ) : (
                <User size={180} className="text-slate-700 mb-10 opacity-50" />
              )}
          </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4 mb-8 mt-2">
         <StatsBox label="TÍTULOS" value={stats.titles} color="text-emerald-400" subtext={`_`} />
         <StatsBox label="JOGOS" value={stats.gamesPlayed} color="text-emerald-400" subtext={`${stats.wins} Vitórias`} />
         <StatsBox label="GOLS" value={stats.goals} color="text-emerald-400" subtext={`${stats.gamesPlayed ? (stats.goals/stats.gamesPlayed).toFixed(1) : '0'} G/J`} />
         <StatsBox label="ASSIST" value={stats.assists} color="text-emerald-400" subtext={`${stats.gamesPlayed ? (stats.assists/stats.gamesPlayed).toFixed(1) : '0'} A/J`} />
      </div>

      <div className="px-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-xl">
           <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-400" />
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Evolução OVR</h3>
           </div>
           <div className="h-40 flex items-end justify-between gap-2 relative z-10">
               <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs><linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#10b981" stopOpacity="0.3" /><stop offset="100%" stopColor="#34d399" /></linearGradient></defs>
                  <path d={chartData.pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg" />
                  <circle cx={chartData.lastX} cy={chartData.lastY} r="6" fill="#34d399" stroke="white" strokeWidth="2" className="animate-pulse" />
               </svg>
               <div className="absolute bottom-0 w-full flex justify-between text-[10px] text-slate-500 font-bold uppercase pt-2 border-t border-slate-700/50">
                  {chartData.displayLabels.map((label, i) => (<span key={i} className={i === chartData.displayLabels.length - 1 ? 'text-emerald-400' : ''}>{label}</span>))}
               </div>
           </div>
        </div>
      </div>
      
      {isEditingPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
                  <button onClick={closePhotoModal} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Camera size={20} className="text-emerald-400" /> Alterar Foto</h3>
                  {previewImage ? (
                      <div className="flex flex-col items-center animate-scale-up">
                          <div className="w-32 h-32 mb-4 relative bg-slate-700/30 rounded-lg flex items-center justify-center"><img src={previewImage} alt="Preview" className="w-full h-full object-contain drop-shadow-xl" /></div>
                          <div className="flex gap-3 w-full"><button onClick={cancelPreview} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Trocar</button><button onClick={confirmSavePhoto} disabled={isUploading} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold">Salvar</button></div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center">
                          <div className="w-full border-2 border-dashed border-slate-600 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-900/50 cursor-pointer hover:border-emerald-500 hover:bg-slate-900 mb-4" onClick={() => fileInputRef.current?.click()}><Upload size={24} className="text-slate-400 mb-2"/><p className="text-slate-300 text-sm">Selecione uma imagem</p></div>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} disabled={isUploading} />
                          {player.photo_url && (<button onClick={handleRemovePhoto} className="text-red-400 text-sm mt-2">Remover Foto</button>)}
                      </div>
                  )}
              </div>
          </div>
      )}
      {isDeletePhotoConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 text-center">
                <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">Remover Foto?</h3>
                <div className="flex gap-3 mt-4"><button onClick={() => setIsDeletePhotoConfirmOpen(false)} className="flex-1 bg-slate-700 text-white py-2 rounded">Cancelar</button><button onClick={confirmRemovePhoto} className="flex-1 bg-red-600 text-white py-2 rounded">Sim</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Home;