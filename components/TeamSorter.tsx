
import React, { useState } from 'react';
import { Player, Team } from '../types';
import { generateTeams, TournamentType } from '../utils/teamBalancer';
import { matchService } from '../services/matchService';
import { Calendar, Users, CheckSquare, Square, Wand2, Trophy, Zap, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface TeamSorterProps {
  players: Player[];
  onDraftSaved: () => void;
}

const TeamSorter: React.FC<TeamSorterProps> = ({ players, onDraftSaved }) => {
  // Configuration State
  const [config, setConfig] = useState({
    type: 'Quadrangular' as TournamentType,
    date: new Date().toISOString().split('T')[0],
    location: ''
  });

  // Calculate limits based on type
  const maxPlayers = config.type === 'Quadrangular' ? 28 : 21;

  // Selection State
  // Initialize with empty set or top maxPlayers
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  
  // Process State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTeams, setGeneratedTeams] = useState<Team[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const togglePlayer = (id: string) => {
    const newSet = new Set(selectedPlayerIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      if (newSet.size >= maxPlayers) {
        // Limit reached, do not add
        return;
      }
      newSet.add(id);
    }
    setSelectedPlayerIds(newSet);
  };

  const toggleAll = () => {
    if (selectedPlayerIds.size > 0) {
      // If any selected, clear all
      setSelectedPlayerIds(new Set());
    } else {
      // Select top players by OVR up to maxPlayers
      const sortedPlayers = [...players].sort((a, b) => b.initial_ovr - a.initial_ovr);
      const topPlayers = sortedPlayers.slice(0, maxPlayers);
      setSelectedPlayerIds(new Set(topPlayers.map(p => p.id)));
    }
  };

  const handleTypeChange = (newType: TournamentType) => {
    const newMax = newType === 'Quadrangular' ? 28 : 21;
    
    // If switching reduces capacity and we have too many selected, trim the lowest OVRs
    if (selectedPlayerIds.size > newMax) {
       const currentSelected = players.filter(p => selectedPlayerIds.has(p.id));
       // Keep top OVRs
       const keptPlayers = currentSelected
         .sort((a, b) => b.initial_ovr - a.initial_ovr)
         .slice(0, newMax);
       
       setSelectedPlayerIds(new Set(keptPlayers.map(p => p.id)));
    }

    setConfig({ ...config, type: newType });
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setGeneratedTeams(null);

    // Filter available players
    const pool = players.filter(p => selectedPlayerIds.has(p.id));

    if (pool.length < (config.type === 'Quadrangular' ? 4 : 3)) {
      alert("Número insuficiente de jogadores selecionados para este formato.");
      setIsGenerating(false);
      return;
    }

    // Simulate processing time for UX
    setTimeout(() => {
      const teams = generateTeams(pool, config.type);
      setGeneratedTeams(teams);
      setIsGenerating(false);
      
      // Smooth scroll to results
      const resultsElement = document.getElementById('results-section');
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth' });
      }
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

  const getOvrColor = (ovr: number) => {
    if (ovr >= 80) return 'text-green-400';
    if (ovr >= 70) return 'text-yellow-400';
    if (ovr < 60) return 'text-red-400';
    return 'text-slate-300';
  };

  const isLimitReached = selectedPlayerIds.size >= maxPlayers;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-20">
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
          <Wand2 className="text-yellow-400" />
          Sorteador v2.0
        </h1>
        <p className="text-slate-400">Balanceamento por OVR e Estilo de Jogo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Configuration */}
        <div className="space-y-6">
          
          {/* Config Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-green-500" />
              Configurar Evento
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tipo de Torneio</label>
                <select 
                  value={config.type}
                  onChange={(e) => handleTypeChange(e.target.value as TournamentType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-1 focus:ring-green-500 outline-none"
                >
                  <option value="Quadrangular">Quadrangular (4 times)</option>
                  <option value="Triangular">Triangular (3 times)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                    Limite: <span className="text-white font-bold">{maxPlayers} jogadores</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Data</label>
                  <input 
                    type="date"
                    value={config.date}
                    onChange={(e) => setConfig({ ...config, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-1 focus:ring-green-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Local</label>
                  <input 
                    type="text"
                    placeholder="Campo..."
                    value={config.location}
                    onChange={(e) => setConfig({ ...config, location: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-1 focus:ring-green-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Player Selection Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users size={18} className="text-blue-400" />
                Jogadores
              </h3>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isLimitReached ? 'bg-red-900/50 text-red-200' : 'bg-slate-900 text-slate-400'}`}>
                  {selectedPlayerIds.size} / {maxPlayers}
                </span>
                <button 
                  onClick={toggleAll}
                  className="text-xs font-medium text-green-500 hover:text-green-400 transition-colors"
                >
                  {selectedPlayerIds.size > 0 ? 'Limpar' : `Top ${maxPlayers}`}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {players.length === 0 ? (
                 <div className="text-center text-slate-500 py-10">Nenhum jogador cadastrado.</div>
              ) : (
                players.map(player => {
                  const isSelected = selectedPlayerIds.has(player.id);
                  const isDisabled = !isSelected && isLimitReached;

                  return (
                    <div 
                      key={player.id} 
                      onClick={() => !isDisabled && togglePlayer(player.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isDisabled ? 'opacity-40 cursor-not-allowed bg-slate-900/20 border-transparent' : 'cursor-pointer'
                      } ${
                        isSelected 
                          ? 'bg-slate-700/50 border-green-900/50' 
                          : !isDisabled ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-slate-400 ${isSelected ? 'text-green-500' : ''}`}>
                          {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                            {player.name}
                          </p>
                          <div className="flex gap-2 text-xs text-slate-500">
                             <span>{player.position}</span>
                             {player.playStyle && <span className="text-yellow-600 flex items-center gap-0.5"><Zap size={8}/>{player.playStyle}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`font-bold text-lg ${getOvrColor(player.initial_ovr)}`}>
                        {player.initial_ovr}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            
            {isLimitReached && (
                <div className="mt-2 text-xs text-red-400 flex items-center gap-1 justify-center animate-pulse">
                    <AlertCircle size={12} /> Limite de {maxPlayers} jogadores atingido
                </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedPlayerIds.size < 3}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
              ${isGenerating 
                ? 'bg-slate-700 cursor-wait' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/30'
              }`}
          >
            {isGenerating ? (
              <>Sorteando...</>
            ) : (
              <>
                <Wand2 size={20} />
                Sortear Times
              </>
            )}
          </button>

        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-2" id="results-section">
          {generatedTeams ? (
            <div className="space-y-4 animate-slide-up">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="text-yellow-400" />
                  Times Formados
                </h3>
                <span className="text-slate-400 text-sm">
                  OVR Médio Global: {Math.round(generatedTeams.reduce((a, b) => a + b.avgOvr, 0) / generatedTeams.length)}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                {generatedTeams.map((team) => (
                  <div key={team.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
                    {/* Team Header */}
                    <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg text-white">{team.name}</h4>
                        <span className="text-xs text-slate-500">{team.players.length} jogadores</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-2xl font-bold text-white">{team.avgOvr}</span>
                        <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">MÉDIA</span>
                      </div>
                    </div>

                    {/* Player List */}
                    <div className="divide-y divide-slate-700/50">
                      {team.players.map((player) => (
                        <div key={player.id} className="p-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {player.position.substring(0, 3).toUpperCase()}
                             </div>
                             <div className="min-w-0">
                               <p className="text-sm font-medium text-slate-200 truncate">{player.name}</p>
                               {player.playStyle && (
                                <span className="text-[10px] text-yellow-500/80 flex items-center gap-0.5">
                                  <Zap size={8} />
                                  {player.playStyle}
                                </span>
                               )}
                             </div>
                           </div>
                           <div className={`font-bold text-sm ${getOvrColor(player.initial_ovr)}`}>
                             {player.initial_ovr}
                           </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Footer Stats */}
                    <div className="bg-slate-900/30 p-2 text-center text-xs text-slate-500 border-t border-slate-700">
                       Força Total: {team.totalOvr}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Button: Save Draft */}
              <div className="pt-4 flex justify-end">
                <button
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-md font-bold text-lg shadow-lg shadow-green-900/30 transition-all active:scale-95"
                >
                    {isSaving ? 'Salvando...' : (
                        <>
                            <Save size={20} />
                            Salvar Sorteio
                        </>
                    )}
                </button>
              </div>

            </div>
          ) : (
            <div className="h-full bg-slate-800/50 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 p-10 min-h-[400px]">
              {isGenerating ? (
                 <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="animate-pulse">Balanceando habilidades e estilos...</p>
                 </div>
              ) : (
                <>
                  <Wand2 size={48} className="mb-4 opacity-20" />
                  <p>Configure o evento e selecione os jogadores para gerar os times.</p>
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center border border-green-700/50">
                        <CheckCircle size={32} className="text-green-500" />
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-bold text-white">Sucesso!</h3>
                        <p className="text-slate-400 text-sm mt-2">
                            O sorteio foi salvo na sua lista de rascunhos.
                        </p>
                    </div>

                    <button 
                        onClick={() => {
                            setIsSuccessModalOpen(false);
                            onDraftSaved();
                        }}
                        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95"
                    >
                        Ir para Rascunhos
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TeamSorter;
