import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Player, Team, PlayerPosition } from '../types';
import { generateTeams, TournamentType } from '../utils/teamBalancer';
import { matchService } from '../services/matchService';
import { presetService, PlayerPreset } from '../services/presetService';
import { Calendar, Users, CheckSquare, Square, Wand2, Trophy, Zap, Save, CheckCircle, Shirt, Download, Image as ImageIcon, Loader2, Bookmark, Trash2, Plus, X } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { saveAs } from 'file-saver';
import { formatMatchDate } from '../utils/dateUtils';

const AVAILABLE_COLORS = ['Branco', 'Preto', 'Vermelho', 'Azul', 'Verde', 'Dourado', 'Laranja'];

interface TeamSorterProps {
  players: Player[];
  onDraftSaved: () => void;
}

const TeamSorter: React.FC<TeamSorterProps> = ({ players, onDraftSaved }) => {
  const [config, setConfig] = useState({
    type: 'Quadrangular' as TournamentType,
    fieldSize: 'Maior' as 'Menor' | 'Maior',
    date: new Date().toISOString().split('T')[0],
    location: ''
  });

  const [teamColors, setTeamColors] = useState<string[]>(['Branco', 'Preto', 'Vermelho', 'Azul']);

  const handleColorChange = (index: number, newColor: string) => {
    const newColors = [...teamColors];
    newColors[index] = newColor;
    setTeamColors(newColors);

    if (manualTeams) {
      setManualTeams(prev => {
        if (!prev) return null;
        return prev.map((t, idx) => {
          if (idx === index) {
            return {
              ...t,
              name: `Time ${newColor}`
            };
          }
          return t;
        });
      });
    }
  };

  const exportRef = useRef<HTMLDivElement>(null);
  
  // Limites dinâmicos baseados no tamanho do campo e formato de torneio
  const playersPerTeam = config.fieldSize === 'Menor' ? 6 : 7;
  const numTeams = config.type === 'Quadrangular' ? 4 : 3;
  const maxTotalPlayers = numTeams * playersPerTeam;

  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [selectedGkIds, setSelectedGkIds] = useState<Set<string>>(new Set());
  
  // Total atual selecionado
  const currentTotal = selectedLineIds.size + selectedGkIds.size;

  const [presets, setPresets] = useState<PlayerPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTeams, setGeneratedTeams] = useState<Team[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // Estados para Montagem Manual
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualTeams, setManualTeams] = useState<Team[] | null>(null);

  const [diaristaSearch, setDiaristaSearch] = useState('');

  const linePlayersList = useMemo(() => players.filter(p => p.position !== PlayerPosition.GOLEIRO).sort((a,b) => b.initial_ovr - a.initial_ovr), [players]);
  const gkPlayersList = useMemo(() => players.filter(p => p.position === PlayerPosition.GOLEIRO).sort((a,b) => b.initial_ovr - a.initial_ovr), [players]);

  const lineMensalistas = useMemo(() => {
    return linePlayersList.filter(p => p.is_mensalista);
  }, [linePlayersList]);

  const lineDiaristas = useMemo(() => {
    return linePlayersList.filter(p => !p.is_mensalista && p.name.toLowerCase().includes(diaristaSearch.toLowerCase()));
  }, [linePlayersList, diaristaSearch]);

  // Pré-seleção automática de mensalistas no primeiro carregamento de players
  useEffect(() => {
    if (selectedLineIds.size === 0 && selectedGkIds.size === 0 && players.length > 0) {
      const lineM = players.filter(p => p.position !== PlayerPosition.GOLEIRO && p.is_mensalista);
      const gkM = players.filter(p => p.position === PlayerPosition.GOLEIRO && p.is_mensalista);
      
      const initialLineSet = new Set<string>();
      const initialGkSet = new Set<string>();
      let count = 0;

      // Adiciona goleiros mensalistas respeitando o número de times
      gkM.forEach(gk => {
        if (count < maxTotalPlayers && initialGkSet.size < numTeams) {
          initialGkSet.add(gk.id);
          count++;
        }
      });

      // Adiciona jogadores de linha mensalistas até encher
      lineM.forEach(p => {
        if (count < maxTotalPlayers) {
          initialLineSet.add(p.id);
          count++;
        }
      });

      setSelectedLineIds(initialLineSet);
      setSelectedGkIds(initialGkSet);
    }
  }, [players, maxTotalPlayers, numTeams]);

  useEffect(() => { loadPresets(); }, []);
  const loadPresets = async () => { const data = await presetService.getAll(); setPresets(data); };

  const handleLoadPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
        const newLineSet = new Set<string>();
        const newGkSet = new Set<string>();
        let count = 0;

        preset.player_ids.forEach(id => {
            const player = players.find(p => p.id === id);
            if (player && count < maxTotalPlayers) {
                if (player.position === PlayerPosition.GOLEIRO) {
                    newGkSet.add(id);
                } else {
                    newLineSet.add(id);
                }
                count++;
            }
        });
        setSelectedLineIds(newLineSet);
        setSelectedGkIds(newGkSet);
    }
  };

  const handleSavePreset = async () => {
      if (!newPresetName.trim()) return;
      setIsSavingPreset(true);
      const allSelectedIds = [...Array.from(selectedLineIds), ...Array.from(selectedGkIds)];
      await presetService.create(newPresetName, allSelectedIds);
      await loadPresets();
      setShowSavePresetModal(false);
      setNewPresetName('');
      setIsSavingPreset(false);
  };

  const handleDeletePreset = async () => {
      if (!selectedPresetId) return;
      if (window.confirm("Tem certeza que deseja excluir este grupo salvo?")) {
          await presetService.delete(selectedPresetId);
          setSelectedPresetId('');
          await loadPresets();
      }
  };

  const toggleLinePlayer = (id: string) => {
    const newSet = new Set(selectedLineIds);
    if (newSet.has(id)) {
      newSet.delete(id); 
      if (isManualMode) removePlayerFromManualTeam(id);
    } else if (currentTotal < maxTotalPlayers) {
      newSet.add(id);
    }
    setSelectedLineIds(newSet);
  };

  const toggleGkPlayer = (id: string) => {
    const newSet = new Set(selectedGkIds);
    if (newSet.has(id)) {
      newSet.delete(id); 
      if (isManualMode) removePlayerFromManualTeam(id);
    } else if (currentTotal < maxTotalPlayers) {
      newSet.add(id);
    }
    setSelectedGkIds(newSet);
  };

  const toggleAllLine = () => {
    if (selectedLineIds.size > 0) {
        setSelectedLineIds(new Set());
        if (isManualMode && manualTeams) {
          // Limpa todos da linha nos times manuais
          setManualTeams(prev => {
            if (!prev) return null;
            return prev.map(t => ({
              ...t,
              players: t.players.filter(p => p.position === PlayerPosition.GOLEIRO),
              totalOvr: t.players.filter(p => p.position === PlayerPosition.GOLEIRO).reduce((sum, p) => sum + p.initial_ovr, 0),
              avgOvr: 0,
              styleCounts: {}
            }));
          });
        }
    } else {
        const remaining = maxTotalPlayers - selectedGkIds.size;
        setSelectedLineIds(new Set(linePlayersList.slice(0, remaining).map(p => p.id)));
    }
  };

  // --- LÓGICA DE MONTAGEM MANUAL DE TIMES ---

  const initializeManualTeams = () => {
    const initialTeams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
      id: `team-${i}`,
      name: `Time ${teamColors[i] || String.fromCharCode(65 + i)}`,
      players: [],
      totalOvr: 0,
      avgOvr: 0,
      styleCounts: {}
    }));
    setManualTeams(initialTeams);
    setGeneratedTeams(null);
  };

  useEffect(() => {
    if (isManualMode) {
      initializeManualTeams();
    } else {
      setManualTeams(null);
    }
  }, [isManualMode, config.type, config.fieldSize]);

  const presentPlayers = useMemo(() => {
    return players.filter(p => selectedLineIds.has(p.id) || selectedGkIds.has(p.id));
  }, [players, selectedLineIds, selectedGkIds]);

  const unassignedPlayers = useMemo(() => {
    if (!isManualMode || !manualTeams) return [];
    const assignedIds = new Set(manualTeams.flatMap(t => t.players.map(p => p.id)));
    return presentPlayers.filter(p => !assignedIds.has(p.id)).sort((a,b) => b.initial_ovr - a.initial_ovr);
  }, [presentPlayers, manualTeams, isManualMode]);

  const assignPlayerToManualTeam = (player: Player, teamId: string) => {
    if (!manualTeams) return;
    const targetTeam = manualTeams.find(t => t.id === teamId);
    if (!targetTeam) return;

    if (targetTeam.players.length >= playersPerTeam) {
      alert(`O ${targetTeam.name} já possui o limite de ${playersPerTeam} jogadores.`);
      return;
    }

    if (player.position === PlayerPosition.GOLEIRO && targetTeam.players.some(p => p.position === PlayerPosition.GOLEIRO)) {
      alert(`O ${targetTeam.name} já possui um goleiro.`);
      return;
    }

    setManualTeams(prev => {
      if (!prev) return null;
      return prev.map(team => {
        if (team.id === teamId) {
          const updatedPlayers = [...team.players, player];
          const linePlayers = updatedPlayers.filter(p => p.position !== PlayerPosition.GOLEIRO);
          const totalOvr = updatedPlayers.reduce((sum, p) => sum + p.initial_ovr, 0);
          const avgOvr = linePlayers.length > 0
            ? Math.round(linePlayers.reduce((sum, p) => sum + p.initial_ovr, 0) / linePlayers.length)
            : 0;

          const styleCounts: Record<string, number> = {};
          updatedPlayers.forEach(p => {
            const style = p.playStyle || 'Unknown';
            styleCounts[style] = (styleCounts[style] || 0) + 1;
          });

          return { ...team, players: updatedPlayers, totalOvr, avgOvr, styleCounts };
        }
        return team;
      });
    });
  };

  const removePlayerFromManualTeam = (playerId: string) => {
    setManualTeams(prev => {
      if (!prev) return null;
      return prev.map(team => {
        if (team.players.some(p => p.id === playerId)) {
          const updatedPlayers = team.players.filter(p => p.id !== playerId);
          const linePlayers = updatedPlayers.filter(p => p.position !== PlayerPosition.GOLEIRO);
          const totalOvr = updatedPlayers.reduce((sum, p) => sum + p.initial_ovr, 0);
          const avgOvr = linePlayers.length > 0
            ? Math.round(linePlayers.reduce((sum, p) => sum + p.initial_ovr, 0) / linePlayers.length)
            : 0;

          const styleCounts: Record<string, number> = {};
          updatedPlayers.forEach(p => {
            const style = p.playStyle || 'Unknown';
            styleCounts[style] = (styleCounts[style] || 0) + 1;
          });

          return { ...team, players: updatedPlayers, totalOvr, avgOvr, styleCounts };
        }
        return team;
      });
    });
  };

  const handleSaveManualDraft = async () => {
    if (!manualTeams) return;
    if (unassignedPlayers.length > 0) {
      if (!window.confirm(`Ainda restam ${unassignedPlayers.length} jogador(es) sem time. Salvar rascunho mesmo assim?`)) {
        return;
      }
    }
    setIsSaving(true);
    try {
      await matchService.createDraft(manualTeams, config);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar rascunho manual.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- MONTAGEM AUTOMÁTICA ---

  const handleGenerate = () => {
    setIsGenerating(true);
    setGeneratedTeams(null);
    const pool = players.filter(p => selectedLineIds.has(p.id) || selectedGkIds.has(p.id));
    
    setTimeout(() => {
      const activeColors = teamColors.slice(0, numTeams);
      const teams = generateTeams(pool, config.type, activeColors);
      setGeneratedTeams(teams);
      setIsGenerating(false);
      setTimeout(() => document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, 800);
  };

  const handleSaveDraft = async () => {
    if (!generatedTeams) return;
    setIsSaving(true);
    try { await matchService.createDraft(generatedTeams, config); setIsSuccessModalOpen(true); } 
    catch (error) { console.error(error); alert("Erro ao salvar rascunho."); } finally { setIsSaving(false); }
  };

  const handleExportImage = async () => {
      if (exportRef.current === null || isExporting) return;
      setIsExporting(true);
      try {
          const dataUrl = await htmlToImage.toPng(exportRef.current, { cacheBust: true, backgroundColor: '#0f172a', style: { padding: '20px' } });
          saveAs(dataUrl, `Sorteio_Pelada_${config.date}.png`);
      } catch (err) { console.error('Erro ao exportar:', err); alert('Erro ao gerar imagem.'); } finally { setIsExporting(false); }
  };

  const getOvrColor = (ovr: number) => {
    if (ovr >= 80) return 'text-green-400';
    if (ovr >= 70) return 'text-yellow-400';
    if (ovr < 60) return 'text-red-400';
    return 'text-slate-300';
  };

  const getTeamStyle = (name: string) => {
      if (name.includes('Branco')) return { bgHeader: 'bg-slate-100', textHeader: 'text-slate-900', border: 'border-slate-300' };
      if (name.includes('Preto')) return { bgHeader: 'bg-slate-950', textHeader: 'text-white', border: 'border-slate-700' };
      if (name.includes('Vermelho')) return { bgHeader: 'bg-red-700', textHeader: 'text-white', border: 'border-red-600' };
      if (name.includes('Azul')) return { bgHeader: 'bg-blue-700', textHeader: 'text-white', border: 'border-blue-600' };
      if (name.includes('Verde')) return { bgHeader: 'bg-green-700', textHeader: 'text-white', border: 'border-green-600' };
      if (name.includes('Dourado')) return { bgHeader: 'bg-amber-500', textHeader: 'text-slate-950', border: 'border-amber-400' };
      if (name.includes('Laranja')) return { bgHeader: 'bg-orange-600', textHeader: 'text-white', border: 'border-orange-500' };
      return { bgHeader: 'bg-slate-800', textHeader: 'text-white', border: 'border-slate-700' };
  };

  const getManualBtnStyle = (teamName: string) => {
      if (teamName.includes('Branco')) return { btnClass: 'bg-slate-200 text-slate-900 hover:bg-white', label: 'B' };
      if (teamName.includes('Preto')) return { btnClass: 'bg-slate-950 text-white border border-slate-700 hover:bg-slate-900', label: 'P' };
      if (teamName.includes('Vermelho')) return { btnClass: 'bg-red-700 text-white hover:bg-red-600', label: 'VM' };
      if (teamName.includes('Azul')) return { btnClass: 'bg-blue-700 text-white hover:bg-blue-600', label: 'AZ' };
      if (teamName.includes('Verde')) return { btnClass: 'bg-green-700 text-white hover:bg-green-600', label: 'VD' };
      if (teamName.includes('Dourado')) return { btnClass: 'bg-amber-500 text-slate-950 hover:bg-amber-400', label: 'D' };
      if (teamName.includes('Laranja')) return { btnClass: 'bg-orange-600 text-white hover:bg-orange-500', label: 'L' };
      return { btnClass: 'bg-slate-700 text-white hover:bg-slate-600', label: 'T' };
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2"><Wand2 className="text-yellow-400" /> Sorteador Oficial</h1>
        <p className="text-slate-400">Selecione os presentes, escolha o modo e defina as equipes.</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 w-full md:w-auto">
              <Bookmark className="text-blue-400" size={20} />
              <span className="text-white font-bold text-sm hidden md:inline">Grupos Salvos:</span>
              <select value={selectedPresetId} onChange={(e) => handleLoadPreset(e.target.value)} className="bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:w-64">
                  <option value="">-- Selecione --</option>
                  {presets.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              {selectedPresetId && (<button onClick={handleDeletePreset} className="p-2 text-red-400 hover:text-red-300 bg-slate-900 rounded border border-slate-700 hover:bg-red-900/20 transition-colors"><Trash2 size={16} /></button>)}
          </div>
          <button onClick={() => setShowSavePresetModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm font-medium transition-colors border border-slate-600 w-full md:w-auto justify-center"><Plus size={16} /> Salvar Seleção Atual</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Calendar size={16} className="text-blue-500" /> Configuração</h3>
                <div className="space-y-3">
                    <select value={config.type} onChange={(e) => setConfig({ ...config, type: e.target.value as TournamentType })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Quadrangular">Quadrangular (4 times)</option>
                      <option value="Triangular">Triangular (3 times)</option>
                    </select>
                    <select value={config.fieldSize} onChange={(e) => setConfig({ ...config, fieldSize: e.target.value as 'Menor' | 'Maior' })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Maior">Campo Maior (6 Linha + 1 GK)</option>
                      <option value="Menor">Campo Menor (5 Linha + 1 GK)</option>
                    </select>
                    <input type="date" value={config.date} onChange={(e) => setConfig({ ...config, date: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    <input type="text" placeholder="Local..." value={config.location} onChange={(e) => setConfig({ ...config, location: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Shirt size={16} className="text-blue-500" /> Cores dos Times</h3>
                <div className="space-y-2">
                    {Array.from({ length: numTeams }).map((_, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-400 font-medium">Time {idx + 1}:</span>
                            <select 
                                value={teamColors[idx] || ''} 
                                onChange={(e) => handleColorChange(idx, e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none flex-1 max-w-[150px]"
                            >
                                {AVAILABLE_COLORS.map(color => (
                                    <option key={color} value={color}>{color}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><Shirt size={16} className="text-yellow-500" /> Goleiros</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-400">{selectedGkIds.size} / {numTeams}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {gkPlayersList.map(p => {
                        const isSelected = selectedGkIds.has(p.id);
                        const isDisabled = !isSelected && currentTotal >= maxTotalPlayers;
                        return (
                            <div 
                                key={p.id} 
                                onClick={() => !isDisabled && toggleGkPlayer(p.id)} 
                                className={`flex items-center justify-between p-2 rounded transition-all ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} border ${isSelected ? 'bg-slate-700 border-green-500/50' : 'bg-slate-900/50 border-transparent hover:bg-slate-700'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-sm border ${isSelected ? 'bg-green-500 border-green-500' : 'border-slate-500'}`}></div>
                                    <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                        {p.name}
                                        {p.is_mensalista && (
                                            <span className="text-[9px] bg-green-950/80 text-green-400 px-1 py-0.5 rounded ml-1 border border-green-500/20 font-bold font-mono">M</span>
                                        )}
                                    </span>
                                </div>
                                <span className={`text-xs font-bold ${getOvrColor(p.initial_ovr)}`}>{p.initial_ovr}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        <div className="lg:col-span-5">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col h-[580px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users size={20} className="text-blue-400" /> Jogadores</h3>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${currentTotal === maxTotalPlayers ? 'bg-green-900 text-green-400' : 'bg-slate-900 text-slate-400'}`}>Total: {currentTotal} / {maxTotalPlayers}</span>
                        <button onClick={toggleAllLine} className="text-xs text-blue-400 hover:text-white underline">Completar</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {/* MENSALISTAS */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span>Mensalistas ({lineMensalistas.length})</span>
                            <span className="text-[9px] text-green-400 bg-green-950/40 px-2 py-0.5 rounded border border-green-500/20 font-bold">Vaga Garantida</span>
                        </h4>
                        <div className="space-y-2">
                            {lineMensalistas.map(p => {
                                const isSelected = selectedLineIds.has(p.id);
                                const isDisabled = !isSelected && currentTotal >= maxTotalPlayers;
                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => !isDisabled && toggleLinePlayer(p.id)} 
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-slate-700/50 border-blue-500/50' : 'bg-slate-900/30 border-slate-800 hover:border-slate-600'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isSelected ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} className="text-slate-500" />}
                                            <div>
                                                <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>{p.name}</p>
                                                <div className="flex gap-2 text-[10px] text-slate-500">
                                                    <span>{p.position.substring(0,3)}</span>
                                                    {p.playStyle && <span className="text-yellow-600 flex items-center gap-0.5"><Zap size={8}/>{p.playStyle}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`font-bold text-sm ${getOvrColor(p.initial_ovr)}`}>{p.initial_ovr}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* DIARISTAS */}
                    <div className="pt-2 border-t border-slate-700/50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Diaristas ({lineDiaristas.length})
                            </h4>
                            <input 
                                type="text"
                                placeholder="Buscar diarista..."
                                value={diaristaSearch}
                                onChange={(e) => setDiaristaSearch(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
                            />
                        </div>
                        
                        {lineDiaristas.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4">{diaristaSearch ? 'Nenhum diarista encontrado' : 'Nenhum diarista disponível'}</p>
                        ) : (
                            <div className="space-y-2">
                                {lineDiaristas.map(p => {
                                    const isSelected = selectedLineIds.has(p.id);
                                    const isDisabled = !isSelected && currentTotal >= maxTotalPlayers;
                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => !isDisabled && toggleLinePlayer(p.id)} 
                                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-slate-700/50 border-blue-500/50' : 'bg-slate-900/30 border-slate-800 hover:border-slate-600'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {isSelected ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} className="text-slate-500" />}
                                                <div>
                                                    <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>{p.name}</p>
                                                    <div className="flex gap-2 text-[10px] text-slate-500">
                                                        <span>{p.position.substring(0,3)}</span>
                                                        {p.playStyle && <span className="text-yellow-600 flex items-center gap-0.5"><Zap size={8}/>{p.playStyle}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`font-bold text-sm ${getOvrColor(p.initial_ovr)}`}>{p.initial_ovr}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Botão de geração oculta se estiver no modo manual */}
            {!isManualMode && (
              <button onClick={handleGenerate} disabled={isGenerating || currentTotal < (config.type === 'Quadrangular' ? 12 : 9)} className="w-full mt-4 py-3 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2">{isGenerating ? <Loader2 className="animate-spin" /> : <><Wand2 size={20} /> Sortear Times</>}</button>
            )}
        </div>

        <div className="lg:col-span-4" id="results-section">
          {/* Seletor de Modo no Topo */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-1.5 flex gap-2 mb-4 shadow">
              <button 
                  onClick={() => setIsManualMode(false)} 
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${!isManualMode ? 'bg-blue-600 text-white shadow' : 'bg-slate-900/50 text-slate-400 hover:text-white'}`}
              >
                  Sorteio Automático
              </button>
              <button 
                  onClick={() => {
                      setIsManualMode(true);
                      initializeManualTeams();
                  }} 
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${isManualMode ? 'bg-blue-600 text-white shadow' : 'bg-slate-900/50 text-slate-400 hover:text-white'}`}
              >
                  Montagem Manual
              </button>
          </div>

          {!isManualMode ? (
            generatedTeams ? (
              <div className="space-y-4 animate-slide-up">
                <div ref={exportRef} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="text-center mb-4 md:hidden"><h2 className="text-xl font-bold text-white mb-1">Sorteio do Baba</h2><p className="text-slate-400 text-sm">{formatMatchDate(config.date)} - {config.location}</p></div>
                    
                    <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Trophy className="text-blue-400" size={18} /> Times</h3><span className="text-slate-400 text-xs bg-slate-800 px-2 py-1 rounded">Média OVR: {Math.round(generatedTeams.reduce((a, b) => a + b.avgOvr, 0) / generatedTeams.length)}</span></div>
                    <div className="space-y-4">
                      {generatedTeams.map((team) => {
                        const style = getTeamStyle(team.name);
                        return (
                          <div key={team.id} className={`bg-slate-800 border ${style.border} rounded-lg overflow-hidden shadow-sm`}>
                            <div className={`${style.bgHeader} px-4 py-2 border-b ${style.border} flex justify-between items-center`}>
                              <h4 className={`font-bold ${style.textHeader}`}>{team.name}</h4>
                              <span className={`text-sm font-bold ${style.textHeader === 'text-white' ? 'text-green-400' : 'text-slate-900'} bg-black/20 px-2 py-0.5 rounded`}>{team.avgOvr}</span>
                            </div>
                            <div className="divide-y divide-slate-700/50">
                              {team.players.map((player, idx) => (
                                <div key={player.id} className="px-4 py-2 flex justify-between items-center text-sm hover:bg-slate-700/30 transition-colors">
                                   <div className="flex items-center gap-3">
                                      <span className="text-slate-500 text-xs font-mono w-4">{idx + 1}.</span>
                                      <span className={`font-medium ${player.position === PlayerPosition.GOLEIRO ? 'text-yellow-500 font-bold' : 'text-slate-200'}`}>
                                          {player.name} {player.position === PlayerPosition.GOLEIRO && '🧤'}
                                      </span>
                                   </div>
                                   <span className={`font-bold ${getOvrColor(player.initial_ovr)}`}>{player.initial_ovr}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
                <div className="flex gap-3 pt-2"><button onClick={handleExportImage} disabled={isExporting} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">{isExporting ? <Loader2 className="animate-spin" /> : <><ImageIcon size={18} /> Baixar Imagem</>}</button><button onClick={handleSaveDraft} disabled={isSaving} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Salvar Rascunho</>}</button></div>
              </div>
            ) : (<div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/50 p-8 min-h-[400px]"><Wand2 size={48} className="mb-4 text-slate-700" /><p className="font-medium">Aguardando sorteio</p><p className="text-sm mt-2 text-center">Selecione os jogadores e clique em "Sortear Times".</p></div>)
          ) : (
            manualTeams && (
              <div className="space-y-4 animate-slide-up">
                {/* Jogadores Disponíveis para Escalar */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
                    <h3 className="text-sm font-bold text-white mb-2 flex items-center justify-between">
                      <span>Não Escalados ({unassignedPlayers.length})</span>
                    </h3>
                    {unassignedPlayers.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-2">Todos os presentes foram distribuídos!</p>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {unassignedPlayers.map(p => (
                                <div key={p.id} className="bg-slate-800 border border-slate-700/60 rounded p-2 flex items-center justify-between text-xs gap-2 hover:border-slate-500 transition-colors">
                                    <span className="font-medium text-slate-300 truncate max-w-[120px]" title={p.name}>
                                      {p.name} {p.position === PlayerPosition.GOLEIRO && '🧤'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold mr-1 ${getOvrColor(p.initial_ovr)}`}>{p.initial_ovr}</span>
                                      <div className="flex gap-0.5">
                                          {manualTeams.map((team) => {
                                              const btnStyle = getManualBtnStyle(team.name);
                                              return (
                                                  <button 
                                                      key={team.id}
                                                      onClick={() => assignPlayerToManualTeam(p, team.id)}
                                                      className={`w-6 h-6 rounded text-[9px] font-black flex items-center justify-center transition-all transform active:scale-90 ${btnStyle.btnClass}`}
                                                      title={`Mover para ${team.name}`}
                                                  >
                                                      {btnStyle.label}
                                                  </button>
                                              );
                                          })}
                                      </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lista de Equipes Manuais */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md space-y-4">
                    <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white flex items-center gap-2"><Trophy size={16} className="text-yellow-500" /> Equipes</h3><span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Formato: {playersPerTeam} x {numTeams}</span></div>
                    <div className="space-y-4">
                        {manualTeams.map((team) => {
                            const style = getTeamStyle(team.name);
                            return (
                                <div key={team.id} className={`bg-slate-800 border ${style.border} rounded-lg overflow-hidden shadow-sm`}>
                                    <div className={`${style.bgHeader} px-3 py-1.5 border-b ${style.border} flex justify-between items-center`}>
                                        <h4 className={`font-bold text-xs ${style.textHeader}`}>{team.name} ({team.players.length}/{playersPerTeam})</h4>
                                        <span className={`text-[10px] font-bold ${style.textHeader === 'text-white' ? 'text-green-400' : 'text-slate-900'} bg-black/20 px-2 py-0.5 rounded`}>
                                            Média: {team.avgOvr}
                                        </span>
                                    </div>
                                    <div className="divide-y divide-slate-700/40 min-h-[35px] max-h-48 overflow-y-auto custom-scrollbar">
                                        {team.players.length === 0 ? (
                                            <div className="p-3 text-[10px] text-slate-500 text-center italic">Sem jogadores adicionados.</div>
                                        ) : (
                                            team.players.map((player, idx) => (
                                                <div key={player.id} className="px-3 py-1.5 flex justify-between items-center text-[11px] hover:bg-slate-700/20 transition-colors">
                                                    <span className={`font-medium ${player.position === PlayerPosition.GOLEIRO ? 'text-yellow-500 font-bold' : 'text-slate-300'}`}>
                                                        {idx + 1}. {player.name} {player.position === PlayerPosition.GOLEIRO && '🧤'}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${getOvrColor(player.initial_ovr)}`}>{player.initial_ovr}</span>
                                                        <button 
                                                            onClick={() => removePlayerFromManualTeam(player.id)}
                                                            className="text-red-400 hover:text-red-300 p-0.5 hover:bg-red-950/20 rounded transition-colors"
                                                            title="Remover do time"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Salvar Rascunho Manual */}
                <button 
                    onClick={handleSaveManualDraft} 
                    disabled={isSaving || presentPlayers.length < (config.type === 'Quadrangular' ? 12 : 9)} 
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Salvar Rascunho Manual</>}
                </button>
              </div>
            )
          )}
        </div>
      </div>
      
      {showSavePresetModal && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"><div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-sm"><h3 className="text-lg font-bold text-white mb-4">Salvar Grupo</h3><input type="text" placeholder="Nome do grupo..." value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} autoFocus className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-white mb-4 outline-none focus:ring-2 focus:ring-green-500" /><div className="flex gap-3"><button onClick={() => setShowSavePresetModal(false)} className="flex-1 py-2 bg-slate-700 text-white rounded font-medium">Cancelar</button><button onClick={handleSavePreset} disabled={!newPresetName.trim() || isSavingPreset} className="flex-1 py-2 bg-green-600 text-white rounded font-bold disabled:opacity-50">Salvar</button></div></div></div>)}
      {isSuccessModalOpen && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"><div className="bg-slate-800 border border-green-500/50 rounded-xl p-8 text-center shadow-2xl max-w-sm w-full animate-scale-up"><div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50"><CheckCircle size={32} className="text-green-500" /></div><h3 className="text-2xl font-bold text-white mb-2">Sorteio Salvo!</h3><p className="text-slate-400 mb-6">O rascunho foi criado com sucesso.</p><button onClick={() => { setIsSuccessModalOpen(false); onDraftSaved(); }} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors shadow-lg active:scale-95">Ir para Meus Eventos</button></div></div>)}
    </div>
  );
};

export default TeamSorter;