import React, { useMemo, useState, useRef } from 'react';
import { Player, Match, MatchStatus, PlayerFormData } from '../types';
import { playerService } from '../services/playerService';
import { Zap, TrendingUp, User, Camera, Upload, X, Loader2, Trash2, Check, RefreshCw, ChevronsUp, ChevronsDown, Minus, AlertTriangle } from 'lucide-react';

interface HomeProps {
  player: Player;
  matches: Match[]; // To calculate stats
  onPlayerUpdate?: () => void;
}

// Função para definir o tamanho da fonte baseado no comprimento do nome
const getNameSizeClass = (name: string) => {
    const length = name.length;
    if (length > 16) return "text-lg leading-tight"; 
    if (length > 9) return "text-2xl leading-none"; 
    if (length > 6) return "text-3xl leading-[0.9]";
    return "text-4xl leading-[0.8]"; 
};

const Home: React.FC<HomeProps> = ({ player, matches, onPlayerUpdate }) => {
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDeletePhotoConfirmOpen, setIsDeletePhotoConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- CÁLCULO DE ESTATÍSTICAS ---
  const stats = useMemo(() => {
    let gamesPlayed = 0;
    let goals = 0;
    let assists = 0;
    let titles = 0;
    let wins = 0;

    matches.forEach(match => {
      if (match.status !== MatchStatus.FINISHED) return;

      const playerTeam = match.teams.find(t => t.players.some(p => p.id === player.id));
      if (!playerTeam) return;

      const playedGames = match.games.filter(g => 
        g.status === 'FINISHED' && 
        (g.homeTeamId === playerTeam.id || g.awayTeamId === playerTeam.id)
      );
      gamesPlayed += playedGames.length;

      playedGames.forEach(g => {
          const isHome = g.homeTeamId === playerTeam.id;
          const myScore = isHome ? g.homeScore : g.awayScore;
          const oppScore = isHome ? g.awayScore : g.homeScore;
          
          if (myScore > oppScore) {
              wins++;
          } else if (myScore === oppScore && g.penaltyShootout) {
              const p = g.penaltyShootout;
              const myPen = isHome ? p.homeScore : p.awayScore;
              const oppPen = isHome ? p.awayScore : p.homeScore;
              if (myPen > oppPen) wins++;
          }
      });

      match.goals?.forEach(g => {
        if (g.scorerId === player.id) goals++;
        if (g.assistId === player.id) assists++;
      });

      let isChampion = false;
      if (match.type === 'Quadrangular') {
          const finalGame = match.games.find(g => g.phase === 'FINAL' && g.status === 'FINISHED');
          if (finalGame) {
              if (finalGame.homeScore > finalGame.awayScore && finalGame.homeTeamId === playerTeam.id) isChampion = true;
              else if (finalGame.awayScore > finalGame.homeScore && finalGame.awayTeamId === playerTeam.id) isChampion = true;
              else if (finalGame.homeScore === finalGame.awayScore && finalGame.penaltyShootout) {
                  const p = finalGame.penaltyShootout;
                  if (p.homeScore > p.awayScore && finalGame.homeTeamId === playerTeam.id) isChampion = true;
                  if (p.awayScore > p.homeScore && finalGame.awayTeamId === playerTeam.id) isChampion = true;
              }
          }
      } else {
          const teamPoints: Record<string, number> = {};
          match.teams.forEach(t => teamPoints[t.id] = 0);
          match.games.forEach(g => {
              if (g.status === 'FINISHED') {
                  if (g.homeScore > g.awayScore) teamPoints[g.homeTeamId] += 3;
                  else if (g.awayScore > g.homeScore) teamPoints[g.awayTeamId] += 3;
                  else {
                      teamPoints[g.homeTeamId] += 1;
                      teamPoints[g.awayTeamId] += 1;
                  }
              }
          });
          let winnerId = '';
          let maxPoints = -1;
          Object.entries(teamPoints).forEach(([tId, pts]) => {
              if (pts > maxPoints) { maxPoints = pts; winnerId = tId; }
          });
          if (winnerId === playerTeam.id) isChampion = true;
      }
      if (isChampion) titles++;
    });

    return { gamesPlayed, goals, assists, titles, wins };
  }, [matches, player.id]);

  // --- LÓGICA DO GRÁFICO OVR ---
  const chartData = useMemo(() => {
    // Pega a data de registro ou usa hoje como fallback
    const startDate = player.created_at ? new Date(player.created_at) : new Date();
    
    // Constrói os pontos de dados
    let points = [];
    
    // Ponto Inicial (Registro)
    // Se não houver histórico, usamos o OVR atual. Se houver, tentamos inferir ou usar o primeiro do histórico.
    // Para simplificar e garantir continuidade, vamos assumir que o OVR inicial no registro
    // é igual ao primeiro valor histórico disponível ou o atual se não houver histórico.
    const startOvr = player.ovr_history && player.ovr_history.length > 0 
        ? player.ovr_history[0].ovr 
        : player.initial_ovr;

    points.push({ date: startDate, ovr: startOvr });

    // Adiciona histórico existente
    if (player.ovr_history) {
        player.ovr_history.forEach(h => {
            points.push({ date: new Date(h.date), ovr: h.ovr });
        });
    }

    // Se só tivermos 1 ponto (registro), adicionamos o ponto atual ("hoje") para formar uma linha
    if (points.length === 1) {
        points.push({ date: new Date(), ovr: player.initial_ovr });
    }

    // Ordenar por data
    points.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Configurações do SVG
    const width = 350;
    const height = 100;
    const padding = 10;

    // Escalas Y (OVR) - Adiciona margem de +/- 2 para não colar no teto/chão
    const ovrs = points.map(p => p.ovr);
    const minOvr = Math.min(...ovrs) - 2;
    const maxOvr = Math.max(...ovrs) + 2;
    const rangeOvr = maxOvr - minOvr || 1; // Evitar divisão por zero

    // Escalas X (Tempo)
    const minTime = points[0].date.getTime();
    const maxTime = points[points.length - 1].date.getTime();
    const rangeTime = maxTime - minTime || 1;

    // Gerar Caminho SVG (Path)
    const pathD = points.map((p, i) => {
        const x = ((p.date.getTime() - minTime) / rangeTime) * (width - 2 * padding) + padding;
        const y = height - ((p.ovr - minOvr) / rangeOvr) * (height - 2 * padding) - padding;
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

    // Último ponto para o círculo indicador
    const lastPoint = points[points.length - 1];
    const lastX = width - padding; // Sempre no final à direita
    const lastY = height - ((lastPoint.ovr - minOvr) / rangeOvr) * (height - 2 * padding) - padding;

    // Labels do Eixo X (Meses)
    // Mostra até 6 labels distribuídos
    const labels = points.map((p) => {
         const month = p.date.toLocaleString('default', { month: 'short' });
         const year = p.date.getFullYear().toString().slice(2);
         return `${month} ${year}`;
    });
    // Filtra para não ficar muito cheio se tiver muitos pontos
    const displayLabels = labels.length > 6 
        ? labels.filter((_, i) => i === 0 || i === labels.length - 1 || i % Math.ceil(labels.length / 5) === 0)
        : labels;

    return { pathD, lastX, lastY, displayLabels, points };
  }, [player]);

  // Image Utilities
  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500;
                const MAX_HEIGHT = 500;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png')); 
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
          const base64Image = await processImage(file);
          setPreviewImage(base64Image); 
      } catch (error) {
          console.error("Error processing image", error);
          alert("Erro ao processar imagem. Tente uma foto menor.");
      } finally {
          setIsUploading(false);
      }
  };

  const confirmSavePhoto = async () => {
      if (previewImage) await savePhoto(previewImage);
  };

  const cancelPreview = () => {
      setPreviewImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
              dribbling: attributes.dribbling, defending: attributes.defending, physical: attributes.physical
          };
          await playerService.update(player.id, updatePayload);
          setPreviewImage(null);
          setIsEditingPhoto(false);
          setIsDeletePhotoConfirmOpen(false);
          window.location.reload();
      } catch (error: any) {
          console.error("Error saving photo", error);
          alert(`Erro ao salvar foto: ${error.message}`);
      } finally {
          setIsUploading(false);
      }
  };

  const handleRemovePhoto = () => setIsDeletePhotoConfirmOpen(true);
  const confirmRemovePhoto = async () => await savePhoto('');
  const closePhotoModal = () => { setIsEditingPhoto(false); setPreviewImage(null); }

  const delta = player.monthly_delta || 0;
  let FormIcon = Minus;
  let formColor = "text-slate-500";
  if (delta > 0.9) { FormIcon = ChevronsUp; formColor = "text-emerald-400"; } 
  else if (delta < -0.9) { FormIcon = ChevronsDown; formColor = "text-red-500"; }

  return (
    <div className="w-full max-w-lg mx-auto pb-24 animate-fade-in pt-8">
      {/* Top Section: FIFA Card Layout */}
      <div className="grid grid-cols-5 px-6 relative z-10 h-[380px]">
          <div className="col-span-2 flex flex-col items-start pt-6 z-20 pl-1">
              <div className="flex flex-col items-start w-full mb-4">
                   <div className="relative leading-none">
                       <span className="text-[4.5rem] font-black text-white tracking-tighter drop-shadow-2xl block -ml-1">
                           {player.initial_ovr}
                       </span>
                       <FormIcon size={0} className={`absolute top-6 -right-11 ${formColor} drop-shadow-lg animate-pulse`} strokeWidth={3} />
                   </div>
                   <span className="text-4xl font-normal text-emerald-400 tracking-widest uppercase drop-shadow-md mt-[-5px]">
                       {player.position.substring(0, 3)}
                   </span>
              </div>
              <h1 className={`${getNameSizeClass(player.name)} font-black text-white uppercase tracking-tighter mb-3 drop-shadow-lg w-full break-words`}>
                  {player.name}
              </h1>
              <div className="flex items-center gap-2 text-emerald-400 drop-shadow-md opacity-90">
                  <Zap size={15} strokeWidth={1} fill="currentColor" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {player.playStyle}
                  </span>
              </div>
          </div>
          <div className="col-span-3 relative flex items-end justify-center cursor-pointer group" onClick={() => setIsEditingPhoto(true)} title="Clique para alterar foto">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl -z-10"></div>
              {player.photo_url ? (
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-contain object-bottom drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)] transform translate-y-2 transition-transform group-hover:scale-105 duration-300 [mask-image:linear-gradient(to_top,transparent,black_30%)]" />
              ) : (
                <User size={160} className="text-slate-700 mb-8 opacity-50" />
              )}
          </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 px-4 mb-8 mt-4">
         <StatsBox label="TÍTULOS" value={stats.titles} color="text-emerald-400" />
         <StatsBox 
            label="JOGOS" 
            value={stats.gamesPlayed} 
            color="text-emerald-400" 
            subtext={`${stats.wins} Vitórias`} 
         />
         <StatsBox label="GOLS" value={stats.goals} color="text-emerald-400" subtext={`${stats.gamesPlayed ? (stats.goals/stats.gamesPlayed).toFixed(1) : '0'} G/J`} />
         <StatsBox label="ASSIST" value={stats.assists} color="text-emerald-400" subtext={`${stats.gamesPlayed ? (stats.assists/stats.gamesPlayed).toFixed(1) : '0'} A/J`} />
      </div>

      {/* OVR Evolution Chart (Agora Funcional) */}
      <div className="px-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-xl">
           <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-400" />
              <h3 className="text-white font-bold uppercase tracking-wider text-sm">Evolução OVR</h3>
           </div>
           
           <div className="h-40 flex items-end justify-between gap-2 relative z-10">
               <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                  
                  <path 
                    d={chartData.pathD} 
                    fill="none" 
                    stroke="url(#lineGradient)" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-lg"
                  />
                  
                  <circle cx={chartData.lastX} cy={chartData.lastY} r="6" fill="#34d399" stroke="white" strokeWidth="2" className="animate-pulse" />
               </svg>
               
               <div className="absolute bottom-0 w-full flex justify-between text-[10px] text-slate-500 font-bold uppercase pt-2 border-t border-slate-700/50">
                  {chartData.displayLabels.map((label, i) => (
                      <span key={i} className={i === chartData.displayLabels.length - 1 ? 'text-emerald-400' : ''}>
                          {label}
                      </span>
                  ))}
               </div>
           </div>
        </div>
      </div>

      {/* Modals (Photo Upload / Delete) */}
      {isEditingPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
                  <button onClick={closePhotoModal} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Camera size={20} className="text-emerald-400" /> Alterar Foto</h3>
                  {previewImage ? (
                      <div className="flex flex-col items-center animate-scale-up">
                          <div className="w-32 h-32 mb-4 relative bg-slate-700/30 rounded-lg flex items-center justify-center"><img src={previewImage} alt="Preview" className="w-full h-full object-contain drop-shadow-xl" /></div>
                          <p className="text-white font-medium mb-6">Usar esta imagem?</p>
                          <div className="flex gap-3 w-full">
                              <button onClick={cancelPreview} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"><RefreshCw size={18} /> Trocar</button>
                              <button onClick={confirmSavePhoto} disabled={isUploading} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/70 disabled:cursor-wait text-white rounded-lg font-bold shadow-lg shadow-emerald-900/30 transition-transform active:scale-95 flex items-center justify-center gap-2">{isUploading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} {isUploading ? 'Salvando...' : 'Salvar'}</button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center">
                          <div className="w-full border-2 border-dashed border-slate-600 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-900/50 cursor-pointer hover:border-emerald-500 hover:bg-slate-900 transition-all group mb-4" onClick={() => fileInputRef.current?.click()}>
                            {isUploading ? (<div className="flex flex-col items-center gap-3"><Loader2 size={32} className="animate-spin text-emerald-500" /><span className="text-slate-400 text-sm">Processando...</span></div>) : (<><div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Upload size={24} className="text-slate-400 group-hover:text-emerald-400" /></div><p className="text-slate-300 font-medium text-sm text-center">Selecione uma imagem<br/>(PNG Transparente ideal)</p></>)}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} disabled={isUploading} />
                          </div>
                          {player.photo_url && (<button onClick={handleRemovePhoto} className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 py-2 rounded transition-colors text-sm"><Trash2 size={16} /> Remover Foto</button>)}
                      </div>
                  )}
              </div>
          </div>
      )}
      {isDeletePhotoConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center border border-red-700/50"><AlertTriangle size={32} className="text-red-500" /></div>
                    <div><h3 className="text-xl font-bold text-white">Remover Foto?</h3><p className="text-slate-400 text-sm mt-2">A imagem de perfil será excluída e voltará ao padrão.</p></div>
                    <div className="flex gap-3 w-full mt-4"><button onClick={() => setIsDeletePhotoConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">Cancelar</button><button onClick={confirmRemovePhoto} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-transform active:scale-95">Sim, Remover</button></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const StatsBox = ({ label, value, color, subtext }: { label: string, value: number, color: string, subtext?: string }) => (
  <div className="bg-slate-800 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-top shadow-lg">
    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">{label}</span>
    <span className={`text-4xl font-black ${color} leading-none`}>{value}</span>
    {subtext && <span className="text-[9px] text-slate-500 mt-1">{subtext}</span>}
  </div>
);

export default Home;