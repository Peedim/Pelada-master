import React from 'react';
import { Home, Shield, Trophy, Activity } from 'lucide-react';

interface FooterNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
}

const FooterNav: React.FC<FooterNavProps> = ({ currentTab, onTabChange, isAdmin }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe z-50">
      <div className="flex justify-around items-center h-16 max-w-7xl mx-auto px-4">
        
        <button 
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${currentTab === 'home' ? 'text-green-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Home size={24} strokeWidth={currentTab === 'home' ? 2.5 : 2} />
        </button>

        <button 
          onClick={() => onTabChange('career')} // <--- Linkado aqui
          className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${currentTab === 'career' ? 'text-yellow-500' : 'text-slate-500 hover:text-slate-300'}`}
          title="Carreira"
        >
          <Activity size={24} strokeWidth={currentTab === 'career' ? 2.5 : 2} />
        </button>

        <button 
          className="flex flex-col items-center justify-center w-16 h-full space-y-1 text-slate-600 cursor-not-allowed"
          title="Em breve"
        >
          <Trophy size={24} />
        </button>

        {isAdmin && (
          <button 
            onClick={() => onTabChange('admin')}
            className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${currentTab === 'admin' ? 'text-cyan-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Shield size={24} strokeWidth={currentTab === 'admin' ? 2.5 : 2} />
          </button>
        )}

      </div>
    </div>
  );
};

export default FooterNav;