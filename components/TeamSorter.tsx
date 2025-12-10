import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Player, Team, PlayerPosition } from '../types';
import { generateTeams, TournamentType } from '../utils/teamBalancer';
import { matchService } from '../services/matchService';
import { presetService, PlayerPreset } from '../services/presetService'; // <--- NOVO IMPORT
import { Calendar, Users, CheckSquare, Square, Wand2, Trophy, Zap, Save, CheckCircle, Shirt, Download, Image as ImageIcon, Loader2, Bookmark, Trash2, Plus } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { saveAs } from 'file-saver';

interface TeamSorterProps {
  players: Player[];
  onDraftSaved: () => void;
}

const TeamSorter: React.FC<TeamSorterProps> = ({ players, onDraftSaved }) => {
  const [config, setConfig] = useState({
    type: 'Quadrangular' as TournamentType,
    date: new Date().toISOString().split('T')[0],
    location: ''
  });

  const exportRef = useRef<HTMLDivElement>(null);

  const maxLinePlayers = config.type === 'Quadrangular' ? 24 : 18;
  const maxGkPlayers = config.type === 'Quadrangular' ? 4 : 3;

  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [selectedGkIds, setSelectedGkIds] = useState<Set<string>>(new Set());
  
  // --- ESTADOS DE PRESETS ---
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

  const linePlayersList = useMemo(() => players.filter(p => p.position !== PlayerPosition.GOLEIRO).sort((a,b) => b.initial_ovr - a.initial_ovr), [players]);
  const gkPlayersList = useMemo(() => players.filter(p => p.position === PlayerPosition.GOLEIRO).sort((a,b) => b.initial_ovr - a.initial_ovr), [players]);

  // Carregar presets ao iniciar
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const data = await presetService.getAll();
    setPresets(data);
  };

  // --- Lógica de Presets ---
  const handleLoadPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;

    const preset = presets.find(p => p.id === presetId);
    if (preset) {
        const newLineSet = new Set<string>();
        const newGkSet = new Set<string>();
        
        preset.player_ids.forEach(id => {
            const player = players.find(p => p.id === id);
            if (player) {
                if (player.position === PlayerPosition.GOLEIRO) {
                    if (newGkSet.size < maxGkPlayers) newGkSet.add(id);
                } else {
                    if (newLineSet.size < maxLinePlayers) newLineSet.add(id);
                }
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
      await loadPresets(); // Recarrega lista
      
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
    if (newSet.has(id)) newSet.delete(id);
    else if (newSet.size < maxLinePlayers) newSet.add(id);
    setSelectedLineIds(newSet);
  };

  const toggleGkPlayer = (id: string) => {
    const newSet = new Set(selectedGkIds);
    if (newSet.has(id)) newSet.delete(id);
    else if (newSet.size < maxGkPlayers) newSet.add(id);
    setSelectedGkIds(newSet);
  };

  const toggleAllLine = () => {
    if (selectedLineIds.size > 0) setSelectedLineIds(new Set());
    else setSelectedLineIds(new Set(linePlayersList.slice(0, maxLinePlayers).map(p => p.id)));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setGeneratedTeams(null);
    const pool = players.filter(p => selectedLineIds.has(p.id) || selectedGkIds.has(p.id));

    if (selectedLineIds.size < (config.type === 'Quadrangular' ? 12 : 9)) {
      alert("Número insuficiente de jogadores de linha.");
      setIsGenerating(false);
      return;
    }

    setTimeout(() => {
      const teams = generateTeams(pool, config.type);
      setGeneratedTeams(teams);
      setIsGenerating(false);
      setTimeout(() => document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, 800);
  };

  const handleSaveDraft = async () => {
    if (!generatedTeams) return;
    setIsSaving(true);
    try {
      await matchService.createDraft(generatedTeams, config);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar rascunho.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportImage = async () => {
      if (exportRef.current === null || isExporting) {
          return;
      }
      setIsExporting(true);
      try {
          const dataUrl = await htmlToImage.toPng(exportRef.current, { cacheBust: true, backgroundColor: '#0f172a', style: { padding: '20px' } });
          saveAs(dataUrl, `Sorteio_Pelada_${config.date}.png`);
      } catch (err) {
          console.error('Erro ao exportar imagem:', err);
          alert('Não foi possível gerar a imagem. Tente novamente.');
      } finally {
          setIsExporting(false);
      }
  };

  const getOvrColor = (ovr: number) => {
    if (ovr >= 80) return 'text-green-400';
    if (ovr >= 70) return 'text-yellow-400';
    if (ovr < 60) return 'text-red-400';
    return 'text-slate-300';
  };

  const sortedGKs = useMemo(() => {
      if (!generatedTeams) return [];
      return generatedTeams.flatMap(t => t.players.filter(p => p.position === PlayerPosition.GOLEIRO));
  }, [generatedTeams]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
          <Wand2 className="text-yellow-400" /> Sorteador Oficial
        </h1>
        <p className="text-slate-400">Selecione os presentes e gere os times equilibrados.</p>
      </div>

      {/* BARRA DE PRESETS */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 w-full md:w-auto">
              <Bookmark className="text-blue-400" size={20} />
              <span className="text-white font-bold text-sm hidden md:inline">Grupos Salvos:</span>
              <select 
                  value={selectedPresetId} 
                  onChange={(e) => handleLoadPreset(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:w-64"
              >
                  <option value="">-- Selecione ou monte um --</option>
                  {presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
              {selectedPresetId && (
                  <button onClick={handleDeletePreset} className="p-2 text-red-400 hover:text-red-300 bg-slate-900 rounded border border-slate-700 hover:bg-red-900/20 transition-colors" title="Apagar Grupo">
                      <Trash2 size={16} />
                  </button>
              )}
          </div>
          <button 
              onClick={() => setShowSavePresetModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm font-medium transition-colors border border-slate-600 w-full md:w-auto justify-center"
          >
              <Plus size={16} /> Salvar Seleção Atual
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* --- ESQUERDA: Config + Goleiros --- */}
        <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Calendar size={16} className="text-blue-500" /> Configuração</h3>
                <div className="space-y-3">
                    <select value={config.type} onChange={(e) => setConfig({ ...config, type: e.target.value as TournamentType })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="Quadrangular">Quadrangular (4 times)</option>
                        <option value="Triangular">Triangular (3 times)</option>
                    </select>
                    <input type="date" value={config.date} onChange={(e) => setConfig({ ...config, date: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    <input type="text" placeholder="Local (ex: Arena CP13)" value={config.location} onChange={(e) => setConfig({ ...config, location: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><Shirt size={16} className="text-yellow-500" /> Goleiros</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${selectedGkIds.size === maxGkPlayers ? 'bg-green-900 text-green-400' : 'bg-slate-900 text-slate-400'}`}>{selectedGkIds.size}/{maxGkPlayers}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {gkPlayersList.map(p => {
                        const isSelected = selectedGkIds.has(p.id);
                        return (
                            <div key={p.id} onClick={() => toggleGkPlayer(p.id)} className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-all ${isSelected ? 'bg-slate-700 border-green-500/50' : 'bg-slate-900/50 border-transparent hover:bg-slate-700'}`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected ? 'bg-green-500 border-green-500' : 'border-slate-500'}`}>{isSelected && <CheckSquare size={12} className="text-white"/>}</div>
                                    <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>{p.name}</span>
                                </div>
                                <span className={`text-xs font-bold ${getOvrColor(p.initial_ovr)}`}>{p.initial_ovr}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

        {/* --- CENTRO: Jogadores de Linha --- */}
        <div className="lg:col-span-5">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col h-[580px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users size={20} className="text-blue-400" /> Jogadores de Linha</h3>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full transition-colors ${selectedLineIds.size === maxLinePlayers ? 'bg-green-900 text-green-400' : 'bg-slate-900 text-slate-400'}`}>{selectedLineIds.size} / {maxLinePlayers}</span>
                        <button onClick={toggleAllLine} className="text-xs text-blue-400 hover:text-white underline">Top {maxLinePlayers}</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {linePlayersList.map(p => {
                        const isSelected = selectedLineIds.has(p.id);
                        const isDisabled = !isSelected && selectedLineIds.size >= maxLinePlayers;
                        return (
                            <div key={p.id} onClick={() => !isDisabled && toggleLinePlayer(p.id)} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-slate-700/80 border-blue-500/80 shadow-sm' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800'}`}>
                                <div className="flex items-center gap-3">
                                    {isSelected ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-slate-600" />}
                                    <div>
                                        <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{p.name}</p>
                                        <div className="flex gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                                            <span>{p.position.substring(0, 3)}</span>
                                            {p.playStyle && <span className="text-yellow-600 flex items-center gap-0.5"><Zap size={10}/>{p.playStyle}</span>}
                                        </div>
                                    </div>
                                </div>
                                <span className={`font-bold text-lg ${getOvrColor(p.initial_ovr)}`}>{p.initial_ovr}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
            <button onClick={handleGenerate} disabled={isGenerating || selectedLineIds.size < (config.type === 'Quadrangular' ? 12 : 9) || selectedGkIds.size === 0} className="w-full mt-4 py-3 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95">
                {isGenerating ? <Loader2 className="animate-spin" /> : <><Wand2 size={20} /> Sortear Times</>}
            </button>
        </div>

        {/* --- DIREITA: Resultados e Exportação --- */}
        <div className="lg:col-span-4" id="results-section">
          {generatedTeams ? (
            <div className="space-y-4 animate-slide-up">
              
              {/* Área que será printada */}
              <div ref={exportRef} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="text-center mb-4 md:hidden">
                      <h2 className="text-xl font-bold text-white mb-1">Sorteio do Baba</h2>
                      <p className="text-slate-400 text-sm">{new Date(config.date).toLocaleDateString('pt-BR')} - {config.location}</p>
                  </div>

                  {/* Tabela de Goleiros Separada */}
                  {sortedGKs.length > 0 && (
                      <div className="bg-slate-800/80 border border-yellow-600/30 rounded-lg overflow-hidden mb-6">
                          <div className="bg-yellow-900/20 px-3 py-2 border-b border-yellow-600/30 flex items-center gap-2">
                              <Shirt size={16} className="text-yellow-500" />
                              <h4 className="font-bold text-white text-sm">Goleiros Definidos</h4>
                          </div>
                          <div className="divide-y divide-slate-700/50">
                              {sortedGKs.map(gk => (
                                  <div key={gk.id} className="px-3 py-2 flex justify-between items-center text-sm">
                                      <span className="text-yellow-500 font-bold flex items-center gap-2">
                                          {gk.name} 🧤
                                      </span>
                                      <span className={`font-bold ${getOvrColor(gk.initial_ovr)}`}>{gk.initial_ovr}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Lista de Times (Apenas Linha) */}
                  <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><Trophy className="text-blue-400" size={18} /> Times (Linha)</h3>
                      <span className="text-slate-400 text-xs bg-slate-800 px-2 py-1 rounded">Média OVR: {Math.round(generatedTeams.reduce((a, b) => a + b.avgOvr, 0) / generatedTeams.length)}</span>
                  </div>
                  <div className="space-y-4">
                    {generatedTeams.map((team) => (
                      <div key={team.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-sm">
                        <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                          <h4 className="font-bold text-white">{team.name}</h4>
                          <span className="text-sm font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded">{team.avgOvr}</span>
                        </div>
                        <div className="divide-y divide-slate-700/50">
                          {/* FILTRO: Mostra apenas jogadores que NÃO são goleiros */}
                          {team.players.filter(p => p.position !== PlayerPosition.GOLEIRO).map((player, idx) => (
                            <div key={player.id} className="px-4 py-2 flex justify-between items-center text-sm hover:bg-slate-700/30 transition-colors">
                               <div className="flex items-center gap-3">
                                   <span className="text-slate-500 text-xs font-mono w-4">{idx + 1}.</span>
                                   <span className="text-slate-200 font-medium">{player.name}</span>
                               </div>
                               <span className={`font-bold ${getOvrColor(player.initial_ovr)}`}>{player.initial_ovr}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
              
              {/* Botões de Ação */}
              <div className="flex gap-3 pt-2">
                  <button onClick={handleExportImage} disabled={isExporting} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                      {isExporting ? <Loader2 className="animate-spin" /> : <><ImageIcon size={18} /> Baixar Imagem</>}
                  </button>
                  <button onClick={handleSaveDraft} disabled={isSaving} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                      {isSaving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Salvar Rascunho</>}
                  </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/50 p-8">
                <Wand2 size={48} className="mb-4 text-slate-700" />
                <p className="font-medium">Aguardando sorteio</p>
                <p className="text-sm mt-2 text-center">Selecione os jogadores e clique em "Sortear Times" para ver o resultado aqui.</p>
            </div>
          )}
        </div>

      </div>

      {/* Modal Salvar Preset */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold text-white mb-4">Salvar Grupo</h3>
                <input 
                    type="text" 
                    placeholder="Nome do grupo (ex: Baba de Terça)" 
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-white mb-4 outline-none focus:ring-2 focus:ring-green-500"
                />
                <div className="flex gap-3">
                    <button onClick={() => setShowSavePresetModal(false)} className="flex-1 py-2 bg-slate-700 text-white rounded font-medium">Cancelar</button>
                    <button onClick={handleSavePreset} disabled={!newPresetName.trim() || isSavingPreset} className="flex-1 py-2 bg-green-600 text-white rounded font-bold disabled:opacity-50">Salvar</button>
                </div>
            </div>
        </div>
      )}

      {/* Modal de Sucesso */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 border border-green-500/50 rounded-xl p-8 text-center shadow-2xl max-w-sm w-full animate-scale-up">
                <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                    <CheckCircle size={32} className="text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Sorteio Salvo!</h3>
                <p className="text-slate-400 mb-6">O rascunho foi criado com sucesso. Acesse a aba <strong className="text-white">"Eventos"</strong> para iniciar os jogos.</p>
                <button onClick={() => { setIsSuccessModalOpen(false); onDraftSaved(); }} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors shadow-lg active:scale-95">
                    Ir para Meus Eventos
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default TeamSorter;