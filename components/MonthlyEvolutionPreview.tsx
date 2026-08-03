import React from 'react';
import { PlayerUpdateSimulation } from '../services/playerService';
import { ArrowRight, TrendingUp, TrendingDown, Minus, X, CheckCircle, Loader2 } from 'lucide-react';

interface MonthlyEvolutionPreviewProps {
  simulation: PlayerUpdateSimulation[];
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const MonthlyEvolutionPreview: React.FC<MonthlyEvolutionPreviewProps> = ({ simulation, onConfirm, onCancel, isSaving }) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-yellow-400" />
              Prévia da Virada de Mês
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Revise as alterações de OVR antes de aplicar.
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Lista / Mensagem */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col justify-center items-center">
          {simulation.length === 0 ? (
            <div className="text-center py-6 px-4 flex flex-col items-center animate-fade-in">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/30 mb-4 ring-4 ring-green-500/5">
                <CheckCircle size={36} className="text-green-400" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">
                Virada de Mês Já Concluída!
              </h4>
              <p className="text-slate-300 text-sm max-w-md leading-relaxed">
                Os 4 campeões da temporada (<span className="text-yellow-400 font-bold">MVP, Artilheiro, Garçom e Muralha</span>) foram salvos com sucesso no <span className="text-cyan-400 font-bold">Hall da Fama</span>.
              </p>
              <p className="text-xs text-slate-400 mt-3 bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                🔒 O OVR dos jogadores foi preservado e está protegido contra alterações duplicadas.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-2">
              {simulation.map((sim) => (
                <div key={sim.player.id} className="flex items-center justify-between bg-slate-700/30 p-3 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${sim.delta > 0 ? 'bg-green-600' : sim.delta < 0 ? 'bg-red-600' : 'bg-slate-600'}`}>
                      {sim.delta > 0 ? <TrendingUp size={14} /> : sim.delta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{sim.player.name}</p>
                      <p className="text-xs text-slate-500">{sim.player.position}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-slate-500 font-bold">ATUAL</span>
                      <span className="text-lg font-bold text-slate-300">{sim.oldOvr}</span>
                    </div>
                    <ArrowRight size={16} className="text-slate-600" />
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-yellow-500 font-bold">NOVO</span>
                      <span className={`text-lg font-bold ${sim.delta > 0 ? 'text-green-400' : sim.delta < 0 ? 'text-red-400' : 'text-white'}`}>
                        {sim.newOvr}
                      </span>
                    </div>
                    <div className={`w-12 text-center text-sm font-bold py-1 rounded ${sim.delta > 0 ? 'bg-green-500/10 text-green-400' : sim.delta < 0 ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'}`}>
                      {sim.delta > 0 ? `+${sim.delta}` : sim.delta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 rounded-b-xl flex gap-3">
          {simulation.length === 0 ? (
            <button 
              onClick={onCancel}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              Entendido / Fechar
            </button>
          ) : (
            <>
              <button 
                onClick={onCancel}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={onConfirm}
                disabled={isSaving}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />}
                Confirmar e Aplicar
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default MonthlyEvolutionPreview;