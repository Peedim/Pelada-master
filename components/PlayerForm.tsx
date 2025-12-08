import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Player, PlayerFormData, PlayerPosition, PlayStyle } from '../types';
import { User, Activity, CheckCircle, Shield, ArrowLeft, Zap } from 'lucide-react';

interface PlayerFormProps {
  initialData?: Player;
  onSubmit: (data: PlayerFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const PlayerForm: React.FC<PlayerFormProps> = ({ initialData, onSubmit, onCancel, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'attributes'>('basic');

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<PlayerFormData>({
    defaultValues: initialData ? {
      ...initialData,
      ...initialData.attributes
    } : {
      name: '',
      email: '',
      position: PlayerPosition.MEIO_CAMPO,
      playStyle: PlayStyle.ALL_ROUNDER,
      shirt_number: 10,
      initial_ovr: 70,
      photo_url: '',
      is_admin: false,
      pace: 70,
      shooting: 70,
      passing: 70,
      dribbling: 70,
      defending: 70,
      physical: 70,
    }
  });

  // Watch attributes individually to ensure strict dependency tracking
  const [pace, shooting, passing, dribbling, defending, physical] = watch([
    'pace', 
    'shooting', 
    'passing', 
    'dribbling', 
    'defending', 
    'physical'
  ]);
  
  // Calculate OVR in real-time for display
  const currentOvr = useMemo(() => {
    const sum = (Number(pace) || 0) + 
                (Number(shooting) || 0) + 
                (Number(passing) || 0) + 
                (Number(dribbling) || 0) + 
                (Number(defending) || 0) + 
                (Number(physical) || 0);
    return Math.round(sum / 6);
  }, [pace, shooting, passing, dribbling, defending, physical]);

  // Sync the calculated OVR to the form field 'initial_ovr' for submission
  useEffect(() => {
    setValue('initial_ovr', currentOvr);
  }, [currentOvr, setValue]);

  const applyPreset = (preset: 'GK' | 'DEF' | 'MID' | 'ATT' | 'BAL') => {
    const presets = {
      GK: { pace: 45, shooting: 20, passing: 50, dribbling: 30, defending: 85, physical: 75 },
      DEF: { pace: 65, shooting: 40, passing: 60, dribbling: 55, defending: 88, physical: 85 },
      MID: { pace: 75, shooting: 70, passing: 88, dribbling: 82, defending: 65, physical: 70 },
      ATT: { pace: 88, shooting: 85, passing: 70, dribbling: 85, defending: 35, physical: 75 },
      BAL: { pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70 },
    };

    const values = presets[preset];
    setValue('pace', values.pace);
    setValue('shooting', values.shooting);
    setValue('passing', values.passing);
    setValue('dribbling', values.dribbling);
    setValue('defending', values.defending);
    setValue('physical', values.physical);
  };

  const getAttributeColor = (value: number) => {
    if (value < 60) return 'text-red-500';
    if (value < 75) return 'text-yellow-500';
    if (value < 85) return 'text-green-500';
    return 'text-blue-500';
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
       {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              {initialData ? 'Editar Jogador' : 'Convidar Novo Jogador'}
            </h2>
            <p className="text-slate-400 text-sm">
              {initialData ? 'Atualize os dados do jogador.' : 'Adicione um novo jogador ao sistema.'}
            </p>
          </div>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
           <span className="text-slate-400 text-sm uppercase tracking-wider">OVR ATUAL</span>
           <div className={`text-2xl font-bold ${getAttributeColor(currentOvr)}`}>{currentOvr}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Tabs Navigation */}
        <div className="grid grid-cols-2 bg-slate-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'basic' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <User size={16} />
              Dados Básicos
            </div>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attributes')}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
              activeTab === 'attributes' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Activity size={16} />
              Atributos
            </div>
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-xl">
          
          {/* Tab 1: Basic Data */}
          <div className={activeTab === 'basic' ? 'block' : 'hidden'}>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                  <Controller
                    name="email"
                    control={control}
                    rules={{ required: 'Email é obrigatório', pattern: { value: /^\S+@\S+$/i, message: "Email inválido" } }}
                    render={({ field }) => (
                      <input 
                        {...field} 
                        type="email"
                        placeholder="jogador@exemplo.com"
                        className={`w-full bg-slate-900 border ${errors.email ? 'border-red-500' : 'border-slate-700'} rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`}
                      />
                    )}
                  />
                  {errors.email && <span className="text-red-500 text-xs mt-1">{errors.email.message}</span>}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nome Completo *</label>
                  <Controller
                    name="name"
                    control={control}
                    rules={{ required: 'Nome é obrigatório' }}
                    render={({ field }) => (
                      <input 
                        {...field} 
                        placeholder="Nome do jogador"
                        className={`w-full bg-slate-900 border ${errors.name ? 'border-red-500' : 'border-slate-700'} rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all`}
                      />
                    )}
                  />
                  {errors.name && <span className="text-red-500 text-xs mt-1">{errors.name.message}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Posição Preferida</label>
                  <Controller
                    name="position"
                    control={control}
                    render={({ field }) => (
                      <select 
                        {...field} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"
                      >
                        {Object.values(PlayerPosition).map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    )}
                  />
                </div>

                {/* PlayStyle */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
                    <Zap size={14} className="text-yellow-400" />
                    Estilo de Jogo
                  </label>
                  <Controller
                    name="playStyle"
                    control={control}
                    render={({ field }) => (
                      <select 
                        {...field} 
                        className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none appearance-none"
                      >
                        {Object.values(PlayStyle).map(style => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                    )}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Define o comportamento tático para o sorteio de times.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Shirt Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Número da Camisa</label>
                  <Controller
                    name="shirt_number"
                    control={control}
                    render={({ field }) => (
                      <input 
                        {...field} 
                        type="number"
                        className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    )}
                  />
                </div>

                {/* Photo URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">URL da Foto (opcional)</label>
                  <Controller
                    name="photo_url"
                    control={control}
                    render={({ field }) => (
                      <input 
                        {...field} 
                        placeholder="https://exemplo.com/foto.jpg"
                        className="w-full bg-slate-900 border border-slate-700 rounded-md p-2.5 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    )}
                  />
                </div>
              </div>

              {/* Admin Checkbox */}
              <div className="bg-slate-900/50 p-4 rounded-md border border-slate-700/50 flex items-start gap-3">
                <Controller
                  name="is_admin"
                  control={control}
                  render={({ field: { value, onChange, ...rest } }) => (
                    <div className="flex items-center h-6">
                      <input
                        id="is_admin"
                        type="checkbox"
                        checked={value}
                        onChange={onChange}
                        {...rest}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-green-600 focus:ring-green-500 focus:ring-offset-slate-900"
                      />
                    </div>
                  )}
                />
                <div>
                  <label htmlFor="is_admin" className="text-sm font-medium text-white flex items-center gap-2">
                    <Shield size={14} className="text-purple-400" />
                    Dar permissões de Administrador
                  </label>
                  <p className="text-xs text-slate-400 mt-1">
                    Administradores podem gerenciar eventos, jogadores e acessar todas as funcionalidades do sistema.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab 2: Attributes */}
          <div className={activeTab === 'attributes' ? 'block' : 'hidden'}>
            <div className="mb-6">
               <label className="block text-sm font-medium text-slate-300 mb-3">Presets Rápidos</label>
               <div className="flex flex-wrap gap-2">
                 <button type="button" onClick={() => applyPreset('GK')} className="flex-1 min-w-[80px] text-xs font-medium py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors border border-slate-600">Goleiro</button>
                 <button type="button" onClick={() => applyPreset('DEF')} className="flex-1 min-w-[80px] text-xs font-medium py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors border border-slate-600">Defensor</button>
                 <button type="button" onClick={() => applyPreset('MID')} className="flex-1 min-w-[80px] text-xs font-medium py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors border border-slate-600">Meio-campo</button>
                 <button type="button" onClick={() => applyPreset('ATT')} className="flex-1 min-w-[80px] text-xs font-medium py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors border border-slate-600">Atacante</button>
                 <button type="button" onClick={() => applyPreset('BAL')} className="flex-1 min-w-[80px] text-xs font-medium py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors border border-slate-600">Equilibrado</button>
               </div>
            </div>

            <div className="space-y-6">
              {[
                { name: 'pace', label: 'Ritmo' },
                { name: 'shooting', label: 'Finalização' },
                { name: 'passing', label: 'Passe' },
                { name: 'dribbling', label: 'Drible' },
                { name: 'defending', label: 'Defesa' },
                { name: 'physical', label: 'Físico' },
              ].map((attr) => (
                <div key={attr.name}>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-white">{attr.label}</label>
                    <span className={`text-sm font-bold ${getAttributeColor(watch(attr.name as any))}`}>
                      {watch(attr.name as any)}
                    </span>
                  </div>
                  <Controller
                    name={attr.name as any}
                    control={control}
                    render={({ field }) => (
                      <input
                        type="range"
                        min="0"
                        max="99"
                        {...field}
                        className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-green-500 hover:accent-green-400"
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-4 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-transparent text-slate-300 hover:text-white transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-md shadow-lg shadow-green-900/20 transition-all transform active:scale-95
              ${isLoading ? 'opacity-70 cursor-wait' : ''}
            `}
          >
            {isLoading ? (
               'Salvando...'
            ) : (
              <>
                <CheckCircle size={18} />
                {initialData ? 'Salvar Alterações' : 'Preparar Convite'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlayerForm;