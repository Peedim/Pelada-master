import React, { useState, useMemo } from 'react';
import { Player, PlayerPosition } from '../types';
import { X, Search, Sliders, CheckCircle, ArrowRight, TrendingUp, TrendingDown, Minus, Loader2, RotateCcw } from 'lucide-react';
import { playerService } from '../services/playerService';
import { toast } from 'sonner';

interface ManualOvrModalProps {
  players: Player[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ManualOvrModal: React.FC<ManualOvrModalProps> = ({ players, isOpen, onClose, onSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [ovrChanges, setOvrChanges] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Inicializa mapa de OVRs
  const currentOvrs = useMemo(() => {
    const map: Record<string, number> = {};
    players.forEach(p => {
      map[p.id] = p.initial_ovr;
    });
    return map;
  }, [players]);

  if (!isOpen) return null;

  const handleOvrChange = (playerId: string, newValue: number) => {
    const bounded = Math.max(1, Math.min(99, newValue));
    setOvrChanges(prev => {
      const orig = currentOvrs[playerId];
      if (bounded === orig) {
        const next = { ...prev };
        delete next[playerId];
        return next;
      }
      return { ...prev, [playerId]: bounded };
    });
  };

  const handleDeltaStep = (playerId: string, step: number) => {
    const current = ovrChanges[playerId] ?? currentOvrs[playerId] ?? 60;
    handleOvrChange(playerId, current + step);
  };

  const handleReset = () => {
    setOvrChanges({});
  };

  const changedCount = Object.keys(ovrChanges).length;

  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'all' || p.position === positionFilter;
    return matchesSearch && matchesPosition;
  }).sort((a, b) => {
    // Coloca quem foi alterado no topo ou por OVR decrescente
    const hasChangeA = ovrChanges[a.id] !== undefined;
    const hasChangeB = ovrChanges[b.id] !== undefined;
    if (hasChangeA && !hasChangeB) return -1;
    if (!hasChangeA && hasChangeB) return 1;
    const ovrA = ovrChanges[a.id] ?? a.initial_ovr;
    const ovrB = ovrChanges[b.id] ?? b.initial_ovr;
    return ovrB - ovrA;
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 1).join('').toUpperCase();
  };

  const handleSave = async () => {
    if (changedCount === 0) return;
    setIsSaving(true);
    try {
      const updates = Object.entries(ovrChanges).map(([playerId, newOvr]) => ({
        playerId,
        newOvr
      }));

      await playerService.updatePlayersOvr(updates);
      toast.success(`${changedCount} jogador(es) com OVR atualizado com sucesso!`);
      setOvrChanges({});
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar novos OVRs: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-yellow-400">
              <Sliders size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Atualização Manual de OVR
              </h3>
              <p className="text-xs text-slate-400">
                Ajuste manualmente as notas dos jogadores sem afetar rankings ou virada.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters & Search */}
        <div className="p-4 border-b border-slate-700/60 bg-slate-850 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar jogador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            {changedCount > 0 && (
              <button 
                onClick={handleReset}
                className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Desfazer todas as edições não salvas"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Desfazer ({changedCount})</span>
              </button>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
            {['all', PlayerPosition.GOLEIRO, PlayerPosition.DEFENSOR, PlayerPosition.MEIO_CAMPO, PlayerPosition.ATACANTE].map(pos => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
                  positionFilter === pos
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white'
                }`}
              >
                {pos === 'all' ? 'Todos' : pos}
              </button>
            ))}
          </div>
        </div>

        {/* Players List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Nenhum jogador encontrado.
            </div>
          ) : (
            filteredPlayers.map(player => {
              const originalOvr = currentOvrs[player.id];
              const effectiveOvr = ovrChanges[player.id] ?? originalOvr;
              const delta = effectiveOvr - originalOvr;
              const hasChanged = delta !== 0;

              return (
                <div 
                  key={player.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    hasChanged
                      ? 'bg-slate-700/40 border-yellow-500/40 shadow-sm'
                      : 'bg-slate-900/40 border-slate-700/60'
                  }`}
                >
                  {/* Informações do Jogador */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-sm text-white border border-slate-600">
                      {player.photo_url ? (
                        <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(player.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white truncate">{player.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {player.position} {player.playStyle && `• ${player.playStyle}`}
                      </p>
                    </div>
                  </div>

                  {/* Controles de OVR */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Badge de Variação */}
                    <div className="w-12 text-center">
                      {hasChanged ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${
                          delta > 0
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">
                          {originalOvr}
                        </span>
                      )}
                    </div>

                    {/* Botão Diminuir */}
                    <button
                      type="button"
                      onClick={() => handleDeltaStep(player.id, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center transition-colors active:scale-95"
                      title="Diminuir OVR"
                    >
                      <Minus size={14} />
                    </button>

                    {/* Input do Novo OVR */}
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={effectiveOvr}
                      onChange={(e) => handleOvrChange(player.id, parseInt(e.target.value) || 0)}
                      className={`w-14 text-center py-1.5 rounded-lg font-black text-base border focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                        hasChanged
                          ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'
                          : 'bg-slate-800 border-slate-700 text-white'
                      }`}
                    />

                    {/* Botão Aumentar */}
                    <button
                      type="button"
                      onClick={() => handleDeltaStep(player.id, 1)}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center transition-colors active:scale-95"
                      title="Aumentar OVR"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/80 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {changedCount > 0 ? (
              <span className="text-yellow-400 font-bold">
                {changedCount} alteração(ões) pendente(s)
              </span>
            ) : (
              <span>Nenhuma alteração pendente</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={changedCount === 0 || isSaving}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-lg shadow-cyan-900/20 flex items-center gap-2 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Salvar Alterações
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManualOvrModal;
