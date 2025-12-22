import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Player, PlayerFormData, PlayerPosition, PlayStyle } from '../types';
import { User, Activity, CheckCircle, Shield, ArrowLeft, Zap, Lock, Unlock } from 'lucide-react'; // Adicionei Lock e Unlock
import { supabase } from '../services/supabaseClient';
import { calculateWeightedOvr } from '../services/playerService';

interface PlayerFormProps {
  initialData?: Player;
  onSubmit: (data: PlayerFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const PlayerForm: React.FC<PlayerFormProps> = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'attributes'>('basic');
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const masterEmail = import.meta.env.VITE_MASTER_EMAIL;
      if (user && user.email === masterEmail) setIsMasterAdmin(true);
    };
    checkUserRole();
  }, []);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<PlayerFormData>({
    defaultValues: initialData ? {
      ...initialData,
      ...initialData.attributes,
      photo_url: initialData.photo_url || ''
    } : {
      name: '', email: '', 
      position: '' as PlayerPosition, 
      playStyle: '' as PlayStyle,
      initial_ovr: 75, // Valor padrão inicial
      photo_url: '', is_admin: false,
      pace: 0, shooting: 0, passing: 0, defending: 0 // Começam zerados para permitir edição manual do OVR
    }
  });

  const [pace, shooting, passing, defending, position, initial_ovr] = watch([
    'pace', 'shooting', 'passing', 'defending', 'position', 'initial_ovr'
  ]);
  
  // Verifica se os atributos foram tocados (soma maior que 0)
  const hasAttributes = useMemo(() => {
    return (Number(pace) || 0) + (Number(shooting) || 0) + (Number(passing) || 0) + (Number(defending) || 0) > 0;
  }, [pace, shooting, passing, defending]);

  // Cálculo de OVR Automático (Só roda se tiver atributos)
  const calculatedOvr = useMemo(() => {
    const p = Number(pace) || 0;
    const s = Number(shooting) || 0;
    const pa = Number(passing) || 0;
    const d = Number(defending) || 0;
    const posForCalc = position || 'Meio'; 
    return Math.round(calculateWeightedOvr(posForCalc, { pace: p, shooting: s, passing: pa, defending: d }));
  }, [pace, shooting, passing, defending, position]);

  // Efeito Inteligente:
  // Se tiver atributos, o OVR obedece o cálculo.
  // Se NÃO tiver atributos (tudo 0), o OVR fica livre para edição manual (não faz nada aqui).
  useEffect(() => {
    if (hasAttributes) {
      setValue('initial_ovr', calculatedOvr);
    }
  }, [calculatedOvr, hasAttributes, setValue]);

  const applyPreset = (preset: 'GK' | 'DEF' | 'MID' | 'ATT' | 'BAL') => {
    const presets = {
      GK: { pace: 45, shooting: 20, passing: 50, defending: 85 },
      DEF: { pace: 65, shooting: 40, passing: 60, defending: 88 },
      MID: { pace: 75, shooting: 70, passing: 88, defending: 65 },
      ATT: { pace: 88, shooting: 85, passing: 70, defending: 35 },
      BAL: { pace: 70, shooting: 70, passing: 70, defending: 70 },
    };
    const v = presets[preset];
    setValue('pace', v.pace);
    setValue('shooting', v.shooting);
    setValue('passing', v.passing);
    setValue('defending', v.defending);
  };

  const getAttributeColor = (value: number) => {
    if (value < 60) return 'text-red-500';
    if (value < 75) return 'text-yellow-500';
    if (value < 85) return 'text-green-500';
    return 'text-blue-500';
  };

  const onFormSubmit = (data: PlayerFormData) => {
      const finalData = {
          ...data,
          position: data.position || "",
          playStyle: data.playStyle || "",
          pace: data.pace || 0,
          shooting: data.shooting || 0,
          passing: data.passing || 0,
          defending: data.defending || 0
      };
      onSubmit(finalData);
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><ArrowLeft size={24} /></button>
          <div><h2 className="text-2xl font-bold text-white flex items-center gap-2">{initialData ? 'Editar Jogador' : 'Convidar Novo Jogador'}</h2><p className="text-slate-400 text-sm">{initialData ? 'Atualize os dados do jogador.' : 'Adicione um novo jogador ao sistema.'}</p></div>
        </div>
        
        {/* Mostrador de OVR no Topo */}
        <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 flex flex-col items-center">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-1">OVR FINAL</span>
            <div className={`text-3xl font-black ${getAttributeColor(initial_ovr || 0)}`}>{initial_ovr}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 bg-slate-800 p-1 rounded-lg"><button type="button" onClick={() => setActiveTab('basic')} className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'basic' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}><div className="flex items-center justify-center gap-2"><User size={16} /> Dados Básicos</div></button><button type="button" onClick={() => setActiveTab('attributes')} className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'attributes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}><div className="flex items-center justify-center gap-2"><Activity size={16} /> Atributos</div></button></div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-xl">
          <div className={activeTab === 'basic' ? 'block' : 'hidden'}>
            <div className="space-y-5">
              
              {/* --- NOVO CAMPO DE OVR MANUAL --- */}
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <label className="block text-sm font-bold text-white">
                        Definição de OVR Inicial
                    </label>
                    {hasAttributes ? (
                        <span className="flex items-center gap-1 text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded uppercase font-bold">
                            <Lock size={10} /> Automático
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold border border-emerald-500/30">
                            <Unlock size={10} /> Manual
                        </span>
                    )}
                  </div>
                  
                  <div className="flex gap-4 items-center">
                      <Controller 
                          name="initial_ovr" 
                          control={control} 
                          render={({ field }) => (
                              <input 
                                  {...field} 
                                  type="number" 
                                  min="1" 
                                  max="99" 
                                  disabled={hasAttributes} // Desabilita se tiver atributos > 0
                                  className={`w-24 text-center text-2xl font-black bg-slate-800 border-2 rounded-lg p-2 focus:outline-none transition-all ${
                                      hasAttributes 
                                          ? 'border-slate-700 text-slate-500 cursor-not-allowed' 
                                          : 'border-emerald-500 text-white focus:ring-4 focus:ring-emerald-500/20'
                                  }`}
                              />
                          )} 
                      />
                      <div className="text-xs text-slate-400 flex-1">
                          {hasAttributes 
                              ? "O OVR está sendo calculado automaticamente com base na aba 'Atributos'." 
                              : "Defina o OVR base manualmente. Os atributos serão gerados automaticamente quando o jogador completar o cadastro (Onboarding)."
                          }
                      </div>
                  </div>
              </div>
              {/* ---------------------------------- */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Email *</label><Controller name="email" control={control} rules={{ required: 'Email é obrigatório', pattern: { value: /^\S+@\S+$/i, message: "Email inválido" } }} render={({ field }) => (<input {...field} type="email" placeholder="jogador@exemplo.com" className={`w-full bg-slate-900 border ${errors.email ? 'border-red-500' : 'border-slate-700'} rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`} />)} />{errors.email && <span className="text-red-500 text-xs mt-1">{errors.email.message}</span>}</div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Nome Completo *</label><Controller name="name" control={control} rules={{ required: 'Nome é obrigatório' }} render={({ field }) => (<input {...field} placeholder="Nome do jogador" className={`w-full bg-slate-900 border ${errors.name ? 'border-red-500' : 'border-slate-700'} rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`} />)} />{errors.name && <span className="text-red-500 text-xs mt-1">{errors.name.message}</span>}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Posição Preferida</label>
                    <Controller name="position" control={control} render={({ field }) => (<select {...field} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"><option value="">-- Definir pelo Jogador (Onboarding) --</option>{Object.values(PlayerPosition).map(pos => (<option key={pos} value={pos}>{pos}</option>))}</select>)} />
                    <p className="text-[10px] text-slate-500 mt-1">*Deixe vazio para que o jogador escolha ao entrar.</p>
                </div>
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1"><Zap size={14} className="text-yellow-400" /> Estilo de Jogo</label>
                    <Controller name="playStyle" control={control} render={({ field }) => (<select {...field} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"><option value="">-- Definir pelo Jogador (Onboarding) --</option>{Object.values(PlayStyle).map(style => (<option key={style} value={style}>{style}</option>))}</select>)} />
                </div>
              </div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1">URL da Foto (opcional)</label><Controller name="photo_url" control={control} render={({ field }) => (<input {...field} placeholder="https://exemplo.com/foto.jpg" className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" />)} /></div>
              {isMasterAdmin && (<div className="bg-slate-900/50 p-4 rounded-md border border-purple-500/30 flex items-start gap-3"><Controller name="is_admin" control={control} render={({ field: { value, onChange, ...rest } }) => (<div className="flex items-center h-6"><input id="is_admin" type="checkbox" checked={value} onChange={onChange} {...rest} className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-900" /></div>)} /><div><label htmlFor="is_admin" className="text-sm font-bold text-white flex items-center gap-2"><Shield size={14} className="text-purple-400" /> Dar permissões de Administrador</label><p className="text-xs text-slate-400 mt-1">(Visível apenas para o Master) Permite que este jogador gerencie eventos.</p></div></div>)}
            </div>
          </div>

          <div className={activeTab === 'attributes' ? 'block' : 'hidden'}>
            <div className="mb-6 bg-blue-900/20 p-3 rounded border border-blue-500/30">
                <p className="text-xs text-blue-200 flex items-center gap-2">
                    <Activity size={14} /> 
                    Ao mover os controles abaixo, o OVR manual será ignorado e recalculado automaticamente.
                </p>
            </div>
            <div className="mb-6"><label className="block text-sm font-medium text-slate-300 mb-3">Presets Rápidos</label><div className="flex flex-wrap gap-2">{['GK', 'DEF', 'MID', 'ATT', 'BAL'].map(p => (<button key={p} type="button" onClick={() => applyPreset(p as any)} className="flex-1 min-w-[80px] text-xs font-medium py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors border border-slate-600">{p}</button>))}</div></div>
            <div className="space-y-6">{[{ name: 'pace', label: 'Ritmo (Frequência)' }, { name: 'shooting', label: 'Finalização (Gols)' }, { name: 'passing', label: 'Passe (Assistências)' }, { name: 'defending', label: 'Defesa (Clean Sheet)' }].map((attr) => (<div key={attr.name}><div className="flex justify-between mb-2"><label className="text-sm font-medium text-white">{attr.label}</label><span className={`text-sm font-bold ${getAttributeColor(watch(attr.name as any))}`}>{watch(attr.name as any)}</span></div><Controller name={attr.name as any} control={control} render={({ field }) => (<input type="range" min="0" max="99" {...field} className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400" onChange={(e) => field.onChange(parseInt(e.target.value))} />)} /></div>))}</div>
          </div>
        </div>

        <div className="flex justify-end pt-4 gap-3"><button type="button" onClick={onCancel} className="px-4 py-2 bg-transparent text-slate-300 hover:text-white transition-colors text-sm font-medium">Cancelar</button><button type="submit" disabled={isLoading} className={`flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-md shadow-lg shadow-green-900/20 transition-all transform active:scale-95 ${isLoading ? 'opacity-70 cursor-wait' : ''}`}>{isLoading ? 'Salvando...' : (<><CheckCircle size={18} /> {initialData ? 'Salvar Alterações' : 'Preparar Convite'}</>)}</button></div>
      </form>
    </div>
  );
};

export default PlayerForm;