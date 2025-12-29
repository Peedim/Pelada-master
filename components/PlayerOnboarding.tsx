import React, { useState, useRef } from 'react'; // 1. Adicionado useRef
import { Player, PlayerFormData } from '../types';
import { playerService } from '../services/playerService';
import { generateAttributesFromOvr } from '../utils/attributeGenerator';
import { Shield, Target, Activity, Award, Anchor, Footprints, ArrowUp } from 'lucide-react';

interface PlayerOnboardingProps {
  player: Player;
  onComplete: () => void;
}

const POSITIONS = [
  { id: 'Goleiro', label: 'Goleiro', icon: Anchor, desc: 'O guardião da meta.' },
  { id: 'Defensor', label: 'Defensor', icon: Shield, desc: 'Zaga, Lateral ou Volante.' },
  { id: 'Meio', label: 'Meio-Campo', icon: Activity, desc: 'Armação e controle de jogo.' },
  { id: 'Atacante', label: 'Atacante', icon: Target, desc: 'Fazer golos é sua missão.' },
];

const PLAY_STYLES = [
  { id: 'Artilheiro', label: 'Artilheiro', desc: 'Faro de gol apurado.' },
  { id: 'Garçom', label: 'Garçom', desc: 'Mestre das assistências.' },
  { id: 'Motorzinho', label: 'Motorzinho', desc: 'Corre o campo todo sem cansar.' },
  { id: 'Maestro', label: 'Maestro', desc: 'Visão de jogo privilegiada.' },
  { id: 'Liso', label: 'Liso', desc: 'Drible rápido e habilidade.' },
  { id: 'Xerife', label: 'Xerife', desc: 'Liderança e força física.' },
  { id: 'Coringa', label: 'Coringa', desc: 'Pau pra toda obra.' },
  { id: 'Paredão', label: 'Paredão', desc: 'Defesa sólida, bloqueia tudo.' },
  { id: 'Muralha', label: 'Muralha', desc: 'Goleiro clássico. Não sai da área.' },
  { id: 'Goleiro Linha', label: 'Goleiro Linha', desc: 'Joga com os pés e arma o jogo.' },
];

const PlayerOnboarding: React.FC<PlayerOnboardingProps> = ({ player, onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [position, setPosition] = useState<string>('');
  const [playStyle, setPlayStyle] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // 2. Criamos a referência para o botão de confirmar
  const confirmButtonRef = useRef<HTMLDivElement>(null);

  // 3. Função inteligente para selecionar e rolar
  const handleSelectStyle = (styleId: string) => {
    setPlayStyle(styleId);
    
    // Pequeno delay para garantir que o React renderize o estado selecionado
    setTimeout(() => {
        if (confirmButtonRef.current) {
            confirmButtonRef.current.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'end' // Rola até o final do bloco aparecer
            });
        }
    }, 100);
  };

  const handleSave = async () => {
    if (!position || !playStyle) return;
    setLoading(true);
    try {
      let finalAttributes = {
          pace: player.attributes.pace,
          shooting: player.attributes.shooting,
          passing: player.attributes.passing,
          defending: player.attributes.defending
      };

      const totalAttr = (player.attributes.pace || 0) + (player.attributes.shooting || 0);
      
      if (totalAttr === 0 || !player.attributes.pace) {
          finalAttributes = generateAttributesFromOvr(player.initial_ovr, position);
      }

      const updateData: PlayerFormData = {
        name: player.name,
        email: player.email,
        initial_ovr: player.initial_ovr,
        shirt_number: player.shirt_number,
        is_admin: player.is_admin,
        photo_url: player.photo_url || '',
        position: position,
        playStyle: playStyle,
        pace: finalAttributes.pace,
        shooting: finalAttributes.shooting,
        passing: finalAttributes.passing,
        defending: finalAttributes.defending,
      };

      await playerService.update(player.id, updateData);
      onComplete(); 
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-4">
      {/* Mudei max-h-[90vh] para max-h-[90dvh] para corrigir altura em mobile navegadores */}
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[90dvh]">
        <div className="p-6 bg-slate-900/50 border-b border-slate-700 text-center">
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">Identidade do Jogador</h1>
          <p className="text-sm text-slate-400">Olá, <span className="text-emerald-400 font-bold">{player.name}</span>! Vamos finalizar o cadastro.</p>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {step === 1 ? (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Footprints className="text-emerald-500" /> Qual sua posição principal?</h2>
              <div className="grid grid-cols-2 gap-3">
                {POSITIONS.map((pos) => {
                  const Icon = pos.icon;
                  const isSelected = position === pos.id;
                  return (
                    <button key={pos.id} onClick={() => setPosition(pos.id)} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center gap-2 group ${isSelected ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-700/30 border-slate-700 hover:border-slate-500 hover:bg-slate-700'}`}>
                      <Icon size={32} className={`transition-colors ${isSelected ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`} />
                      <div><span className={`block font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{pos.label}</span><span className="text-[10px] text-slate-500 leading-tight block mt-1">{pos.desc}</span></div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-slide-in">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Award className="text-yellow-500" /> Qual seu estilo de jogo?</h2>
              <div className="grid grid-cols-2 gap-2">
                {PLAY_STYLES.map((style) => (
                    // 4. Usamos a nova função handleSelectStyle aqui
                    <button key={style.id} onClick={() => handleSelectStyle(style.id)} className={`p-3 rounded-lg border text-left transition-all ${playStyle === style.id ? 'bg-yellow-500/10 border-yellow-500 text-white' : 'bg-slate-700/30 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                      <span className="block font-bold text-sm">{style.label}</span><span className="text-[10px] text-slate-500">{style.desc}</span>
                    </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. Adicionei a ref neste container do rodapé */}
        <div ref={confirmButtonRef} className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center transition-all">
            {step === 2 ? (<button onClick={() => setStep(1)} className="text-slate-400 hover:text-white text-sm font-bold px-4 py-2">Voltar</button>) : (<div />)}
            {step === 1 ? (
                <button disabled={!position} onClick={() => setStep(2)} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-2 px-6 rounded-lg transition-all flex items-center gap-2">Próximo <ArrowUp size={16} className="rotate-90" /></button>
            ) : (
                <button disabled={!playStyle || loading} onClick={handleSave} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-2 px-8 rounded-lg shadow-lg shadow-emerald-500/20 transition-all">{loading ? 'Salvando...' : 'Finalizar'}</button>
            )}
        </div>
      </div>
    </div>
  );
};
export default PlayerOnboarding;