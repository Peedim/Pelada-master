import React, { useState, useEffect, useRef } from 'react';
import { Bell, Trophy, Calendar } from 'lucide-react'; // Removi X, CheckCircle2 pois não estavam sendo usados no visual atual
import { Player } from '../types';
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
  actionTab: string;
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { checkNewNotifications(); }, [currentUser]);

  const checkNewNotifications = async () => {
    try {
      const [matches, hall, manualUnlocks] = await Promise.all([
        matchService.getAll(),
        rankingService.getHallOfFame(),
        playerService.getManualAchievements(currentUser.id)
      ]);

      const storedData = localStorage.getItem(`pelada_user_data_${currentUser.id}`);
      const knownData = storedData ? JSON.parse(storedData) : { achievementIds: [], lastMatchId: '' };
      
      const savedNotifs = localStorage.getItem(`pelada_notifications_${currentUser.id}`);
      let currentNotifications: Notification[] = savedNotifs ? JSON.parse(savedNotifs) : [];

      const stats = calculatePlayerStats(currentUser.id, matches, hall);
      const currentUnlockedIds: string[] = [];
      const newAchievements: Notification[] = [];

      ACHIEVEMENTS_LIST.forEach(achiev => {
        if (achiev.condition(stats) || manualUnlocks.includes(achiev.id)) {
          currentUnlockedIds.push(achiev.id);
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
             actionTab: 'career'
         });
         knownData.lastMatchId = lastFinishedMatch.id;
      }

      if (newAchievements.length > 0 || newEvents.length > 0) {
        const updatedNotifications = [...newEvents, ...newAchievements, ...currentNotifications];
        const trimmedNotifications = updatedNotifications.slice(0, 10);
        setNotifications(trimmedNotifications);
        setUnreadCount(trimmedNotifications.filter(n => !n.read).length);
        localStorage.setItem(`pelada_notifications_${currentUser.id}`, JSON.stringify(trimmedNotifications));
        knownData.achievementIds = currentUnlockedIds;
        localStorage.setItem(`pelada_user_data_${currentUser.id}`, JSON.stringify(knownData));
      } else {
        setNotifications(currentNotifications);
        setUnreadCount(currentNotifications.filter(n => !n.read).length);
        if (JSON.stringify(knownData.achievementIds) !== JSON.stringify(currentUnlockedIds)) {
            knownData.achievementIds = currentUnlockedIds;
            localStorage.setItem(`pelada_user_data_${currentUser.id}`, JSON.stringify(knownData));
        }
      }
    } catch (error) { console.error("Erro notificacoes", error); }
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    setUnreadCount(0);
    localStorage.setItem(`pelada_notifications_${currentUser.id}`, JSON.stringify(updated));
  };

  const handleNotificationClick = (notif: Notification) => {
    const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
    setNotifications(updated);
    setUnreadCount(updated.filter(n => !n.read).length);
    localStorage.setItem(`pelada_notifications_${currentUser.id}`, JSON.stringify(updated));
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
      <button 
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) markAllAsRead(); }}
        className="p-2 relative hover:bg-slate-800 rounded-full transition-colors"
      >
        <Bell size={24} className={isOpen ? "text-white" : "text-slate-400"} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        // AQUI ESTÁ O AJUSTE DE POSIÇÃO (-right-10) E LARGURA (w-72)
        <div className="absolute top-full -right-10 sm:right-0 mt-3 w-72 sm:w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-visible animate-fade-in origin-top-right">
          
          {/* SETINHA (Triângulo) APONTANDO PARA O SINO */}
          <div className="absolute -top-1.5 right-[3.3rem] sm:right-3 w-3 h-3 bg-slate-800 border-l border-t border-slate-700 transform rotate-45 z-50"></div>

          <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900/50 rounded-t-xl relative z-40">
             <h3 className="text-sm font-bold text-white">Notificações</h3>
             {notifications.length > 0 && (
                 <button onClick={clearNotifications} className="text-[10px] text-slate-400 hover:text-red-400 uppercase font-bold transition-colors">
                     Limpar
                 </button>
             )}
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar bg-slate-800 rounded-b-xl">
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
                             <div className={`mt-1 min-w-[32px] h-8 rounded-full flex items-center justify-center border ${notif.type === 'achievement' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-500'}`}>
                                 {notif.type === 'achievement' ? <Trophy size={14} /> : <Calendar size={14} />}
                             </div>
                             
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