import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Trophy, Calendar, CheckCircle2 } from 'lucide-react';
import { Player, Match } from '../types';
import { matchService } from '../services/matchService';
import { rankingService } from '../services/rankingService';
import { playerService } from '../services/playerService';
import { calculatePlayerStats, ACHIEVEMENTS_LIST } from '../data/achievements';

interface Notification {
  id: string;
  type: 'achievement' | 'event';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionTab: string; // Para onde redirecionar ('achievements' | 'career')
}

interface NotificationBellProps {
  currentUser: Player;
  onNavigate: (tab: string) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown se clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- LÓGICA DE VERIFICAÇÃO ---
  useEffect(() => {
    checkNewNotifications();
  }, [currentUser]);

  const checkNewNotifications = async () => {
    try {
      // 1. Carregar Dados Reais
      const [matches, hall, manualUnlocks] = await Promise.all([
        matchService.getAll(),
        rankingService.getHallOfFame(),
        playerService.getManualAchievements(currentUser.id)
      ]);

      // 2. Carregar Estado Local (O que o usuário "já sabe")
      const storedData = localStorage.getItem(`pelada_user_data_${currentUser.id}`);
      const knownData = storedData ? JSON.parse(storedData) : { achievementIds: [], lastMatchId: '' };
      
      const savedNotifs = localStorage.getItem(`pelada_notifications_${currentUser.id}`);
      let currentNotifications: Notification[] = savedNotifs ? JSON.parse(savedNotifs) : [];

      // --- VERIFICAR CONQUISTAS NOVAS ---
      const stats = calculatePlayerStats(currentUser.id, matches, hall);
      const currentUnlockedIds: string[] = [];
      const newAchievements: Notification[] = [];

      ACHIEVEMENTS_LIST.forEach(achiev => {
        // Verifica se desbloqueou (Auto ou Manual)
        if (achiev.condition(stats) || manualUnlocks.includes(achiev.id)) {
          currentUnlockedIds.push(achiev.id);

          // Se NÃO estava na lista de conhecidos, é nova!
          if (!knownData.achievementIds.includes(achiev.id)) {
            newAchievements.push({
              id: `notif_achiev_${achiev.id}_${Date.now()}`,
              type: 'achievement',
              title: 'Nova Conquista!',
              message: `Você desbloqueou: ${achiev.title}`,
              timestamp: Date.now(),
              read: false,
              actionTab: 'achievements'
            });
          }
        }
      });

      // --- VERIFICAR EVENTO ENCERRADO ---
      // Pega o último evento finalizado
      const lastFinishedMatch = matches
        .filter(m => m.status === 'FINISHED')
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      const newEvents: Notification[] = [];
      if (lastFinishedMatch && lastFinishedMatch.id !== knownData.lastMatchId) {
         newEvents.push({
             id: `notif_match_${lastFinishedMatch.id}`,
             type: 'event',
             title: 'Resultados Disponíveis',
             message: 'O último evento foi finalizado. Confira a súmula e sua evolução!',
             timestamp: Date.now(),
             read: false,
             actionTab: 'career' // ou home
         });
         // Atualiza o ID conhecido para não notificar de novo
         knownData.lastMatchId = lastFinishedMatch.id;
      }

      // --- ATUALIZAR ESTADO E STORAGE ---
      if (newAchievements.length > 0 || newEvents.length > 0) {
        const updatedNotifications = [...newEvents, ...newAchievements, ...currentNotifications];
        // Limita a 10 notificações para não poluir
        const trimmedNotifications = updatedNotifications.slice(0, 10);
        
        setNotifications(trimmedNotifications);
        setUnreadCount(trimmedNotifications.filter(n => !n.read).length);
        
        // Salva notificações
        localStorage.setItem(`pelada_notifications_${currentUser.id}`, JSON.stringify(trimmedNotifications));
        
        // Salva estado de conhecimento
        knownData.achievementIds = currentUnlockedIds;
        localStorage.setItem(`pelada_user_data_${currentUser.id}`, JSON.stringify(knownData));
      } else {
        // Se não tem nada novo, só carrega as antigas
        setNotifications(currentNotifications);
        setUnreadCount(currentNotifications.filter(n => !n.read).length);
        
        // Atualiza a lista de IDs conhecidos mesmo sem notificações novas (para sincronizar)
        if (JSON.stringify(knownData.achievementIds) !== JSON.stringify(currentUnlockedIds)) {
            knownData.achievementIds = currentUnlockedIds;
            localStorage.setItem(`pelada_user_data_${currentUser.id}`, JSON.stringify(knownData));
        }
      }

    } catch (error) {
      console.error("Erro ao verificar notificações", error);
    }
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    setUnreadCount(0);
    localStorage.setItem(`pelada_notifications_${currentUser.id}`, JSON.stringify(updated));
  };

  const handleNotificationClick = (notif: Notification) => {
    // Marca como lida
    const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
    setNotifications(updated);
    setUnreadCount(updated.filter(n => !n.read).length);
    localStorage.setItem(`pelada_notifications_${currentUser.id}`, JSON.stringify(updated));

    // Navega e fecha
    setIsOpen(false);
    onNavigate(notif.actionTab);
  };

  const clearNotifications = (e: React.MouseEvent) => {
      e.stopPropagation();
      setNotifications([]);
      setUnreadCount(0);
      localStorage.removeItem(`pelada_notifications_${currentUser.id}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Ícone do Sino */}
      <button 
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) markAllAsRead(); }}
        className="p-2 relative hover:bg-slate-800 rounded-full transition-colors"
      >
        <Bell size={24} className={isOpen ? "text-white" : "text-slate-400"} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in origin-top-right">
          
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900/50">
             <h3 className="text-sm font-bold text-white">Notificações</h3>
             {notifications.length > 0 && (
                 <button onClick={clearNotifications} className="text-[10px] text-slate-400 hover:text-red-400 uppercase font-bold transition-colors">
                     Limpar
                 </button>
             )}
          </div>

          {/* Lista */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
             {notifications.length === 0 ? (
                 <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                     <Bell size={32} className="mb-2 opacity-20" />
                     <p className="text-xs">Tudo tranquilo por aqui.</p>
                 </div>
             ) : (
                 <div className="divide-y divide-slate-700/50">
                     {notifications.map(notif => (
                         <div 
                            key={notif.id} 
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 flex gap-3 hover:bg-slate-700/50 cursor-pointer transition-colors ${!notif.read ? 'bg-emerald-500/5' : ''}`}
                         >
                             {/* Ícone */}
                             <div className={`mt-1 min-w-[32px] h-8 rounded-full flex items-center justify-center border ${notif.type === 'achievement' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-500'}`}>
                                 {notif.type === 'achievement' ? <Trophy size={14} /> : <Calendar size={14} />}
                             </div>
                             
                             {/* Texto */}
                             <div className="flex-1">
                                 <h4 className={`text-xs font-bold ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                                     {notif.title}
                                     {!notif.read && <span className="ml-2 inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
                                 </h4>
                                 <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{notif.message}</p>
                                 <span className="text-[9px] text-slate-600 mt-1 block">
                                     {new Date(notif.timestamp).toLocaleDateString()} • {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </span>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;